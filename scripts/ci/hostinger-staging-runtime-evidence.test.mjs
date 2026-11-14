import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  screenHostingerStagingRuntime as screen,
  verifyHostingerStagingDatabaseReadOnly as check,
  FORBIDDEN_STAGING_CREDENTIALS,
} from './hostinger-staging-runtime-evidence.mjs';

const stageHost = 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech';
const productionHost = 'ep-lucky-voice-ad5egz8d.c-2.us-east-1.aws.neon.tech';
const safe = Object.freeze({
  HLS_STAGING_READ_ONLY_APPROVED: 'yes',
  HLS_ISOLATED_STAGING: 'true',
  NODE_ENV: 'production',
  HLS_STAGING_CMS_ORIGIN: 'https://cms-qa.healthylifesstyles.com',
  SERVER_URL: 'https://cms-qa.healthylifesstyles.com',
  HLS_STAGING_DATABASE_HOST: stageHost,
  HLS_PRODUCTION_DATABASE_HOST: productionHost,
  INDEXNOW_DISABLE: 'true',
  INDEXNOW_LIVE_ENABLED: 'false',
  ALLOW_DB_PUSH: 'false',
  S3_ENDPOINT: 'https://c401e58f54e7278facea9f55e4186da6.r2.cloudflarestorage.com',
  S3_REGION: 'auto',
  S3_BUCKET: 'healthylifestyles-staging-media',
  HLS_STAGING_R2_BUCKET: 'healthylifestyles-staging-media',
  HLS_PRODUCTION_R2_BUCKET: 'healthylifestyles-media',
  S3_ACCESS_KEY_ID: 'synthetic-access',
  S3_SECRET_ACCESS_KEY: 'synthetic-secret',
  DATABASE_URI: 'postgres://neondb_owner:synthetic-password@' + stageHost +
    '/neondb?sslmode=require&channel_binding=require',
});

function fixture(patch = {}) {
  const calls = [];
  let ended = false;
  const makeClient = options => {
    calls.push({ action: 'constructed', options });
    return {
      connection: { stream: { encrypted: true, authorized: true } },
      async connect() { calls.push({ action: 'connect' }); },
      async query(sql) {
        calls.push({ action: 'query', sql });
        return { rows: [{
          database_name: 'neondb', role_name: 'neondb_owner',
          version_num: 180006, read_only: 'on', ...(patch.row || {}),
        }] };
      },
      async end() { ended = true; calls.push({ action: 'end' }); },
    };
  };
  return { calls, makeClient, get ended() { return ended; } };
}

test('pure runtime config check never pretends to prove provider ownership or R2 IAM', () => {
  const x = screen(safe);
  assert.equal(x.stagingRuntimeEnvironmentScreened, true);
  assert.equal(x.configuredNeonStagingTargetScreened, true);
  assert.equal(x.postgresSessionVerified, false);
  assert.equal(x.hostingerApplicationIdentityVerified, false);
  assert.equal(x.r2BucketPermissionBoundaryVerified, false);
  assert.equal(x.productionReleaseAuthorized, false);
  assert.equal(JSON.stringify(x).includes('synthetic-'), false);
});

test('one verified-TLS read-only SELECT confirms staging DB identity, not deployment or R2 scope', async () => {
  const client = fixture();
  const x = await check(safe, client.makeClient);
  assert.equal(x.postgresSessionVerified, true);
  assert.equal(x.postgresClientTlsVerified, true);
  assert.equal(x.readOnlySessionVerified, true);
  assert.equal(x.hostingerApplicationIdentityVerified, false);
  assert.equal(x.r2BucketPermissionBoundaryVerified, false);
  assert.equal(x.productionReleaseAuthorized, false);
  assert.equal(client.ended, true);
  const config = client.calls[0].options;
  assert.equal(config.ssl.servername, stageHost);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.options, '-c default_transaction_read_only=on');
  assert.equal(config.enableChannelBinding, true);
  assert.equal(new URL(config.connectionString).search, '');
  const queries = client.calls.filter(x => x.action === 'query');
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /^SELECT /);
  assert.deepEqual(client.calls.map(c => c.action), ['constructed', 'connect', 'query', 'end']);
});

test('production host, credential/query injection and missing staging safety all reject before client creation', async () => {
  const unsafe = [
    { HLS_ISOLATED_STAGING: undefined },
    { HLS_ISOLATED_STAGING: 'false' },
    { NODE_ENV: 'development' },
    { HLS_STAGING_READ_ONLY_APPROVED: '' },
    { HLS_STAGING_CMS_ORIGIN: 'https://cms.healthylifesstyles.com' },
    { SERVER_URL: 'https://cms.healthylifesstyles.com' },
    { HLS_STAGING_DATABASE_HOST: productionHost },
    { HLS_PRODUCTION_DATABASE_HOST: stageHost },
    { INDEXNOW_DISABLE: 'false' },
    { INDEXNOW_LIVE_ENABLED: 'true' },
    { ALLOW_DB_PUSH: 'true' },
    { INDEXNOW_KEY: 'synthetic-indexing-key' },
    { GOOGLE_INDEXING_KEY: 'synthetic-indexing-key' },
    { GOOGLE_INDEXING_CREDENTIALS_B64: 'synthetic-indexing-key' },
    { VERCEL_DEPLOY_HOOK_URL: 'https://deploy.example.test' },
    { CHATGPT_DRAFT_BRIDGE_TOKEN: 'synthetic' },
    { S3_BUCKET: 'healthylifestyles-media' },
    { HLS_STAGING_R2_BUCKET: 'healthylifestyles-media' },
    { HLS_PRODUCTION_R2_BUCKET: 'healthylifestyles-staging-media' },
    { S3_ENDPOINT: 'https://other.example.test' },
    { S3_REGION: 'us-east-1' },
    { S3_ACCESS_KEY_ID: '' },
    { S3_SECRET_ACCESS_KEY: '' },
    { S3_PUBLIC_URL: 'https://media.healthylifesstyles.com' },
    { DATABASE_URI: safe.DATABASE_URI.replace(stageHost, productionHost) },
    { DATABASE_URI: safe.DATABASE_URI.replace('neon.tech', 'neon.tech.evil.test') },
    { DATABASE_URI: safe.DATABASE_URI.replace('/neondb', '/prod') },
    { DATABASE_URI: safe.DATABASE_URI.replace('synthetic-password@', '@') },
    { DATABASE_URI: safe.DATABASE_URI + '&sslmode=disable' },
    { DATABASE_URI: safe.DATABASE_URI + '&host=evil.test' },
    { DATABASE_URI: safe.DATABASE_URI + '&sslmode=require' },
    { DATABASE_URI: safe.DATABASE_URI.replace('sslmode=require', 'sslmode=prefer') },
  ];
  for (const patch of unsafe) {
    const env = { ...safe, ...patch };
    const client = fixture();
    assert.throws(() => screen(env), /NO-GO/);
    await assert.rejects(check(env, client.makeClient), /NO-GO/);
    assert.equal(client.calls.length, 0);
  }
});

test('TLS errors, wrong PG identity, or non-read-only session fail closed and clean up', async () => {
  for (const row of [
    { database_name: 'prod' },
    { role_name: 'another_role' },
    { version_num: 160000 },
    { read_only: 'off' },
  ]) {
    const client = fixture({ row });
    await assert.rejects(check(safe, client.makeClient), /NO-GO/);
    assert.equal(client.ended, true);
  }
  let ended = false;
  await assert.rejects(check(safe, () => ({
    connection: { stream: { encrypted: true, authorized: false } },
    async connect() {},
    async query() { throw new Error('should-not-query'); },
    async end() { ended = true; },
  })), /NO-GO/);
  assert.equal(ended, true);
});

test('all failure paths sanitize secrets and never return the input connection URI', async () => {
  const leak = 'synthetic-private-token';
  const env = { ...safe, DATABASE_URI: safe.DATABASE_URI.replace('synthetic-password', leak) };
  await assert.rejects(check(env, () => {
    throw new Error('credential=' + leak);
  }), error => !String(error).includes(leak) && error.message.startsWith('NO-GO'));
  assert.doesNotMatch(JSON.stringify(screen(env)), /synthetic|postgres:\/\//);
});


test('bucket names match the real R2 buckets and the CMS config, not the domain spelling', () => {
  const config = readFileSync(new URL('../../payload.config.ts', import.meta.url), 'utf8');
  assert.match(config, /process\.env\.S3_BUCKET \|\| 'healthylifestyles-media'/);
  assert.equal(safe.HLS_PRODUCTION_R2_BUCKET, 'healthylifestyles-media');
  assert.equal(safe.S3_BUCKET, 'healthylifestyles-staging-media');
  assert.equal(screen(safe).configuredR2StagingBucketScreened, true);
  // The previous three-s spelling (domain spelling) must now be rejected.
  for (const wrong of ['healthylifesstyles-staging-media', 'healthylifestyles-media']) {
    assert.throws(() => screen({ ...safe, S3_BUCKET: wrong, HLS_STAGING_R2_BUCKET: wrong }), /NO-GO/);
  }
});

test('any search-engine or deploy credential in the staging runtime is NO-GO', () => {
  for (const name of FORBIDDEN_STAGING_CREDENTIALS) {
    assert.throws(() => screen({ ...safe, [name]: 'present' }), /NO-GO/, name);
    assert.doesNotThrow(() => screen({ ...safe, [name]: '   ' }), name);
  }
});

test('every indexing/deploy credential the CMS source reads is screened (drift guard)', () => {
  const files = execFileSync('git', ['ls-files', 'src', 'payload.config.ts'], { encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !/\.test\./.test(f));
  const read = new Set();
  for (const f of files) {
    for (const m of readFileSync(new URL('../../' + f, import.meta.url), 'utf8').matchAll(/process\.env\.([A-Z0-9_]+)/g)) read.add(m[1]);
  }
  const outbound = [...read].filter((n) => /^(INDEXNOW_(API_)?KEY|GOOGLE_INDEXING_|VERCEL_DEPLOY_HOOK|CHATGPT_DRAFT_BRIDGE)/.test(n));
  assert.ok(outbound.includes('INDEXNOW_API_KEY'), 'live IndexNow key name not found in source');
  for (const name of outbound) assert.ok(FORBIDDEN_STAGING_CREDENTIALS.includes(name), name + ' is read by src but not screened');
});
