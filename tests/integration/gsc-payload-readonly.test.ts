import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Payload, PayloadRequest } from 'payload';

// Run only against the ephemeral GitHub Actions PostgreSQL mock. Never permit
// this test to touch Neon, Hostinger, R2 or live Search Console credentials.
const db = new URL(process.env.DATABASE_URI || 'postgres://invalid/invalid');
if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.RUN_DATABASE_TESTS !== '1' ||
    process.env.NODE_ENV !== 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(db.hostname) ||
    db.pathname !== '/mock' || db.username !== 'mock' ||
    process.env.S3_ENDPOINT || process.env.VERCEL_DEPLOY_HOOK_URL) {
  throw new Error('GSC Payload integration requires the disposable loopback CI database with no external integrations.');
}

describe('GSC read-only collector against real Payload Local API', () => {
  let payload: Payload;
  let editor: { id: string | number; role: 'editor' };
  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const config = (await import('../../payload.config')).default;
    payload = await getPayload({ config });
    expect(payload.db.push).toBe(false);
    const suffix = Date.now().toString(36);
    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Disposable GSC collector reviewer',
        email: 'gsc-review-' + suffix + '@example.invalid',
        password: 'Mock-GSC-only-' + suffix + '-pass!',
        role: 'editor',
      },
    });
    editor = { id: user.id, role: 'editor' };
  });
  afterAll(async () => { await payload?.destroy(); });

  it('uses real access-scoped paginated selections and returns no fabricated records', async () => {
    const { collectAuthorizedPayloadReviewSnapshot } =
      await import('../../src/lib/gscPayloadReadOnlyCollector');
    const req = { user: editor, payload } as unknown as PayloadRequest;
    const snapshot = await collectAuthorizedPayloadReviewSnapshot(payload, req);
    expect(snapshot.kind).toBe('access-controlled-local-payload-snapshot');
    expect(snapshot.includesDraftVersions).toBe(false);
    expect(snapshot.catalog).toHaveLength(snapshot.counts.articles + snapshot.counts.tools);
    expect(new Set(snapshot.catalog.map(row => row.collection + ':' + row.recordId)).size)
      .toBe(snapshot.catalog.length);
    for (const row of snapshot.catalog) {
      expect(row.recordId).not.toBeNull();
      expect(row.page).toMatch(/^https:\/\/www\.healthylifesstyles\.com\/(?:tools|wellness-hub)\/[a-z0-9-]+$/);
    }
  });

  it('blocks an unauthenticated caller without reading CMS records', async () => {
    const { collectAuthorizedPayloadReviewSnapshot } =
      await import('../../src/lib/gscPayloadReadOnlyCollector');
    await expect(collectAuthorizedPayloadReviewSnapshot(payload, {
      payload, user: null,
    } as unknown as PayloadRequest)).rejects.toThrow(/administrator or editor/);
  });
});
