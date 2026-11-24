import { networkInterfaces } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Use the existing offline PostgreSQL harness only. These are disposable
// synthetic records, not editorial approvals or tests against a deployed CMS.
// Check boundaries before importing Payload or the application config.
const env = process.env;
const forbidden = Object.keys(env).filter(key => env[key] && (
  /^(S3_|AWS_|HLS_PRODUCTION_|HLS_STAGING_)/.test(key) ||
  ['VERCEL_DEPLOY_HOOK_URL', 'CHATGPT_DRAFT_BRIDGE_TOKEN', 'INDEXNOW_KEY',
    'INDEXNOW_API_KEY', 'GOOGLE_INDEXING_KEY', 'GOOGLE_APPLICATION_CREDENTIALS',
    'GITHUB_TOKEN', 'GH_TOKEN', 'HLS_ISOLATED_STAGING'].includes(key)
));
const interfaces = networkInterfaces();
if (env.HLS_CI_OFFLINE_CONTAINER !== '1' || env.GITHUB_ACTIONS !== 'true' ||
    env.GITHUB_REPOSITORY !== 'futurerotech/healthylifestyles-cms' ||
    !['local', 'github'].includes(env.HLS_CI_EXECUTION_CONTEXT ?? '') ||
    env.RUN_DATABASE_TESTS !== '1' || env.NODE_ENV !== 'production' ||
    env.DATABASE_URI !== 'postgres://mock:mock@localhost:5432/mock' ||
    env.PAYLOAD_SECRET !== 'ci-mock-payload-secret-not-production' ||
    env.INDEXNOW_DISABLE !== 'true' || env.INDEXNOW_LIVE_ENABLED !== 'false' ||
    forbidden.length || Object.keys(interfaces).length !== 1 ||
    !interfaces.lo?.length || interfaces.lo.some(n => !n.internal)) {
  throw new Error('Medical-review REST tests require the existing isolated loopback-only disposable PostgreSQL harness.');
}

const REVIEWER = 'Synthetic integration fixture only (not a clinical reviewer)';
const MESSAGE = /requires medical review before it can be enabled and published/;
type Doc = Record<string, any>;

describe('Tools medical-review guard through actual Payload operations', () => {
  let payload: any;
  let config: any;
  let handlers: Record<string, any>;
  let token: string;
  let category: number;
  let serial = 0;
  const suffix = `${Date.now()}-medical-review`;
  const fixture = (over: Doc = {}): Doc => {
    const slug = `fixture-${suffix}-${++serial}`;
    return { name: slug, slug, category, toolType: 'formula',
      outputs: [{ key: 'result', label: 'Result', expression: '1+1' }],
      enabled: true, riskLevel: 'high', medicalReviewRequired: false,
      medicallyReviewed: false, reviewedBy: null, _status: 'draft', ...over };
  };
  const request = async (path: string, method = 'GET', data?: unknown, anonymous = false) => {
    const [route, query = ''] = path.split('?');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!anonymous) headers.Authorization = `JWT ${token}`;
    const response: Response = await handlers[method](config)(new Request(`http://localhost:3000/api/${route}?${query}`, {
      method, headers, ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }), { params: Promise.resolve({ slug: route.split('/') }) });
    return { status: response.status, ok: response.ok, body: await response.json() };
  };
  const stored = (id: number, draft = false): Promise<Doc> => payload.findByID({ collection: 'tools', id, depth: 0, draft });
  const count = (slug: string) => payload.count({ collection: 'tools', where: { slug: { equals: slug } } });
  const create = async (over: Doc = {}, draft = true): Promise<Doc> => {
    const r = await request(`tools?draft=${draft}`, 'POST', fixture(over));
    expect(r.ok, `fixture create returned HTTP ${r.status}`).toBe(true);
    expect(r.body.doc?.id).toBeDefined();
    return r.body.doc;
  };
  const reject = async (id: number, delta: Doc, draft = false) => {
    const before = await stored(id);
    const r = await request(`tools/${id}?draft=${draft}`, 'PATCH', delta);
    expect(r.ok, 'unsafe update must not succeed').toBe(false);
    expect(await stored(id)).toEqual(before);
  };
  const absentFromPublic = async (id: number) => {
    const r = await request(`tools?draft=false&depth=0&where[id][equals]=${id}&where[enabled][equals]=true&where[_status][equals]=published`, 'GET', undefined, true);
    expect(r.status).toBe(200);
    expect(r.body.docs).toEqual([]);
  };

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    config = (await import('../../payload.config')).default;
    const rest = await import('@payloadcms/next/routes');
    handlers = { GET: rest.REST_GET, POST: rest.REST_POST, PATCH: rest.REST_PATCH };
    payload = await getPayload({ config });
    expect(payload.db.push).toBe(false);
    const target = await payload.db.pool.query('SELECT current_database() AS db, current_user AS role');
    expect(target.rows[0]).toEqual({ db: 'mock', role: 'mock' });
    // The existing offline harness starts a new database. Never operate on a
    // restored tool inventory or shared authoring database.
    expect((await payload.count({ collection: 'tools' })).totalDocs).toBe(0);
    const email = `medical-review-${suffix}@example.invalid`;
    const password = `Disposable-test-${suffix}-only!`;
    await payload.create({ collection: 'users', data: { name: 'Synthetic integration admin', email, password, role: 'admin' } });
    token = (await payload.login({ collection: 'users', data: { email, password } })).token;
    expect(token).toBeTruthy();
    category = (await payload.create({ collection: 'categories', data: {
      name: `Synthetic medical review ${suffix}`, slug: `synthetic-${suffix}`, kind: 'tool',
    } })).id;
  });

  afterAll(async () => { await payload?.destroy(); });

  it('blocks unsafe creation; a conflicting draft=true request can only yield a private unreviewed draft', async () => {
    const unsafe = fixture({ _status: 'published' });
    const rejected = await request('tools?draft=false', 'POST', unsafe);
    expect(rejected.ok).toBe(false);
    expect((await count(unsafe.slug)).totalDocs).toBe(0);
    // Payload forces _status=draft before hooks when draft=true, so the
    // conflicting request may only ever yield a private, unreviewed draft.
    const conflicting = fixture({ _status: 'published' });
    const r = await request('tools?draft=true', 'POST', conflicting);
    if (!r.ok) {
      expect((await count(conflicting.slug)).totalDocs).toBe(0);
    } else {
      expect(await stored(r.body.doc.id, true)).toMatchObject({ _status: 'draft',
        medicalReviewRequired: true, medicallyReviewed: false });
      await absentFromPublic(r.body.doc.id);
    }
  });

  it('retains legitimate unreviewed drafts and enforces required=true', async () => {
    const doc = await create();
    expect(doc.medicalReviewRequired).toBe(true);
    expect(doc.medicallyReviewed).toBe(false);
    expect(doc._status).toBe('draft');
    await absentFromPublic(doc.id);
    const r = await request(`tools/${doc.id}?draft=true`, 'PATCH', { _status: 'draft', featured: true });
    expect(r.ok).toBe(true);
    expect((await stored(doc.id, true)).featured).toBe(true);
    await absentFromPublic(doc.id);
  });

  it('retains the native implicit draft creation workflow', async () => {
    const data = fixture();
    delete data._status;
    const r = await request('tools?draft=true', 'POST', data);
    expect(r.ok).toBe(true);
    expect(r.body.doc).toMatchObject({ _status: 'draft', medicalReviewRequired: true, medicallyReviewed: false });
    await absentFromPublic(r.body.doc.id);
  });

  it('blocks partial publication both with draft=false and draft=true', async () => {
    const doc = await create();
    const before = await stored(doc.id, true);
    for (const draft of [false, true]) {
      await reject(doc.id, { _status: 'published' }, draft);
      expect(await stored(doc.id, true)).toEqual(before);
      await absentFromPublic(doc.id);
    }
  });

  it('blocks enabling a disabled published tool, even if the requirement is cleared in the delta', async () => {
    const doc = await create({ enabled: false, _status: 'published' }, false);
    await reject(doc.id, { enabled: true, _status: 'published' });
    await reject(doc.id, { enabled: true, medicalReviewRequired: false, _status: 'published' });
    expect((await stored(doc.id)).medicalReviewRequired).toBe(true);
    await absentFromPublic(doc.id);
  });

  it('blocks blank reviewer and preserves a legitimate synthetic attestation across unrelated edits', async () => {
    const doc = await create();
    await reject(doc.id, { _status: 'published', medicallyReviewed: true, reviewedBy: '  ' });
    const r = await request(`tools/${doc.id}?draft=false`, 'PATCH', {
      _status: 'published', medicallyReviewed: true, reviewedBy: REVIEWER,
    });
    expect(r.ok).toBe(true);
    const edit = await request(`tools/${doc.id}?draft=false`, 'PATCH', { _status: 'published', featured: true });
    expect(edit.ok).toBe(true);
    expect(await stored(doc.id)).toMatchObject({ _status: 'published', enabled: true,
      medicallyReviewed: true, medicalReviewRequired: true, reviewedBy: REVIEWER, featured: true });
    await reject(doc.id, { _status: 'published', medicallyReviewed: false });
    await reject(doc.id, { _status: 'published', reviewedBy: null });
  });

  it('keeps a newer unreviewed draft separate from the approved published snapshot', async () => {
    const doc = await create({ _status: 'published', medicallyReviewed: true, reviewedBy: REVIEWER }, false);
    const published = await stored(doc.id);
    const r = await request(`tools/${doc.id}?draft=true`, 'PATCH', {
      _status: 'draft', medicallyReviewed: false, reviewedBy: null, featured: true,
    });
    expect(r.ok).toBe(true);
    expect(await stored(doc.id)).toEqual(published);
    expect(await stored(doc.id, true)).toMatchObject({ _status: 'draft', medicallyReviewed: false });
    // A partial publish must not turn the unreviewed draft into public
    // content. Accept a successful no-op against the old approved snapshot
    // only if the draft-only change and revoked attestation remain private.
    const partial = await request(`tools/${doc.id}?draft=false`, 'PATCH', { _status: 'published' });
    if (partial.ok) {
      expect(await stored(doc.id)).toMatchObject({ _status: 'published',
        featured: published.featured, medicallyReviewed: true, reviewedBy: REVIEWER });
    } else {
      expect(await stored(doc.id)).toEqual(published);
    }
    await reject(doc.id, { _status: 'published', medicallyReviewed: false, reviewedBy: null });
  });

  it('applies the guard to Local API updates and still invokes the real formula validator', async () => {
    const doc = await create();
    await expect(payload.update({ collection: 'tools', id: doc.id, draft: false,
      data: { _status: 'published' } })).rejects.toThrow(MESSAGE);
    await expect(payload.update({ collection: 'tools', id: doc.id, draft: true,
      data: { _status: 'draft', toolType: 'formula', outputs: [{ key: 'result', label: 'Result', expression: 'x=1' }] } })).rejects.toThrow(/Unsupported expression/);
    await absentFromPublic(doc.id);
  });

  it('does not let a bulk REST update enable two unreviewed required tools', async () => {
    const docs = [await create({ enabled: false, _status: 'published' }, false), await create({ enabled: false, _status: 'published' }, false)];
    const before = await Promise.all(docs.map(d => stored(d.id)));
    const ids = docs.map(d => d.id).join(',');
    const r = await request(`tools?draft=false&where[id][in]=${ids}`, 'PATCH', { enabled: true, _status: 'published' });
    // Payload can return per-document errors with a successful HTTP status.
    if (r.ok) {
      expect(r.body.docs).toHaveLength(0);
      expect(r.body.errors).toHaveLength(2);
    }
    expect(await Promise.all(docs.map(d => stored(d.id)))).toEqual(before);
    for (const doc of docs) await absentFromPublic(doc.id);
  });

  it('never restores an unreviewed draft version into an enabled published tool', async () => {
    const doc = await create();
    const versions = await payload.findVersions({ collection: 'tools', where: { parent: { equals: doc.id } }, depth: 0 });
    const version = versions.docs.find((v: Doc) => v.version?._status === 'draft' && v.version?.medicallyReviewed === false);
    expect(version?.id).toBeDefined();
    const before = await stored(doc.id);
    const r = await request(`tools/versions/${version.id}`, 'POST');
    if (!r.ok) expect(await stored(doc.id)).toEqual(before);
    const restored = await stored(doc.id);
    expect(restored.medicallyReviewed).toBe(false);
    expect(restored.enabled === true && restored._status === 'published').toBe(false);
    await absentFromPublic(doc.id);
  });
});
