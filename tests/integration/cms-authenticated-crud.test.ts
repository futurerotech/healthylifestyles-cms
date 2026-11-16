/**
 * Real Payload REST CRUD smoke test, strictly against GitHub's ephemeral mock
 * PostgreSQL service. No live Neon, Hostinger, mail, S3 or deploy endpoint.
 *
 * This is NOT an assertion that the isolated Neon staging clone has passed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Fail closed before importing/initializing Payload or opening any connection.
if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.CI !== 'true' ||
    process.env.RUN_DATABASE_TESTS !== '1' ||
    process.env.GITHUB_REPOSITORY !== 'futurerotech/healthylifestyles-cms' ||
    process.env.DATABASE_URI !== 'postgres://mock:mock@localhost:5432/mock' ||
    process.env.PAYLOAD_SECRET !== 'ci-mock-payload-secret-not-production' ||
    process.env.NODE_ENV !== 'production' ||
    process.env.INDEXNOW_DISABLE !== 'true' ||
    process.env.S3_ENDPOINT || process.env.VERCEL_DEPLOY_HOOK_URL) {
  throw new Error('CMS_REST_CRUD_MOCK_ONLY');
}

describe('real CMS authenticated REST CRUD on disposable PostgreSQL', () => {
  let payload: any;
  let config: any;
  let rest: Record<string, any>;
  let adminToken: string;
  let editorToken: string;
  let adminId: string | number;
  let editorId: string | number;
  let slug: string;
  const createdTagIds: Array<string | number> = [];

  const request = async (
    path: string,
    { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {},
  ) => {
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
    rest = {
      GET: routes.REST_GET, POST: routes.REST_POST,
      PATCH: routes.REST_PATCH, DELETE: routes.REST_DELETE,
    };
    payload = await getPayload({ config });
    expect(payload.db.push).toBe(false);
    const identity = (await payload.db.pool.query(
      'SELECT current_database() AS db, session_user AS login',
    )).rows[0];
    expect(identity).toMatchObject({ db: 'mock', login: 'mock' });

    const nonce = `${Date.now()}-${process.pid}`;
    slug = `hls-crud-ci-${nonce}`;
    for (const role of ['admin', 'editor'] as const) {
      const email = `hls-${role}-ci-${nonce}@example.invalid`;
      const password = `Disposable-${nonce}-only!`;
      const user = await payload.create({
        collection: 'users', data: { name: `CI ${role}`, email, password, role },
      });
      const login = await payload.login({ collection: 'users', data: { email, password } });
      expect(login.token).toBeTruthy();
      if (role === 'admin') { adminToken = login.token; adminId = user.id; }
      else { editorToken = login.token; editorId = user.id; }
    }
  });

  afterAll(async () => {
    if (!payload) return;
    try {
      for (const id of createdTagIds) {
        try { await payload.delete({ collection: 'tags', id, overrideAccess: true }); }
        catch { /* already removed or test interrupted */ }
      }
      for (const id of [editorId, adminId].filter(Boolean)) {
        try { await payload.delete({ collection: 'users', id, overrideAccess: true }); }
        catch { /* teardown still destroys disposable pool */ }
      }
    } finally {
      await payload.destroy();
    }
  });

  it('blocks anonymous tag writes and user enumeration', async () => {
    expect([401, 403]).toContain((await request('tags', {
      method: 'POST', body: { name: 'anonymous write should fail', slug: `${slug}-anon` },
    })).status);
    expect([401, 403]).toContain((await request('users')).status);
  });

  it('performs actual editor tag CRUD over Payload REST, then verifies removal', async () => {
    const created = await request('tags', {
      method: 'POST', token: editorToken,
      body: { name: 'CI temporary tag', slug, description: 'created in mock DB' },
    });
    expect(created.status).toBe(201);
    const { doc: tag } = await created.json();
    expect(tag.id).toBeDefined();
    createdTagIds.push(tag.id);
    expect(tag.slug).toBe(slug);

    const publicGet = await request(`tags/${tag.id}`);
    expect(publicGet.status).toBe(200);
    expect((await publicGet.json()).name).toBe('CI temporary tag');

    for (const [method, body] of [
      ['PATCH', { name: 'anonymous edit denied' }],
      ['DELETE', undefined],
    ] as const) {
      const response = await request(`tags/${tag.id}`, { method, body });
      expect([401, 403]).toContain(response.status);
    }

    const patched = await request(`tags/${tag.id}`, {
      method: 'PATCH', token: editorToken,
      body: { name: 'CI temporary tag updated', description: 'editor update' },
    });
    expect(patched.status).toBe(200);
    const updated = await request(`tags/${tag.id}`);
    expect(updated.status).toBe(200);
    expect((await updated.json()).description).toBe('editor update');

    const removed = await request(`tags/${tag.id}`, { method: 'DELETE', token: editorToken });
    expect(removed.status).toBe(200);
    expect((await request(`tags/${tag.id}`)).status).toBe(404);
    const remaining = await payload.find({
      collection: 'tags', where: { slug: { equals: slug } },
    });
    expect(remaining.totalDocs).toBe(0);
  });

  it('allows admin REST CRUD while editor cannot manage staff accounts', async () => {
    const adminTagSlug = `${slug}-admin`;
    const created = await request('tags', {
      method: 'POST', token: adminToken,
      body: { name: 'CI admin only fixture', slug: adminTagSlug },
    });
    expect(created.status).toBe(201);
    const { doc: tag } = await created.json();
    createdTagIds.push(tag.id);
    expect((await request(`tags/${tag.id}`, {
      method: 'PATCH', token: adminToken, body: { description: 'admin updated' },
    })).status).toBe(200);
    expect([401, 403]).toContain((await request(`users/${adminId}`, {
      method: 'DELETE', token: editorToken,
    })).status);
    expect([401, 403]).toContain((await request('users', {
      method: 'POST', token: editorToken,
      body: { name: 'forbidden', email: `forbidden-${slug}@example.invalid`,
        password: 'MustNotExist123!', role: 'admin' },
    })).status);
    const editor = await payload.findByID({ collection: 'users', id: editorId });
    expect(editor.role).toBe('editor');
    const removed = await request(`tags/${tag.id}`, { method: 'DELETE', token: adminToken });
    expect(removed.status).toBe(200);
    expect((await request(`tags/${tag.id}`)).status).toBe(404);
  });
});
