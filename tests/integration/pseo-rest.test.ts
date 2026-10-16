import { beforeAll, afterAll, describe, expect, it } from 'vitest';

// Never import the application or initialize a database before checking this boundary.
const uri = new URL(process.env.DATABASE_URI || 'postgres://invalid/invalid');
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUN_DATABASE_TESTS !== '1' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname) || uri.pathname !== '/mock' ||
    uri.username !== 'mock' || process.env.NODE_ENV !== 'production' ||
    process.env.S3_ENDPOINT || process.env.VERCEL_DEPLOY_HOOK_URL) {
  throw new Error('REST integration tests require the disposable GitHub Actions loopback mock database, production seeding disabled, and no external storage/deploy hooks.');
}

describe('production Payload REST access using the committed schema on a disposable database', () => {
  let payload: any;
  let config: any;
  let rest: Record<string, any>;
  let adminToken: string;
  let editorToken: string;
  let published: any[];
  let draft: any;
  let template: any;
  let dataset: any;
  let media: any;
  const privateValues = ['PRIVATE-CSV-ROW', 'PRIVATE-KEYWORD'];

  const request = async (path: string, { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {}) => {
    const [route, query = ''] = path.split('?');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `JWT ${token}`;
    return rest[method](config)(new Request(`http://localhost:3000/api/${route}?${query}`, {
      method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), { params: Promise.resolve({ slug: route.split('/') }) });
  };

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    config = (await import('../../payload.config')).default;
    const routes = await import('@payloadcms/next/routes');
    rest = { GET: routes.REST_GET, POST: routes.REST_POST, PATCH: routes.REST_PATCH, DELETE: routes.REST_DELETE };
    payload = await getPayload({ config });
    const suffix = `${Date.now()}`;
    for (const role of ['admin', 'editor']) {
      const email = `rest-${role}-${suffix}@example.invalid`;
      const password = `Disposable-test-${suffix}-only!`;
      await payload.create({ collection: 'users', data: { name: `REST ${role}`, email, password, role } });
      const login = await payload.login({ collection: 'users', data: { email, password } });
      if (role === 'admin') adminToken = login.token;
      else editorToken = login.token;
    }
    const { default: sharp } = await import('sharp');
    const buffer = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#77aa44' } }).png().toBuffer();
    media = await payload.create({ collection: 'media',
      data: { alt: 'Disposable REST fixture' },
      file: { data: buffer, mimetype: 'image/png', name: `rest-${suffix}.png`, size: buffer.length },
    });
    template = await payload.create({ collection: 'pseo-templates', data: {
      name: 'Private REST fixture', slug: `rest-${suffix}`, headlineTemplate: '{{keyword}}',
      bodyTemplate: '<p>{{keyword}}</p>', metaTitleTemplate: '{{keyword}}',
      metaDescTemplate: 'Fixture only', slugTemplate: '{{keyword}}',
    } });
    dataset = await payload.create({ collection: 'pseo-datasets', data: {
      name: 'Private CSV fixture', template: template.id, csvFile: media.id,
      columns: ['PRIVATE-CSV-ROW'], status: 'ready',
    } });
    published = [];
    for (const [index, status] of ['published', 'published', 'draft'].entries()) {
      const doc = await payload.create({ collection: 'pseo-pages', context: { reseedVersions: true }, data: {
        slug: `rest-${suffix}-${index}`, status, template: template.id, dataset: dataset.id,
        keyword: 'PRIVATE-KEYWORD', variables: { row: 'PRIVATE-CSV-ROW' },
        headline: `Public heading ${index}`, bodyHtml: '<p>Public rendered content</p>',
        seo: { metaTitle: `Public title ${index}`, metaDescription: 'Public description', ogImage: media.id },
      } });
      if (status === 'published') published.push(doc);
      else draft = doc;
    }
  });

  afterAll(async () => { await payload?.destroy(); });

  it('serves every published ID through real REST pagination without a privileged credential', async () => {
    const ids: string[] = [];
    for (let page = 1; page <= 2; page++) {
      const response = await request(`pseo-pages?limit=1&page=${page}&sort=id&depth=10`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.totalDocs).toBe(2);
      expect(body.totalPages).toBe(2);
      expect(body.docs).toHaveLength(1);
      const doc = body.docs[0];
      ids.push(String(doc.id));
      expect(doc.status).toBe('published');
      expect(doc.headline).toContain('Public heading');
      expect(doc.seo.ogImage.id).toBe(media.id);
      for (const field of ['template', 'dataset', 'variables', 'keyword']) expect(doc).not.toHaveProperty(field);
      for (const value of privateValues) expect(JSON.stringify(body)).not.toContain(value);
    }
    expect(ids.sort()).toEqual(published.map(doc => String(doc.id)).sort());
  });

  it('cannot escape published filtering through draft queries, direct IDs, select or nested depth', async () => {
    const draftQuery = await request('pseo-pages?where[status][equals]=draft&depth=10');
    expect(draftQuery.status).toBe(200);
    expect((await draftQuery.json()).docs).toEqual([]);
    const byID = await request(`pseo-pages/${draft.id}?depth=10&draft=true`);
    expect([403, 404]).toContain(byID.status);
    const selected = await request(`pseo-pages/${published[0].id}?depth=10&select[template]=true&select[dataset]=true&select[variables]=true&select[keyword]=true&select[headline]=true`);
    expect(selected.status).toBe(200);
    const selectedDoc = await selected.json();
    for (const field of ['template', 'dataset', 'variables', 'keyword']) expect(selectedDoc).not.toHaveProperty(field);
    const orQuery = await request(`pseo-pages?where[or][0][id][equals]=${draft.id}&where[or][1][status][equals]=published`);
    expect((await orQuery.json()).docs.map((d: any) => String(d.id)).sort()).toEqual(published.map(d => String(d.id)).sort());
    for (const collection of ['pseo-templates', 'pseo-datasets']) {
      expect((await request(collection)).status).toBe(403);
    }
  });

  it('limits an authenticated editor to the same published public fields', async () => {
    const response = await request('pseo-pages?depth=10', { token: editorToken });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.totalDocs).toBe(2);
    for (const value of privateValues) expect(JSON.stringify(body)).not.toContain(value);
    expect([403, 404]).toContain((await request(`pseo-pages/${draft.id}`, { token: editorToken })).status);
    expect((await request('pseo-datasets', { token: editorToken })).status).toBe(403);
  });

  it('retains admin access to drafts and private source fields', async () => {
    const response = await request(`pseo-pages/${draft.id}?depth=1`, { token: adminToken });
    expect(response.status).toBe(200);
    const doc = await response.json();
    expect(doc.status).toBe('draft');
    expect(doc.variables.row).toBe('PRIVATE-CSV-ROW');
    expect(doc.keyword).toBe('PRIVATE-KEYWORD');
    expect(doc.template.id).toBe(template.id);
    expect(doc.dataset.id).toBe(dataset.id);
  });

  it('denies anonymous/editor writes and generator requests without changing content', async () => {
    const before = await payload.count({ collection: 'pseo-pages' });
    for (const token of [undefined, editorToken]) {
      expect([401, 403]).toContain((await request('pseo-pages', { method: 'POST', token, body: {} })).status);
      expect([401, 403]).toContain((await request(`pseo-pages/${published[0].id}`, { method: 'PATCH', token, body: { headline: 'Forbidden' } })).status);
      expect([401, 403]).toContain((await request(`pseo-pages/${published[0].id}`, { method: 'DELETE', token })).status);
      expect([401, 403]).toContain((await request('pseo/generate', { method: 'POST', token, body: { templateId: template.id, datasetId: dataset.id } })).status);
    }
    expect((await payload.count({ collection: 'pseo-pages' })).totalDocs).toBe(before.totalDocs);
    expect((await payload.findByID({ collection: 'pseo-pages', id: published[0].id })).headline).toBe(published[0].headline);
  });
});
