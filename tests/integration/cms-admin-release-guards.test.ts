import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Payload } from 'payload';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// No import of Payload configuration or a route handler until the CI-only
// database and provider boundaries have been verified.
if (
  process.env.GITHUB_ACTIONS !== 'true' ||
  process.env.RUN_DATABASE_TESTS !== '1' ||
  process.env.NODE_ENV !== 'production' ||
  process.env.DATABASE_URI !== 'postgres://mock:mock@localhost:5432/mock' ||
  process.env.PAYLOAD_SECRET !== 'ci-mock-payload-secret-not-production' ||
  process.env.INDEXNOW_DISABLE !== 'true' ||
  process.env.VERCEL_DEPLOY_HOOK_URL ||
  process.env.CHATGPT_DRAFT_BRIDGE_TOKEN ||
  process.env.S3_ENDPOINT
) {
  throw new Error('CMS release-role tests require CI disposable PostgreSQL and disabled live integrations');
}

const CMS_ORIGIN = 'https://cms.healthylifesstyles.com';

describe('real Payload staff permissions on Hostinger CMS release endpoints (isolated database)', () => {
  let payload: Payload;
  let adminToken: string;
  let editorToken: string;
  let deploy: (request: Request) => Promise<Response>;
  let pending: (request: Request) => Promise<Response>;
  let indexnow: (request: Request) => Promise<Response>;

  const makeRequest = (
    path: string, method: 'GET' | 'POST',
    token?: string, origin?: string,
  ) => new Request(CMS_ORIGIN + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'JWT ' + token } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify({ confirm: false }) } : {}),
  });

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const config = (await import('../../payload.config')).default;
    payload = await getPayload({ config });
    expect(payload.db.push).toBe(false);
    const suffix = String(Date.now());
    for (const role of ['admin', 'editor'] as const) {
      const email = 'cms-release-' + role + '-' + suffix + '@example.invalid';
      const password = 'Disposable-' + role + '-' + suffix + '-only!';
      await payload.create({
        collection: 'users',
        data: { name: 'Release QA ' + role, email, password, role },
      });
      const auth = await payload.login({ collection: 'users', data: { email, password } });
      expect(typeof auth.token).toBe('string');
      if (role === 'admin') adminToken = auth.token!;
      else editorToken = auth.token!;
    }
    deploy = (await import('../../src/app/api/deploy/route')).POST;
    pending = (await import('../../src/app/api/deploy/pending/route')).GET;
    indexnow = (await import('../../src/app/api/seo/reconcile-indexnow/route')).POST;
    // Pass mock-only role JWTs to the later isolated HTTP smoke test without
    // logging credentials or saving anything into the repository/artifacts.
    if (!process.env.RUNNER_TEMP || !process.env.RUNNER_TEMP.startsWith('/')) {
      throw new Error('GitHub runner temporary directory is required.');
    }
    const fixtureFile = join(process.env.RUNNER_TEMP, 'hls-cms-role-fixture.json');
    await writeFile(fixtureFile, JSON.stringify({ adminToken, editorToken }), {
      encoding: 'utf8', mode: 0o600, flag: 'w',
    });
  }, 120000);

  afterAll(async () => { await payload?.destroy(); });

  it('denies editor and unauthenticated access to queued deployment state', async () => {
    expect((await pending(makeRequest('/api/deploy/pending', 'GET'))).status).toBe(401);
    expect((await pending(makeRequest('/api/deploy/pending', 'GET', editorToken))).status).toBe(403);
    const adminResult = await pending(makeRequest('/api/deploy/pending', 'GET', adminToken));
    expect(adminResult.status).toBe(200);
    const body = await adminResult.json() as { count?: unknown };
    expect(Number.isSafeInteger(body.count) && (body.count as number) >= 0).toBe(true);
  });

  it('denies cross-origin deployment even with a real admin JWT', async () => {
    const before = (await payload.count({ collection: 'deploy-log' })).totalDocs;
    const response = await deploy(makeRequest('/api/deploy', 'POST', adminToken,
      'https://www.healthylifesstyles.com'));
    expect(response.status).toBe(403);
    expect((await payload.count({ collection: 'deploy-log' })).totalDocs).toBe(before);
  });

  it('denies editor deployment before any hook or reservation', async () => {
    const before = (await payload.count({ collection: 'deploy-log' })).totalDocs;
    const response = await deploy(makeRequest('/api/deploy', 'POST', editorToken, CMS_ORIGIN));
    expect(response.status).toBe(403);
    expect((await payload.count({ collection: 'deploy-log' })).totalDocs).toBe(before);
  });

  it('requires a configured, validated public-site hook for an authenticated admin', async () => {
    const before = (await payload.count({ collection: 'deploy-log' })).totalDocs;
    const response = await deploy(makeRequest('/api/deploy', 'POST', adminToken, CMS_ORIGIN));
    expect(response.status).toBe(503);
    const body = await response.json() as { error?: string };
    expect(body.error).toMatch(/deploy hook.*missing or invalid/i);
    expect((await payload.count({ collection: 'deploy-log' })).totalDocs).toBe(before);
  });

  it('keeps editor-created article drafts inaccessible to anonymous visitors and off the deployment queue', async () => {
    // Real REST endpoint + real editor login, using ONLY the CI disposable DB.
    const { REST_POST, REST_GET } = await import('@payloadcms/next/routes');
    const config = (await import('../../payload.config')).default;
    const unique = Date.now() + '-' + Math.random().toString(36).slice(2);
    const slug = 'ci-private-article-' + unique;
    const queueBefore = (await payload.count({ collection: 'pending-deploys' })).totalDocs;
    const route = (method: 'GET' | 'POST', path: string, token?: string, body?: unknown) =>
      new Request('http://localhost:3000/api/' + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'JWT ' + token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const context = (segments: string[]) => ({ params: Promise.resolve({ slug: segments }) });
    const created = await REST_POST(config)(
      route('POST', 'articles?draft=true', editorToken, {
        title: 'Private QA Article ' + unique,
        slug,
        excerpt: 'Unpublished draft acceptance test in disposable CI only.',
        _status: 'draft',
        reviewedByHuman: false,
      }),
      context(['articles']),
    );
    expect([200, 201]).toContain(created.status);
    const result = await created.json() as { doc?: { id?: number | string; _status?: string }; id?: number | string };
    const id = result.doc?.id ?? result.id;
    expect(id).toBeDefined();
    expect(result.doc?._status).toBe('draft');

    const anonymousList = await REST_GET(config)(
      route('GET', 'articles?where[slug][equals]=' + slug + '&limit=10'),
      context(['articles']),
    );
    expect(anonymousList.status).toBe(200);
    const listed = await anonymousList.json() as { docs: { id: number | string }[] };
    expect(listed.docs.some(doc => String(doc.id) === String(id))).toBe(false);

    const anonymousById = await REST_GET(config)(
      route('GET', 'articles/' + id + '?draft=true'),
      context(['articles', String(id)]),
    );
    expect([403, 404]).toContain(anonymousById.status);

    const editorById = await REST_GET(config)(
      route('GET', 'articles/' + id + '?draft=true', editorToken),
      context(['articles', String(id)]),
    );
    expect(editorById.status).toBe(200);
    const editorDoc = await editorById.json() as { id: number | string; _status?: string };
    expect(String(editorDoc.id)).toBe(String(id));
    expect(editorDoc._status).toBe('draft');

    const queueAfter = (await payload.count({ collection: 'pending-deploys' })).totalDocs;
    expect(queueAfter).toBe(queueBefore);
  });

  it('blocks an authenticated editor and wrong origin before IndexNow network access', async () => {
    const external = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('Unexpected external network during mock IndexNow gate');
    });
    try {
      const editor = await indexnow(makeRequest('/api/seo/reconcile-indexnow',
        'POST', editorToken, CMS_ORIGIN));
      expect(editor.status).toBe(403);
      const wrongOrigin = await indexnow(makeRequest('/api/seo/reconcile-indexnow',
        'POST', adminToken, 'https://www.healthylifesstyles.com'));
      expect(wrongOrigin.status).toBe(403);
      expect(external).not.toHaveBeenCalled();
    } finally {
      external.mockRestore();
    }
  });
});
