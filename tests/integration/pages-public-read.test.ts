import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Phase 1: prove the real Payload REST Pages ACL using an isolated PostgreSQL
 * database. This file runs only in the existing disposable CI mock-DB job,
 * after committed migrations. No real CMS, Neon, indexing or storage calls.
 */
const uri = new URL(process.env.DATABASE_URI || 'postgres://invalid.invalid/invalid');
const allowed = process.env.GITHUB_ACTIONS === 'true' &&
  process.env.RUN_DATABASE_TESTS === '1' &&
  process.env.NODE_ENV === 'production' &&
  process.env.INDEXNOW_DISABLE === 'true' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname) &&
  (uri.port === '' || uri.port === '5432') &&
  uri.pathname === '/mock' &&
  uri.username === 'mock' && uri.password === 'mock' &&
  !process.env.S3_ENDPOINT && !process.env.VERCEL_DEPLOY_HOOK_URL &&
  !process.env.INDEXNOW_KEY && !process.env.GOOGLE_INDEXING_KEY;
if (!allowed) {
  throw new Error('Pages REST test requires the migrated GitHub Actions loopback mock PostgreSQL database and no live service credentials.');
}

describe('Pages: anonymous published-only reads through real Payload REST', () => {
  let payload: any;
  let config: any;
  let REST_GET: any;
  let adminToken: string;
  let published: { id: string | number; slug: string; title: string };
  let draft: { id: string | number; slug: string; title: string };
  const fixturePrefix = `pages-acl-${process.pid}-${Date.now()}`;

  const get = async (path: string, token?: string) => {
    const [route, query = ''] = path.split('?');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `JWT ${token}`;
    return REST_GET(config)(new Request(`http://localhost:3000/api/${route}?${query}`, {
      method: 'GET', headers,
    }), { params: Promise.resolve({ slug: route.split('/') }) });
  };

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const { Pages } = await import('../../src/collections/Pages');
    config = (await import('../../payload.config')).default;
    REST_GET = (await import('@payloadcms/next/routes')).REST_GET;
    const access = Pages.access?.read;
    expect(access).toBeTypeOf('function');
    expect(await access!({ req: { user: null } } as never)).toEqual({ _status: { equals: 'published' } });
    payload = await getPayload({ config });
    expect(payload.db.push).toBe(false);
    const db = await payload.db.pool.query('SELECT current_database() AS name');
    expect(db.rows[0].name).toBe('mock');

    const adminEmail = `${fixturePrefix}@example.invalid`;
    const password = 'Disposable-Pages-ACL-only-2026!';
    await payload.create({ collection: 'users', data: {
      name: 'Disposable Pages ACL administrator', email: adminEmail, password, role: 'admin',
    } });
    adminToken = (await payload.login({ collection: 'users', data: {
      email: adminEmail, password,
    } })).token;
    expect(adminToken).toBeTruthy();

    const makePage = async (name: 'published' | 'draft') => {
      const isDraft = name === 'draft';
      const title = isDraft ? `PRIVATE_DRAFT_${fixturePrefix}` : `Public fixture ${fixturePrefix}`;
      const slug = `${fixturePrefix}-${name}`;
      const doc = await payload.create({
        collection: 'pages',
        draft: isDraft,
        context: { reseedVersions: true },
        data: {
          title, slug,
          layout: [{ blockType: 'text', style: 'p', text: `${name} content, synthetic CI fixture only` }],
          _status: name,
        },
      });
      expect(doc._status).toBe(name);
      return { id: doc.id, slug, title };
    };
    published = await makePage('published');
    draft = await makePage('draft');
  }, 120000);

  afterAll(async () => { await payload?.destroy(); });

  it('exposes the published fixture in the exact anonymous Astro list query, not the draft', async () => {
    const res = await get('pages?limit=500&depth=1&sort=-publishDate&draft=false');
    expect(res.status).toBe(200);
    const body = await res.json();
    const fixtureSlugs = body.docs.map((p: { slug: string }) => p.slug)
      .filter((s: string) => s.startsWith(fixturePrefix));
    expect(fixtureSlugs).toEqual([published.slug]);
    expect(JSON.stringify(body)).not.toContain(draft.title);
  });

  it('serves the published slug but not the never-published draft slug', async () => {
    const pub = await get(`pages?where[slug][equals]=${published.slug}&depth=2&draft=false`);
    expect(pub.status).toBe(200);
    expect((await pub.json()).docs.map((p: { slug: string }) => p.slug)).toEqual([published.slug]);
    const hidden = await get(`pages?where[slug][equals]=${draft.slug}&depth=2&draft=false`);
    expect(hidden.status).toBe(200);
    expect((await hidden.json()).docs).toEqual([]);
  });

  it('does not reveal drafts through draft=true, status filters, or OR where conditions', async () => {
    for (const path of [
      `pages?where[slug][equals]=${draft.slug}&draft=true&depth=2`,
      `pages?where[_status][equals]=draft&draft=true&depth=2`,
      `pages?where[or][0][slug][equals]=${published.slug}&where[or][1][slug][equals]=${draft.slug}&draft=true`,
    ]) {
      const res = await get(path);
      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        const body = await res.json();
        expect(JSON.stringify(body)).not.toContain(draft.slug);
        expect(JSON.stringify(body)).not.toContain(draft.title);
        expect(body.docs.every((p: { _status?: string }) => p._status === 'published')).toBe(true);
      }
    }
  });

  it('denies a direct anonymous draft ID, even with draft=true', async () => {
    const res = await get(`pages/${draft.id}?depth=2&draft=true`);
    expect([403, 404]).toContain(res.status);
    const body = await res.text();
    expect(body).not.toContain(draft.title);
  });

  it('never exposes pending draft edits of an already published page', async () => {
    // A never-published draft is not the only risk: draft=true must never
    // expose an unpublished revision of an otherwise public Page.
    const privateRevisionTitle = `PRIVATE_REVISION_${fixturePrefix}`;
    const privateRevisionBody = `UNRELEASED_REVISION_BODY_${fixturePrefix}`;
    await payload.update({
      collection: 'pages', id: published.id, draft: true,
      context: { reseedVersions: true },
      data: {
        title: privateRevisionTitle,
        layout: [{ blockType: 'text', style: 'p', text: privateRevisionBody }],
      },
    });

    const publicRead = await get(`pages/${published.id}?draft=false&depth=1`);
    expect(publicRead.status).toBe(200);
    const publishedBody = await publicRead.text();
    expect(publishedBody).toContain(published.title);
    expect(publishedBody).not.toContain(privateRevisionTitle);
    expect(publishedBody).not.toContain(privateRevisionBody);

    for (const path of [
      `pages/${published.id}?draft=true&depth=2`,
      `pages?where[slug][equals]=${published.slug}&draft=true&depth=2`,
    ]) {
      const response = await get(path);
      expect([200, 403, 404]).toContain(response.status);
      const serialized = await response.text();
      expect(serialized).not.toContain(privateRevisionTitle);
      expect(serialized).not.toContain(privateRevisionBody);
    }

    const admin = await get(`pages/${published.id}?draft=true&depth=1`, adminToken);
    expect(admin.status).toBe(200);
    const adminPage = await admin.json();
    expect(adminPage.title).toBe(privateRevisionTitle);
  });

  it('keeps a genuinely authenticated administrator able to inspect the draft', async () => {
    const res = await get(`pages/${draft.id}?depth=1&draft=true`, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe(draft.slug);
    expect(body.title).toBe(draft.title);
    expect(body._status).toBe('draft');
  });
});
