import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Payload } from 'payload';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Authenticated isolation tests run ONLY under the staging-only CI step.
 * The normal integration suite skips them rather than importing staging
 * configuration into production-mode test workers.
 */
const enabled = process.env.CI_STAGING_ROLE_INTEGRATION === '1';
if (enabled && (
  process.env.GITHUB_ACTIONS !== 'true' ||
  process.env.RUN_DATABASE_TESTS !== '1' ||
  process.env.NODE_ENV !== 'production' ||
  process.env.DATABASE_URI !== 'postgres://mock:mock@localhost:5432/mock' ||
  process.env.PAYLOAD_SECRET !== 'ci-mock-payload-secret-not-production' ||
  process.env.HLS_ISOLATED_STAGING !== 'true' ||
  process.env.HLS_STAGING_CMS_ORIGIN !== 'https://cms-qa.healthylifesstyles.com' ||
  process.env.SERVER_URL !== 'https://cms-qa.healthylifesstyles.com' ||
  process.env.INDEXNOW_DISABLE !== 'true' ||
  process.env.INDEXNOW_LIVE_ENABLED !== 'false' ||
  process.env.VERCEL_DEPLOY_HOOK_URL ||
  process.env.CHATGPT_DRAFT_BRIDGE_TOKEN ||
  process.env.S3_ENDPOINT
)) {
  throw new Error('Staging roles require an isolated mock CI DB and disabled external providers');
}

describe.skipIf(!enabled)('actual staging-mode CMS role isolation with disposable users', () => {
  const stage = 'https://cms-qa.healthylifesstyles.com';
  const live = 'https://cms.healthylifesstyles.com';
  let payload: Payload;
  let adminToken: string;
  let editorToken: string;
  let queue: (req: Request) => Promise<Response>;
  let deploy: (req: Request) => Promise<Response>;
  let indexNow: (req: Request) => Promise<Response>;

  function request(path: string, method: 'GET' | 'POST', token?: string, origin = stage, confirm = false) {
    return new Request(stage + path, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'JWT ' + token } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify({ confirm }) } : {}),
    });
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const config = (await import('../../payload.config')).default;
    payload = await getPayload({ config });
    expect(payload.db.push).toBe(false);
    const suffix = Date.now().toString(36);
    for (const role of ['admin', 'editor'] as const) {
      const email = 'staging-roles-' + role + '-' + suffix + '@example.invalid';
      const password = 'Mock-only-' + role + '-' + suffix + '-strong-password!';
      await payload.create({
        collection: 'users',
        data: { name: 'Disposable Staging ' + role, email, password, role },
      });
      const login = await payload.login({ collection: 'users', data: { email, password } });
      expect(login.token).toBeTypeOf('string');
      if (role === 'admin') adminToken = login.token!;
      else editorToken = login.token!;
    }
    queue = (await import('../../src/app/api/deploy/pending/route')).GET;
    deploy = (await import('../../src/app/api/deploy/route')).POST;
    indexNow = (await import('../../src/app/api/seo/reconcile-indexnow/route')).POST;

    // Tokens are mock-only and never leave this ephemeral GitHub Actions runner.
    const temp = process.env.RUNNER_TEMP;
    if (!temp?.startsWith('/') || temp === '/') {
      throw new Error('A runner-owned absolute temporary directory is required');
    }
    await writeFile(join(temp, 'hls-isolated-staging-roles.json'),
      JSON.stringify({ adminToken, editorToken }),
      { mode: 0o600, encoding: 'utf8', flag: 'wx' });
  }, 120000);

  afterAll(async () => { await payload?.destroy(); });

  it('refuses subscriber synchronization in the handler even when its HTTP route is shadowed', async () => {
    const { subscriberSync } = await import('../../src/endpoints/subscriberSync');
    const request = new Request(stage + '/api/subscribers/sync', {
      method: 'POST', headers: { Origin: stage, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const response = await subscriberSync.handler(request as never);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it('exposes preview-only status only to an authenticated administrator', async () => {
    expect((await queue(request('/api/deploy/pending', 'GET'))).status).toBe(401);
    expect((await queue(request('/api/deploy/pending', 'GET', editorToken))).status).toBe(403);
    const response = await queue(request('/api/deploy/pending', 'GET', adminToken));
    expect(response.status).toBe(200);
    const body = await response.json() as { stagingPreviewOnly?: unknown; count?: unknown };
    expect(body.stagingPreviewOnly).toBe(true);
    expect(Number.isSafeInteger(body.count)).toBe(true);
  });

  it('rejects a staging administrator deploy without recording a reservation', async () => {
    const before = (await payload.count({ collection: 'deploy-log' })).totalDocs;
    for (const origin of [stage, live]) {
      expect((await deploy(request('/api/deploy', 'POST', adminToken, origin))).status).toBe(403);
    }
    expect((await payload.count({ collection: 'deploy-log' })).totalDocs).toBe(before);
  });

  it('denies both editor preview and administrator live IndexNow submission before any fetch', async () => {
    const remote = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request'));
    try {
      expect((await indexNow(request('/api/seo/reconcile-indexnow', 'POST', editorToken, stage))).status).toBe(403);
      const before = (await payload.count({ collection: 'pending-deploys' })).totalDocs;
      const denied = await indexNow(request('/api/seo/reconcile-indexnow', 'POST', adminToken, stage, true));
      expect(denied.status).toBe(403);
      expect((await payload.count({ collection: 'pending-deploys' })).totalDocs).toBe(before);
      expect((await indexNow(request('/api/seo/reconcile-indexnow', 'POST', adminToken, live))).status).toBe(403);
      expect(remote).not.toHaveBeenCalled();
    } finally {
      remote.mockRestore();
    }
  });

  it('accepts admin preview origin but fails closed if public build proof is unavailable', async () => {
    const remote = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Synthetic unavailable public manifest'));
    try {
      const response = await indexNow(request('/api/seo/reconcile-indexnow', 'POST', adminToken, stage, false));
      expect(response.status).toBe(503);
      const body = await response.json() as { error?: string };
      expect(body.error).toMatch(/Cannot verify public Vercel build/i);
      expect(remote).toHaveBeenCalledTimes(1);
      expect(String(remote.mock.calls[0]?.[0])).toBe(
        'https://www.healthylifesstyles.com/content-manifest.json');
    } finally {
      remote.mockRestore();
    }
  });
});
