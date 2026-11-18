import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHostingerStagingReadOnly, validateStagingOrigin } from './hostinger-staging-preflight.mjs';

const origin = 'https://cms-qa.healthylifesstyles.com';
function makeResponse(url, status, data = null, extra = {}) {
  const headers = data === null ? extra : { 'content-type': 'application/json', ...extra };
  const res = new Response(data === null ? null : JSON.stringify(data), { status, headers });
  Object.defineProperty(res, 'url', { value: url });
  return res;
}
function mock(overrides = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    const parsed = new URL(url);
    const path = parsed.pathname;
    const draftOnly = parsed.searchParams.get('where[_status][equals]') === 'draft';
    // A separate override key lets tests inject a leaked draft on an explicit
    // filter without also triggering the preceding public sample request.
    const overrideKey = draftOnly ? `${path}#draft` : path;
    // A normal-sample override must not leak into the independent
    // explicit-draft query; only an intentional #draft override applies.
    const result = (draftOnly ? overrides[overrideKey] : overrides[path]) || (
      path === '/admin/login' ? [200, null] :
      path === '/api/deploy/pending' ? [403, null] :
      path === '/api/users' ? [403, null] :
      path === '/api/users/me' ? [200, { user: null }] :
      path === '/api/articles' || path === '/api/tools'
        ? [200, { docs: draftOnly ? [] : [{ _status: 'published' }] }] :
      path === '/api/pseo-pages' ? [200, { docs: [] }] : [500, null]
    );
    return makeResponse(url, ...result);
  };
  return { fetcher, calls };
}
test('refuses live origins, local hosts and unsafe staging targets before fetching', async () => {
  for (const value of [
    'https://cms.healthylifesstyles.com',
    'https://www.healthylifesstyles.com',
    'https://healthylifesstyles.com',
    'http://cms-qa.healthylifesstyles.com',
    'https://127.0.0.1', 'https://localhost',
    'https://[::1]', 'https://[::ffff:127.0.0.1]',
    'https://[2001:db8::1]',
    'https://cms-qa.healthylifesstyles.com/path',
    'https://user:pass@cms-qa.healthylifesstyles.com',
    'https://cms-qa.healthylifesstyles.com?token=x',
    'https://stage.example.org',
    'https://cms-qa.healthylifesstyles.com.evil.example',
    'https://cms-qa.healthylifesstyles.com.',
    'https://other.healthylifesstyles.example',
  ]) assert.throws(() => validateStagingOrigin(value));
  const client = mock();
  await assert.rejects(() => checkHostingerStagingReadOnly('https://cms.healthylifesstyles.com', client.fetcher));
  assert.equal(client.calls.length, 0);
});
test('valid staging performs only credential-free GET with manual redirect mode', async () => {
  const client = mock();
  const report = await checkHostingerStagingReadOnly(origin, client.fetcher);
  assert.equal(report.checks.length, 9);
  assert.equal(client.calls.length, 9);
  assert.deepEqual(report.checks.map(c => c.name).filter(n => n.includes('draft-filter')),
    ['anonymous-articles-draft-filter-denied', 'anonymous-tools-draft-filter-denied']);
  for (const { url, options } of client.calls) {
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cache, 'no-store');
    assert.ok(url.startsWith(origin + '/'));
    assert.equal(options.headers.Authorization, undefined);
  }
});
test('rejects exposed deployment queue or user directory', async () => {
  for (const path of ['/api/deploy/pending', '/api/users']) {
    const client = mock({ [path]: [200, { docs: [{ id: 1 }] }] });
    await assert.rejects(() => checkHostingerStagingReadOnly(origin, client.fetcher), /must be denied/);
  }
});
test('rejects non-null public user session', async () => {
  const client = mock({ '/api/users/me': [200, { user: { id: 1, role: 'admin' } }] });
  await assert.rejects(() => checkHostingerStagingReadOnly(origin, client.fetcher), /anonymous user must be null/);
});
test('rejects anonymous article/pSEO draft exposure', async () => {
  for (const overrides of [
    { '/api/articles': [200, { docs: [{ _status: 'draft' }] }] },
    { '/api/articles': [200, { docs: [{ slug: 'missing-status' }] }] },
    { '/api/articles': [200, { docs: [{ _status: null }] }] },
    { '/api/pseo-pages': [200, { docs: [{ status: 'draft' }] }] },
  ]) {
    const client = mock(overrides);
    await assert.rejects(() => checkHostingerStagingReadOnly(origin, client.fetcher), /draft exposed/);
  }
});
test('rejects outside redirect, malformed envelope and server error', async () => {
  const redirect = mock({ '/admin/login': [302, null, { location: 'https://evil.example/' }] });
  await assert.rejects(() => checkHostingerStagingReadOnly(origin, redirect.fetcher), /redirect/);
  const malformed = mock({ '/api/articles': [200, { docs: 'not an array' }] });
  await assert.rejects(() => checkHostingerStagingReadOnly(origin, malformed.fetcher), /malformed/);
  const serverError = mock({ '/api/users/me': [500, null] });
  await assert.rejects(() => checkHostingerStagingReadOnly(origin, serverError.fetcher), /unexpected HTTP 500/);
});
test('rejects exposed draft anywhere in an explicit articles/tools draft filter', async () => {
  for (const collection of ['/api/articles', '/api/tools']) {
    const client = mock({ [`${collection}#draft`]: [200, { docs: [{ _status: 'draft' }] }] });
    await assert.rejects(
      () => checkHostingerStagingReadOnly(origin, client.fetcher),
      /anonymous draft exposed/,
    );
    assert.equal(client.calls.every(c => c.options.method === 'GET'), true);
  }
});
test('rejects a draft or missing status from the ordinary public tool sample', async () => {
  for (const doc of [{ _status: 'draft' }, { slug: 'unknown-status' }]) {
    const client = mock({ '/api/tools': [200, { docs: [doc] }] });
    await assert.rejects(
      () => checkHostingerStagingReadOnly(origin, client.fetcher),
      /draft exposed, status unknown/,
    );
  }
});
test('an anonymous draft filter may be denied with 403 without leaking data', async () => {
  const client = mock({
    '/api/articles#draft': [403, null],
    '/api/tools#draft': [403, null],
  });
  const report = await checkHostingerStagingReadOnly(origin, client.fetcher);
  assert.equal(report.checks.length, 9);
  const draftChecks = report.checks.filter(c => c.name.includes('draft-filter'));
  assert.equal(draftChecks.length, 2);
  assert.ok(draftChecks.every(c => c.status === 403));
});

// Runtime env/Neon read-only smoke uses synthetic credentials in CI only.
import './hostinger-staging-runtime-evidence.test.mjs';
