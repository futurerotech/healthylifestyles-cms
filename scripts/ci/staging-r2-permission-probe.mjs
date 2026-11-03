/**
 * Real, opt-in, credential-free-logging Cloudflare R2 bucket-only credential proof.
 * This is a provider-bound read-only test; never upload, delete or copy objects.
 * Run only in isolated staging with explicit owner read-only authorization.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const TARGET = Object.freeze({
  endpoint: 'https://c401e58f54e7278facea9f55e4186da6.r2.cloudflarestorage.com',
  stage: 'healthylifesstyles-staging-media',
  production: 'healthylifesstyles-media',
});
const refuse = () => { throw Error('NO-GO: staging R2 access cannot be safely verified.'); };
const denied = e => e && typeof e === 'object' &&
  (e.name === 'AccessDenied' || e.Code === 'AccessDenied' || e.code === 'AccessDenied' ||
   (e.$metadata?.httpStatusCode === 403 && ['Forbidden', 'AccessDenied'].includes(e.name)));
export function assertR2ReadOnlyArm(env) {
  if (env.HLS_ISOLATED_STAGING !== 'true' ||
      env.HLS_STAGING_READ_ONLY_APPROVED !== 'yes' ||
      env.S3_ENDPOINT !== TARGET.endpoint ||
      env.S3_BUCKET !== TARGET.stage ||
      env.HLS_STAGING_R2_BUCKET !== TARGET.stage ||
      env.HLS_PRODUCTION_R2_BUCKET !== TARGET.production ||
      env.S3_REGION !== 'auto' ||
      !env.S3_ACCESS_KEY_ID?.trim() || !env.S3_SECRET_ACCESS_KEY?.trim() ||
      env.S3_ACCESS_KEY_ID === env.S3_SECRET_ACCESS_KEY ||
      env.VERCEL_DEPLOY_HOOK_URL || env.S3_PUBLIC_URL ||
      env.HLS_STAGING_R2_BUCKET === env.HLS_PRODUCTION_R2_BUCKET) refuse();
  return true;
}
/**
 * list(bucket) must issue ListObjectsV2 with MaxKeys=0; no object data is fetched.
 * Under these known existing buckets: staging listing must succeed; production
 * listing must return AccessDenied. Other failures are INCONCLUSIVE / NO-GO.
 * This checks the specific LIST permission, not every possible S3 action.
 */
export async function probeR2Scope(env, list) {
  assertR2ReadOnlyArm(env);
  try {
    const stage = await list(TARGET.stage);
    if (!stage || stage.httpStatus !== 200 || stage.bucket !== TARGET.stage) refuse();
  } catch { refuse(); }
  let productionDenied = false;
  try { await list(TARGET.production); }
  catch (e) { productionDenied = denied(e); }
  if (!productionDenied) refuse();
  return Object.freeze({
    kind: 'r2-isolated-bucket-list-access-check',
    stageBucketListVerified: true, productionBucketListDenied: true,
    objectWriteReadDeleteVerified: false, completeIAMScopeVerified: false,
    backupRestoreVerified: false, productionReleaseAuthorized: false,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const env = process.env;
  try {
    assertR2ReadOnlyArm(env);
    // Import only after preflight; neither credentials nor SDK errors reach logs.
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const sdk = new S3Client({
      region: 'auto', endpoint: TARGET.endpoint, forcePathStyle: true,
      maxAttempts: 1,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    });
    try {
      const result = await probeR2Scope(env, async bucket => {
        const response = await sdk.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 0 }));
        return { httpStatus: response.$metadata?.httpStatusCode, bucket };
      });
      console.log(JSON.stringify(result));
    } finally { sdk.destroy(); }
  } catch {
    console.error('NO-GO: R2 bucket-scoped read-only proof failed or inconclusive. No secret disclosed.');
    process.exitCode = 1;
  }
}
