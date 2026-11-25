/**
 * Read-only Hostinger STAGING preflight. No credentials, POSTs, cookies, CMS
 * writes, deploy hooks or IndexNow calls. This is not production acceptance.
 *
 * Execute only after owner-approved staging is available:
 * HLS_STAGING_ORIGIN=https://approved-staging-host.example \
 * HLS_STAGING_READ_ONLY_APPROVED=yes node scripts/ci/hostinger-staging-preflight.mjs
 */
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIVE_HOSTS = new Set([
  'healthylifesstyles.com',
  'www.healthylifesstyles.com',
  'cms.healthylifesstyles.com',
]);
export function validateStagingOrigin(input) {
  if (typeof input !== 'string' || !input || input.length > 253) {
    throw new TypeError('An explicit staging HTTPS origin is required');
  }
  let url;
  try { url = new URL(input); }
  catch { throw new TypeError('Invalid staging URL'); }
  // This probe is an operator-run network client. Never let an arbitrary
  // external domain (or a trailing-dot alias) become its GET target. The
  // isolated Payload runtime uses the same owned-subdomain trust boundary.
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.origin !== input ||
      !host.endsWith('.healthylifesstyles.com') ||
      url.username || url.password || url.search || url.hash ||
      url.pathname !== '/' || url.port || LIVE_HOSTS.has(host) ||
      host === 'localhost' || host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      // WHATWG URL.hostname wraps IPv6 in [] but net.isIP requires bare input.
      (host.startsWith('[') && host.endsWith(']')) || isIP(host) !== 0) {
    throw new Error('Staging target must be an explicit non-production HTTPS domain origin');
  }
  return url.origin;
}
async function jsonWithin(response, label, limit = 64 * 1024) {
  if (!(response.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    throw new Error(label + ': expected JSON');
  }
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    throw new Error(label + ': oversized JSON response');
  }
  if (!response.body) throw new Error(label + ': missing JSON body');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0, completed = false;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > limit) throw new Error(label + ': JSON exceeds size limit');
      chunks.push(item.value);
    }
    completed = true;
  } finally {
    if (!completed) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error(label + ': invalid JSON'); }
}
/**
 * Anonymous GET-only gates. A success confirms only these specific checks,
 * never the complete auth model, a real staging deployment or rollback.
 */
export async function checkHostingerStagingReadOnly(input, fetcher = fetch) {
  const origin = validateStagingOrigin(input);
  const report = { kind: 'hostinger-staging-read-only-preflight', host: new URL(origin).hostname, checks: [] };
  async function get(path, label) {
    const url = origin + path;
    const res = await fetcher(url, {
      method: 'GET', redirect: 'manual', cache: 'no-store', credentials: 'omit',
      headers: { Accept: 'application/json, text/html' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res || res.redirected || (res.url && res.url !== url)) {
      throw new Error(label + ': unexpected redirect or final URL');
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (label !== 'Admin login' || !location ||
          new URL(location, url).origin !== origin) {
        throw new Error(label + ': refused unexpected redirect');
      }
    }
    return res;
  }
  const admin = await get('/admin/login', 'Admin login');
  if (![200, 301, 302, 303, 307, 308].includes(admin.status)) {
    throw new Error('Admin login: unexpected HTTP ' + admin.status);
  }
  report.checks.push({ name: 'admin-login-reachable', status: admin.status });

  const queue = await get('/api/deploy/pending', 'Admin queue');
  if (![401, 403].includes(queue.status)) {
    throw new Error('Admin queue: unauthenticated read must be denied');
  }
  report.checks.push({ name: 'anonymous-queue-denied', status: queue.status });

  const users = await get('/api/users?limit=1', 'User directory');
  if (![401, 403].includes(users.status)) {
    throw new Error('User directory: anonymous access must be denied');
  }
  report.checks.push({ name: 'anonymous-user-directory-denied', status: users.status });

  const me = await get('/api/users/me', 'User session');
  if (me.status === 200) {
    const body = await jsonWithin(me, 'User session');
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.user != null) {
      throw new Error('User session: anonymous user must be null');
    }
  } else if (![401, 403].includes(me.status)) {
    throw new Error('User session: unexpected HTTP ' + me.status);
  }
  report.checks.push({ name: 'anonymous-session-unprivileged', status: me.status });

  const articles = await get(
    '/api/articles?draft=true&limit=3&depth=0&select[_status]=true&select[slug]=true',
    'Article visibility',
  );
  if (articles.status === 200) {
    const body = await jsonWithin(articles, 'Article visibility');
    if (!body || !Array.isArray(body.docs) ||
        body.docs.some(doc => !doc || doc._status !== 'published')) {
      throw new Error('Article visibility: draft exposed, status unknown, or malformed response');
    }
  } else if (![401, 403].includes(articles.status)) {
    throw new Error('Article visibility: unexpected HTTP ' + articles.status);
  }
  report.checks.push({ name: 'anonymous-article-draft-not-seen-in-sample', status: articles.status });

  const pseo = await get('/api/pseo-pages?where[status][equals]=draft&limit=3&depth=0', 'pSEO draft');
  if (pseo.status === 200) {
    const body = await jsonWithin(pseo, 'pSEO draft');
    if (!body || !Array.isArray(body.docs) || body.docs.length !== 0) {
      throw new Error('pSEO draft: anonymous draft exposed or malformed response');
    }
  } else if (![401, 403].includes(pseo.status)) {
    throw new Error('pSEO draft: unexpected HTTP ' + pseo.status);
  }
  report.checks.push({ name: 'anonymous-pseo-draft-denied', status: pseo.status });
  return report;
}
const invokedAsScript = process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  if (process.env.HLS_STAGING_READ_ONLY_APPROVED !== 'yes') {
    console.error('STOP: explicit read-only staging approval is required');
    process.exitCode = 2;
  } else {
    checkHostingerStagingReadOnly(process.env.HLS_STAGING_ORIGIN)
      .then(report => console.log(JSON.stringify(report, null, 2)))
      .catch(err => { console.error('NO-GO: ' + err.message); process.exitCode = 1; });
  }
}
