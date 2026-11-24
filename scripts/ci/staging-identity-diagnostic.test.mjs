import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { VERIFIED, summarize, verdicts, assertNoSecrets } from './staging-identity-diagnostic.mjs';

const script = fileURLToPath(new URL('./staging-identity-diagnostic.mjs', import.meta.url));
const PASSWORD = 'synthetic-Pa55word-not-real';
const stagingEnv = (over = {}) => ({
  HLS_ISOLATED_STAGING: 'true',
  INDEXNOW_DISABLE: 'true',
  INDEXNOW_LIVE_ENABLED: 'false',
  DATABASE_URI: `postgresql://${VERIFIED.stagingDbRole}:${PASSWORD}@${VERIFIED.stagingDbHost}/${VERIFIED.stagingDbName}?sslmode=require`,
  HLS_STAGING_DATABASE_HOST: VERIFIED.stagingDbHost,
  HLS_PRODUCTION_DATABASE_HOST: VERIFIED.productionDbHost,
  S3_BUCKET: VERIFIED.stagingBucket,
  HLS_STAGING_R2_BUCKET: VERIFIED.stagingBucket,
  HLS_PRODUCTION_R2_BUCKET: VERIFIED.productionBucket,
  S3_ENDPOINT: `https://${VERIFIED.r2EndpointHost}`,
  S3_PUBLIC_URL: 'https://staging-media.example.invalid',
  S3_ACCESS_KEY_ID: 'SYNTHETICACCESSKEYID',
  S3_SECRET_ACCESS_KEY: 'synthetic-secret-access-key-value',
  PAYLOAD_SECRET: 'synthetic-payload-secret',
  ...over,
});
// Child processes get only what Node needs, never the developer's shell secrets.
const isolated = (env) => ({ PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env });
const failed = (env) => verdicts(summarize(env)).filter((v) => v.result === 'FAIL').map((v) => v.check);

test('verified staging configuration passes every check', () => {
  assert.deepEqual(failed(stagingEnv()), []);
});

test('the -pooler form of the staging endpoint is the same compute', () => {
  const pooled = VERIFIED.stagingDbHost.replace(/^(ep-[^.]+)/, '$1-pooler');
  assert.deepEqual(failed(stagingEnv({
    DATABASE_URI: `postgresql://neondb_owner:${PASSWORD}@${pooled}/neondb`,
  })), []);
});

test('a production database host fails even if the operator labels it staging', () => {
  const f = failed(stagingEnv({
    DATABASE_URI: `postgresql://neondb_owner:${PASSWORD}@${VERIFIED.productionDbHost}/neondb`,
    HLS_STAGING_DATABASE_HOST: VERIFIED.productionDbHost,
  }));
  assert.ok(f.includes('DATABASE_URI host is NOT the production Neon endpoint'));
  assert.ok(f.includes('DATABASE_URI host is the verified staging Neon endpoint'));
});

test('a production bucket or production public media host fails', () => {
  const f = failed(stagingEnv({ S3_BUCKET: VERIFIED.productionBucket, S3_PUBLIC_URL: `https://${VERIFIED.productionPublicMediaHost}` }));
  assert.ok(f.includes('S3_BUCKET is NOT the production bucket'));
  assert.ok(f.includes('S3_PUBLIC_URL is NOT the production public media host'));
});

test('indexing or deploy credentials present on staging fail', () => {
  assert.ok(failed(stagingEnv({ INDEXNOW_KEY: 'k'.repeat(32) })).length > 0);
  assert.ok(failed(stagingEnv({ VERCEL_DEPLOY_HOOK_URL: 'https://api.vercel.com/v1/integrations/deploy/x' })).length > 0);
});

test('printed output never contains the password, keys or a connection string', () => {
  const env = isolated(stagingEnv());
  const r = spawnSync(process.execPath, [script], { env, encoding: 'utf8', timeout: 15000 });
  assert.equal(r.status, 0, r.stderr);
  for (const secret of [PASSWORD, env.S3_SECRET_ACCESS_KEY, env.S3_ACCESS_KEY_ID, env.PAYLOAD_SECRET, env.DATABASE_URI]) {
    assert.ok(!r.stdout.includes(secret), 'secret leaked');
  }
  assert.doesNotMatch(r.stdout, /postgres(ql)?:\/\//);
  assert.match(r.stdout, new RegExp(VERIFIED.stagingDbHost.replace(/\./g, '\\.')));
  assert.match(r.stdout, /PASS: configuration matches/);
});

test('a production configuration exits non-zero with NO-GO', () => {
  const env = isolated(stagingEnv({ DATABASE_URI: `postgresql://neondb_owner:${PASSWORD}@${VERIFIED.productionDbHost}/neondb` }));
  const r = spawnSync(process.execPath, [script], { env, encoding: 'utf8', timeout: 15000 });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /NO-GO/);
  assert.ok(!r.stdout.includes(PASSWORD));
});

test('the print guard refuses any output that contains a secret', () => {
  const env = stagingEnv();
  assert.throws(() => assertNoSecrets(`x ${env.S3_SECRET_ACCESS_KEY} y`, env), /Refusing to print/);
  assert.throws(() => assertNoSecrets('postgres://u:p@h/db', {}), /Refusing to print/);
});
