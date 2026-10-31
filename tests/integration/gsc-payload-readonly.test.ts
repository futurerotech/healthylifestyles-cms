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
    process.env.S3_ENDPOINT || process.env.VERCEL_DEPLOY_HOOK_URL ||
    process.env.INDEXNOW_DISABLE !== 'true' || process.env.GOOGLE_INDEXING_KEY ||
    process.env.INDEXNOW_API_KEY) {
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

  it('keeps real published, draft and disabled CMS records distinct in the read-only triage', async () => {
    const { collectAuthorizedPayloadReviewSnapshot } =
      await import('../../src/lib/gscPayloadReadOnlyCollector');
    // These writes affect only the empty disposable CI database, and use a
    // fixture context so publish/indexing hooks cannot contact providers.
    const context = { reseedVersions: true };
    const suffix = Date.now().toString(36);
    const category = await payload.create({
      collection: 'categories', context,
      data: { name: 'GSC CI tool category ' + suffix, kind: 'tool' },
    });
    const publishedArticle = await payload.create({
      collection: 'articles', context,
      data: {
        title: 'GSC CI published article ' + suffix,
        slug: 'gsc-published-article-' + suffix,
        _status: 'published',
        seo: { noIndex: false },
      },
    });
    const draftArticle = await payload.create({
      collection: 'articles', context, draft: true,
      data: {
        title: 'GSC CI unpublished article ' + suffix,
        slug: 'gsc-draft-article-' + suffix,
        _status: 'draft',
        seo: { noIndex: true },
      },
    });
    const toolBase = {
      category: category.id,
      toolType: 'coded' as const,
      codedComponent: 'GscFixtureOnly',
      riskLevel: 'low' as const,
      seo: { noIndex: false },
    };
    const publishedTool = await payload.create({
      collection: 'tools', context,
      data: {
        ...toolBase, name: 'GSC CI published tool ' + suffix,
        slug: 'gsc-published-tool-' + suffix,
        enabled: true, _status: 'published',
      },
    });
    const disabledTool = await payload.create({
      collection: 'tools', context,
      data: {
        ...toolBase, name: 'GSC CI disabled tool ' + suffix,
        slug: 'gsc-disabled-tool-' + suffix,
        enabled: false, _status: 'published',
      },
    });
    const draftTool = await payload.create({
      collection: 'tools', context, draft: true,
      data: {
        ...toolBase, name: 'GSC CI draft tool ' + suffix,
        slug: 'gsc-draft-tool-' + suffix,
        enabled: false, _status: 'draft',
      },
    });

    const req = { user: editor, payload } as unknown as PayloadRequest;
    const result = await collectAuthorizedPayloadReviewSnapshot(payload, req);
    expect(result.kind).toBe('access-controlled-local-payload-snapshot');
    expect(result.includesDraftVersions).toBe(false);
    const byId = (collection: 'articles' | 'tools', id: string | number) =>
      result.catalog.find(x => x.collection === collection && String(x.recordId) === String(id));
    expect(byId('articles', publishedArticle.id)).toMatchObject({
      status: 'published', noIndex: false,
      page: 'https://www.healthylifesstyles.com/wellness-hub/' + publishedArticle.slug,
    });
    expect(byId('articles', draftArticle.id)).toMatchObject({
      status: 'draft', noIndex: true,
    });
    expect(byId('tools', publishedTool.id)).toMatchObject({
      status: 'published', enabled: true, noIndex: false,
    });
    expect(byId('tools', disabledTool.id)).toMatchObject({
      status: 'published', enabled: false,
    });
    expect(byId('tools', draftTool.id)).toMatchObject({
      status: 'draft', enabled: false,
    });
    expect(new Set(result.catalog.map(x => x.collection + ':' + x.recordId)).size)
      .toBe(result.catalog.length);
    // Never project private article content, subscriber records or credentials.
    for (const ref of result.catalog) {
      expect(Object.keys(ref).sort()).toEqual([
        'canonicalOverride', 'collection', 'enabled', 'noIndex',
        'page', 'recordId', 'slug', 'status',
      ].sort());
      if (ref.collection === 'articles') expect(ref.enabled).toBeUndefined();
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
