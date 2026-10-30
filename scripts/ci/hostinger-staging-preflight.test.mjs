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
    const path = new URL(url).pathname;
    const result = overrides[path] || (
      path === '/admin/login' ? [200, null] :
      path === '/api/deploy/pending' ? [403, null] :
      path === '/api/users' ? [403, null] :
      path === '/api/users/me' ? [200, { user: null }] :
      path === '/api/articles' ? [200, { docs: [{ _status: 'published' }] }] :
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
    'https://cms-qa.healthylifesstyles.com/path',
    'https://user:pass@cms-qa.healthylifesstyles.com',
    'https://cms-qa.healthylifesstyles.com?token=x',
  ]) assert.throws(() => validateStagingOrigin(value));
  const client = mock();
  await assert.rejects(() => checkHostingerStagingReadOnly('https://cms.healthylifesstyles.com', client.fetcher));
  assert.equal(client.calls.length, 0);
});
test('valid staging performs only credential-free GET with manual redirect mode', async () => {
  const client = mock();
  const report = await checkHostingerStagingReadOnly(origin, client.fetcher);
  assert.equal(report.checks.length, 6);
  assert.equal(client.calls.length, 6);
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
