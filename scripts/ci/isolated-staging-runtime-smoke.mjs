/**
 * Exercise the actual built Next/Payload server with isolated-staging settings
 * on GitHub Actions' disposable mock PostgreSQL. Never contacts Hostinger,
 * Neon, Vercel deploy hooks, IndexNow providers, or real users.
 *
 * This is runtime smoke evidence only, NOT staging deployment/rollback proof.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const STAGING = 'https://cms-qa.healthylifesstyles.com';
const DB = 'postgres://mock:mock@localhost:5432/mock';
const MOCK_SECRET = 'ci-mock-payload-secret-not-production';
const e = process.env;
if (e.GITHUB_ACTIONS !== 'true' ||
    e.CI_ISOLATED_STAGING_RUNTIME_SMOKE !== '1' ||
    e.DATABASE_URI !== DB ||
    e.PAYLOAD_SECRET !== MOCK_SECRET ||
    e.HLS_ISOLATED_STAGING !== 'true' ||
    e.HLS_STAGING_CMS_ORIGIN !== STAGING ||
    e.SERVER_URL !== STAGING ||
    e.INDEXNOW_DISABLE !== 'true' ||
    e.INDEXNOW_LIVE_ENABLED !== 'false' ||
    e.VERCEL_DEPLOY_HOOK_URL ||
    e.CHATGPT_DRAFT_BRIDGE_TOKEN) {
  throw new Error('REFUSED: isolated runtime smoke requires CI-only mock DB and disabled providers');
}

const port = 3221;
const localOrigin = 'http://127.0.0.1:' + port;
const proc = spawn(process.execPath, [
  'node_modules/next/dist/bin/next', 'start',
  '--hostname', '127.0.0.1', '--port', String(port),
], {
  env: { ...e, NODE_ENV: 'production', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let exited = false;
let diagnosticTail = '';
let exitCode = 'running';
for (const stream of [proc.stdout, proc.stderr]) {
  stream.on('data', (chunk) => {
    diagnosticTail = (diagnosticTail + String(chunk)).slice(-6000);
  });
}
proc.on('error', (error) => {
  exited = true;
  exitCode = error.name;
});
proc.on('exit', (code, signal) => {
  exited = true;
  exitCode = String(code) + '/' + String(signal);
});

async function get(path, opts = {}) {
  return fetch(localOrigin + path, {
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
    ...opts,
  });
}

try {
  const deadline = Date.now() + 90_000;
  let loginStatus;
  while (!exited && Date.now() < deadline) {
    try {
      const response = await get('/admin/login');
      if ([200, 301, 302, 303, 307, 308].includes(response.status)) {
        loginStatus = response.status;
        break;
      }
    } catch {
      // Next/Payload may still be starting; retry only the idempotent GET.
    }
    await sleep(750);
  }
  assert.ok(loginStatus, 'Built staging CMS did not serve /admin/login; process ' + exitCode);
  console.log('PASS: built isolated CMS admin login reachable (HTTP ' + loginStatus + ')');

  const queue = await get('/api/deploy/pending', {
    headers: { Origin: STAGING },
  });
  assert.ok([401, 403].includes(queue.status),
    'Anonymous staging visitor must not access deployment queue (HTTP ' + queue.status + ')');
  console.log('PASS: anonymous staging queue read denied (HTTP ' + queue.status + ')');

  const attempts = [
    { path: '/api/deploy', origin: STAGING, confirm: false, label: 'staging-origin Vercel deployment' },
    { path: '/api/deploy', origin: 'https://cms.healthylifesstyles.com', confirm: false, label: 'live-origin Vercel deployment' },
    { path: '/api/seo/reconcile-indexnow', origin: 'https://cms.healthylifesstyles.com', confirm: false, label: 'live-origin IndexNow preview' },
    { path: '/api/seo/reconcile-indexnow', origin: STAGING, confirm: true, label: 'unauthenticated staging IndexNow submit' },
  ];
  for (const attempt of attempts) {
    const response = await get(attempt.path, {
      method: 'POST',
      headers: { Origin: attempt.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: attempt.confirm }),
    });
    assert.equal(response.status, 403,
      'Forbidden ' + attempt.label + ' unexpectedly returned HTTP ' + response.status);
    console.log('PASS: ' + attempt.label + ' rejected with HTTP 403');
  }
  const temp = e.RUNNER_TEMP;
  assert.ok(temp?.startsWith('/') && temp !== '/', 'Missing runner temporary directory');
  const fixture = join(temp, 'hls-isolated-staging-roles.json');
  const tokens = JSON.parse(await readFile(fixture, 'utf8'));
  await unlink(fixture);
  for (const role of ['admin', 'editor']) {
    assert.equal(typeof tokens[role + 'Token'], 'string', 'Missing mock-only role token');
  }
  const queueAuth = async (token) => get('/api/deploy/pending', {
    headers: { Authorization: 'JWT ' + token, Origin: STAGING },
  });
  assert.equal((await queueAuth(tokens.editorToken)).status, 403, 'Editor queue access must be denied');
  const adminQueue = await queueAuth(tokens.adminToken);
  assert.equal(adminQueue.status, 200, 'Admin queue access must succeed');
  const state = await adminQueue.json();
  assert.equal(state.stagingPreviewOnly, true, 'Built staging runtime must report preview-only status');

  const adminSubmit = await get('/api/seo/reconcile-indexnow', {
    method: 'POST',
    headers: {
      Authorization: 'JWT ' + tokens.adminToken,
      Origin: STAGING,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirm: true }),
  });
  assert.equal(adminSubmit.status, 403, 'Authenticated staging IndexNow submit must be denied');
  const adminDeploy = await get('/api/deploy', {
    method: 'POST',
    headers: { Authorization: 'JWT ' + tokens.adminToken, Origin: STAGING },
  });
  assert.equal(adminDeploy.status, 403, 'Authenticated staging deploy must be denied');
  // Exercise actual registered Payload routes through the compiled HTTP server.
  // Every provider-backed route must reject before reading user payloads,
  // issuing requests, creating records, or consuming AI/USDA quota.
  const outboundPaths = [
    '/api/ai-assist', '/api/ai-seo', '/api/ai-writing',
    '/api/generate-article', '/api/regenerate-section',
    '/api/suggest-titles', '/api/verify-sources',
    '/api/analyze-recipe', '/api/push/send',
    '/api/audience/csv-import',
    '/api/pseo/generate', '/api/audit/run',
  ];
  for (const path of outboundPaths) {
    const response = await get(path, {
      method: 'POST',
      headers: {
        Authorization: 'JWT ' + tokens.adminToken,
        Origin: STAGING, 'Content-Type': 'application/json',
      },
      body: '{}',
    });
    assert.equal(response.status, 503,
      'Built isolated staging outbound route must fail closed: ' + path + ' (HTTP ' + response.status + ')');
  }
  for (const path of ['/api/backlinks/check', '/api/audit/schema-flags/cron']) {
    if (path.includes('schema-flags')) continue; // Read-only report is an intentional dry-run.
    const response = await get(path, {
      headers: { Authorization: 'JWT ' + tokens.adminToken, Origin: STAGING },
    });
    assert.equal(response.status, 503,
      'Built isolated staging external audit route must fail closed: ' + path + ' (HTTP ' + response.status + ')');
  }
  // Payload collection route /api/subscribers/:id can shadow the separately
  // registered /api/subscribers/sync endpoint. Check handler in isolated DB
  // integration instead of pretending HTTP 404 proves its 503 guard.
  const shadowed = await get('/api/subscribers/sync', {
    method: 'POST',
    headers: { Authorization: 'JWT ' + tokens.adminToken, Origin: STAGING,
      'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(shadowed.status, 404,
    'Subscriber sync route behavior changed: audit registration before release');
  console.log('PASS: subscriber sync HTTP currently 404 (route shadowed); handler guard tested separately.');
  console.log('PASS: built staging blocks all listed provider-backed Payload HTTP routes.');
  console.log('PASS: real admin/editor JWTs on built staging HTTP boundary; preview-only enforced.');
  console.log('PASS: isolated staging mock runtime; zero production API or database access.');
} catch (error) {
  console.error('NO-GO: ' + String(error));
  console.error('Bounded mock-runtime diagnostics:', diagnosticTail);
  process.exitCode = 1;
} finally {
  proc.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => proc.once('exit', resolve)), sleep(5000)]);
  if (!exited) proc.kill('SIGKILL');
}
