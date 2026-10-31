/**
 * Exercise the actual built Next/Payload server with isolated-staging settings
 * on GitHub Actions' disposable mock PostgreSQL. Never contacts Hostinger,
 * Neon, Vercel deploy hooks, IndexNow providers, or real users.
 *
 * This is runtime smoke evidence only, NOT staging deployment/rollback proof.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
