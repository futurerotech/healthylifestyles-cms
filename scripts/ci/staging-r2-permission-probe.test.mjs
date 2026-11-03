import test from 'node:test';
import assert from 'node:assert/strict';
import { assertR2ReadOnlyArm, probeR2Scope } from './staging-r2-permission-probe.mjs';

const env = Object.freeze({
  HLS_ISOLATED_STAGING: 'true',
  HLS_STAGING_READ_ONLY_APPROVED: 'yes',
  S3_ENDPOINT: 'https://c401e58f54e7278facea9f55e4186da6.r2.cloudflarestorage.com',
  S3_REGION: 'auto',
  S3_BUCKET: 'healthylifesstyles-staging-media',
  HLS_STAGING_R2_BUCKET: 'healthylifesstyles-staging-media',
  HLS_PRODUCTION_R2_BUCKET: 'healthylifesstyles-media',
  S3_ACCESS_KEY_ID: 'synthetic-access',
  S3_SECRET_ACCESS_KEY: 'synthetic-secret',
});

const forbidden = { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } };
const stage = env.S3_BUCKET;
const production = env.HLS_PRODUCTION_R2_BUCKET;

test('isolated R2 read-only proof checks staging list and explicit production denial', async () => {
  const calls = [];
  const result = await probeR2Scope(env, async bucket => {
    calls.push(bucket);
    if (bucket === production) throw forbidden;
    return { httpStatus: 200, bucket };
  });
  assert.deepEqual(calls, [stage, production]);
  assert.equal(result.stageBucketListVerified, true);
  assert.equal(result.productionBucketListDenied, true);
  assert.equal(result.completeIAMScopeVerified, false);
  assert.equal(result.productionReleaseAuthorized, false);
});

test('preflight refuses wrong credentials, host, live bucket or missing approval before any request', async () => {
  for (const patch of [
    { HLS_ISOLATED_STAGING: 'false' }, { HLS_STAGING_READ_ONLY_APPROVED: '' },
    { S3_BUCKET: production }, { HLS_STAGING_R2_BUCKET: production },
    { HLS_PRODUCTION_R2_BUCKET: stage },
    { S3_ENDPOINT: 'https://example.com' },
    { S3_ENDPOINT: env.S3_ENDPOINT + '/other' },
    { S3_REGION: 'us-east-1' }, { S3_ACCESS_KEY_ID: '' },
    { S3_SECRET_ACCESS_KEY: '' }, { S3_SECRET_ACCESS_KEY: env.S3_ACCESS_KEY_ID },
    { S3_PUBLIC_URL: 'https://media.example.test' },
    { VERCEL_DEPLOY_HOOK_URL: 'https://deploy.example.test' },
  ]) {
    const bad = { ...env, ...patch };
    assert.throws(() => assertR2ReadOnlyArm(bad), /NO-GO/);
    let calls = 0;
    await assert.rejects(() => probeR2Scope(bad, async () => { calls++; }), /NO-GO/);
    assert.equal(calls, 0);
  }
});

test('production access success is always NO-GO; no write/list fallback', async () => {
  await assert.rejects(() => probeR2Scope(env, async bucket => ({
    httpStatus: 200, bucket,
  })), /NO-GO/);
});

test('staging failures, production unknown failures and forged errors fail closed', async () => {
  for (const list of [
    async bucket => { if (bucket === stage) throw new Error('secret=synthetic-secret'); throw forbidden; },
    async bucket => { if (bucket === stage) return { httpStatus: 403, bucket }; throw forbidden; },
    async bucket => { if (bucket === stage) return { httpStatus: 200, bucket }; throw new Error('network'); },
    async bucket => { if (bucket === stage) return { httpStatus: 200, bucket }; throw { name: 'NoSuchBucket', $metadata: { httpStatusCode: 404 } }; },
  ]) {
    await assert.rejects(() => probeR2Scope(env, list),
      e => e.message.includes('NO-GO') && !String(e).includes('synthetic-secret'));
  }
});
