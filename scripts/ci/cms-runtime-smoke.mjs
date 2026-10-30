/**
 * Hostinger-equivalent runtime smoke test for the NEXT PRODUCTION BUILD.
 * Deliberately refuses to run against anything except CI's disposable mock DB.
 * No real service tokens, production databases, CMS writes or IndexNow sends.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const EXPECTED_DB = 'postgres://mock:mock@localhost:5432/mock';
const EXPECTED_SECRET = 'ci-mock-payload-secret-not-production';
if (process.env.CI_CMS_RUNTIME_SMOKE !== '1' ||
    process.env.DATABASE_URI !== EXPECTED_DB ||
    process.env.PAYLOAD_SECRET !== EXPECTED_SECRET ||
    process.env.INDEXNOW_DISABLE !== 'true' ||
    process.env.INDEXNOW_LIVE_ENABLED === 'true' ||
    process.env.VERCEL_DEPLOY_HOOK_URL ||
    process.env.CHATGPT_DRAFT_BRIDGE_TOKEN) {
  throw new Error('Runtime smoke refuses non-disposable credentials or live integrations');
}

const port = 3219;
const origin = `http://127.0.0.1:${port}`;
const nextBin = 'node_modules/next/dist/bin/next';
const proc = spawn(process.execPath,
  [nextBin, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });

let exited = false;
let exitDescription = 'not exited';
let serverOutput = '';
for (const stream of [proc.stdout, proc.stderr]) {
  stream.on('data', chunk => {
    serverOutput = (serverOutput + String(chunk)).slice(-12000);
  });
}
proc.on('exit', (code, signal) => {
  exited = true;
  exitDescription = `code=${code}, signal=${signal}`;
});
proc.on('error', error => {
  exited = true;
  exitDescription = String(error);
});

async function request(path, init = {}) {
  return fetch(origin + path, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    ...init,
  });
}

try {
  const deadline = Date.now() + 90_000;
  let ready = false;
  let lastFailure = 'No HTTP response';
  while (Date.now() < deadline && !exited) {
    try {
      const res = await request('/admin/login');
      if ([200, 302, 303, 307, 308].includes(res.status)) {
        ready = true;
        break;
      }
      lastFailure = `/admin/login returned HTTP ${res.status}`;
    } catch (error) {
      lastFailure = String(error);
    }
    await sleep(750);
  }
  assert.ok(ready, `Next/Payload did not serve a login response: ${lastFailure}; process ${exitDescription}`);

  const checks = [
    {
      label: 'Cross-site manual public deploy POST',
      path: '/api/deploy',
    },
    {
      label: 'Cross-site IndexNow reconciliation POST',
      path: '/api/seo/reconcile-indexnow',
    },
  ];
  for (const check of checks) {
    const res = await request(check.path, {
      method: 'POST',
      headers: {
        Origin: 'https://untrusted.example.invalid',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirm: true, approvedUrls: [] }),
    });
    assert.equal(res.status, 403,
      `${check.label} must be forbidden without invoking hooks (got HTTP ${res.status})`);
    console.log(`PASS: ${check.label} rejected with 403`);
  }

  const pending = await request('/api/deploy/pending');
  assert.ok([401, 403].includes(pending.status),
    `Unauthenticated admin queue must be hidden (HTTP ${pending.status})`);
  console.log(`PASS: unauthenticated pending deploy queue denied (HTTP ${pending.status})`);

  const admin = await request('/admin');
  assert.ok([200, 302, 303, 307, 308].includes(admin.status),
    `Admin entrypoint did not load (HTTP ${admin.status})`);
  console.log(`PASS: built Next/Payload admin runtime responds (HTTP ${admin.status})`);
  console.log('PASS: disposable CMS runtime smoke; no live send, deploy or database touched.');
} catch (error) {
  console.error(String(error));
  console.error('Last bounded Next runtime logs:', serverOutput);
  process.exitCode = 1;
} finally {
  proc.kill('SIGTERM');
  await Promise.race([new Promise(resolve => proc.once('exit', resolve)), sleep(5000)]);
  if (!exited) proc.kill('SIGKILL');
}
