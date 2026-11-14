/**
 * Read-only identity check to run INSIDE an owner-approved Hostinger QA runtime.
 * Never logs environment values, credentials, URLs with secrets, or query results.
 * This is NOT Hostinger control-plane or Cloudflare IAM certification.
 *
 * HLS_STAGING_READ_ONLY_APPROVED=yes \
 *   node scripts/ci/hostinger-staging-runtime-evidence.mjs --read-only
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECTED = Object.freeze({
  origin: 'https://cms-qa.healthylifesstyles.com',
  stagingHost: 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech',
  productionHost: 'ep-lucky-voice-ad5egz8d.c-2.us-east-1.aws.neon.tech',
  database: 'neondb',
  role: 'neondb_owner',
  r2Endpoint: 'https://c401e58f54e7278facea9f55e4186da6.r2.cloudflarestorage.com',
  // R2 bucket names use the brand spelling (two s's), unlike the public domain
  // healthylifesstyles.com. Verified against the Cloudflare bucket list and the
  // payload.config.ts default on 2026-11-14.
  stagingBucket: 'healthylifestyles-staging-media',
  productionBucket: 'healthylifestyles-media',
});

/**
 * Every credential that lets this CMS contact a search engine or trigger a
 * production deploy. A staging runtime must not hold any of them. Kept in sync
 * with src/ by hostinger-staging-runtime-evidence.test.mjs.
 *   INDEXNOW_API_KEY  – live post-deploy reconciliation (src/lib/indexnow.ts,
 *                       src/app/api/seo/reconcile-indexnow/route.ts)
 *   INDEXNOW_KEY      – legacy afterChange hook (src/lib/indexing.ts)
 *   GOOGLE_INDEXING_* – Google auth (src/lib/google-auth.ts, src/lib/indexing.ts)
 */
export const FORBIDDEN_STAGING_CREDENTIALS = Object.freeze([
  'INDEXNOW_API_KEY',
  'INDEXNOW_KEY',
  'GOOGLE_INDEXING_KEY',
  'GOOGLE_INDEXING_CREDENTIALS',
  'GOOGLE_INDEXING_CREDENTIALS_B64',
  'VERCEL_DEPLOY_HOOK_URL',
  'CHATGPT_DRAFT_BRIDGE_TOKEN',
]);

const noGo = () => { throw new Error('NO-GO: staging runtime identity or read-only safety could not be verified.'); };
const has = value => typeof value === 'string' && value.trim().length > 0;

function safeDatabaseUri(raw) {
  if (typeof raw !== 'string' || raw.length > 8192 || raw !== raw.trim()) noGo();
  let uri;
  try { uri = new URL(raw); } catch { noGo(); }
  if (!['postgres:', 'postgresql:'].includes(uri.protocol) ||
      uri.hostname !== EXPECTED.stagingHost ||
      uri.hostname === EXPECTED.productionHost ||
      (uri.port && uri.port !== '5432') ||
      uri.pathname !== '/' + EXPECTED.database ||
      uri.username !== EXPECTED.role || !has(uri.password) ||
      uri.hash) noGo();

  const allowed = { sslmode: 'require', channel_binding: 'require' };
  const seen = new Set();
  for (const [key, value] of uri.searchParams) {
    if (!Object.hasOwn(allowed, key) || allowed[key] !== value || seen.has(key)) noGo();
    seen.add(key);
  }
  // Once exact Neon TLS hints are screened, set actual TLS parameters via pg.
  // Do not let connection-string query arguments override the verified SSL object.
  uri.search = '';
  return uri;
}

/**
 * Pure offline check of values injected into the *calling process*.
 * Passing this check proves neither that the process is deployed on Hostinger
 * nor that Cloudflare limited the token's actual IAM resource scope.
 */
export function screenHostingerStagingRuntime(env) {
  if (!env || typeof env !== 'object' ||
      env.HLS_STAGING_READ_ONLY_APPROVED !== 'yes' ||
      env.HLS_ISOLATED_STAGING !== 'true' ||
      env.NODE_ENV !== 'production' ||
      env.HLS_STAGING_CMS_ORIGIN !== EXPECTED.origin ||
      env.SERVER_URL !== EXPECTED.origin ||
      env.HLS_STAGING_DATABASE_HOST !== EXPECTED.stagingHost ||
      env.HLS_PRODUCTION_DATABASE_HOST !== EXPECTED.productionHost ||
      env.INDEXNOW_DISABLE !== 'true' ||
      env.INDEXNOW_LIVE_ENABLED !== 'false' ||
      env.ALLOW_DB_PUSH !== 'false' ||
      FORBIDDEN_STAGING_CREDENTIALS.some(name => has(env[name])) ||
      env.S3_ENDPOINT !== EXPECTED.r2Endpoint ||
      env.S3_REGION !== 'auto' ||
      env.S3_BUCKET !== EXPECTED.stagingBucket ||
      env.HLS_STAGING_R2_BUCKET !== EXPECTED.stagingBucket ||
      env.HLS_PRODUCTION_R2_BUCKET !== EXPECTED.productionBucket ||
      !has(env.S3_ACCESS_KEY_ID) || !has(env.S3_SECRET_ACCESS_KEY) ||
      env.S3_ACCESS_KEY_ID === env.S3_SECRET_ACCESS_KEY ||
      has(env.S3_PUBLIC_URL)) noGo();

  safeDatabaseUri(env.DATABASE_URI);
  return Object.freeze({
    kind: 'hostinger-staging-runtime-read-only-evidence',
    stagingRuntimeEnvironmentScreened: true,
    configuredNeonStagingTargetScreened: true,
    configuredR2StagingBucketScreened: true,
    postgresSessionVerified: false,
    hostingerApplicationIdentityVerified: false,
    r2BucketPermissionBoundaryVerified: false,
    productionReleaseAuthorized: false,
  });
}

/**
 * A single SELECT, on a certificate-validated read-only PostgreSQL session.
 * Injection allows full offline tests without any real provider connection.
 */
export async function verifyHostingerStagingDatabaseReadOnly(env, makeClient) {
  const config = screenHostingerStagingRuntime(env);
  if (typeof makeClient !== 'function') noGo();
  const uri = safeDatabaseUri(env.DATABASE_URI);
  let client;
  try {
    client = makeClient({
      connectionString: uri.toString(),
      ssl: { rejectUnauthorized: true, servername: EXPECTED.stagingHost, minVersion: 'TLSv1.2' },
      enableChannelBinding: true,
      connectionTimeoutMillis: 10000,
      query_timeout: 10000,
      statement_timeout: 10000,
      options: '-c default_transaction_read_only=on',
    });
    await client.connect();
    if (client.connection?.stream?.encrypted !== true ||
        client.connection?.stream?.authorized !== true) noGo();
    const data = await client.query(
      "SELECT current_database() AS database_name, current_user AS role_name, " +
      "current_setting('server_version_num')::integer AS version_num, " +
      "current_setting('default_transaction_read_only') AS read_only"
    );
    const row = data?.rows?.[0];
    if (data?.rows?.length !== 1 ||
        row?.database_name !== EXPECTED.database ||
        row?.role_name !== EXPECTED.role ||
        !Number.isInteger(row?.version_num) ||
        row.version_num < 180000 || row.version_num >= 190000 ||
        row.read_only !== 'on') noGo();

    return Object.freeze({
      ...config, postgresSessionVerified: true, postgresClientTlsVerified: true,
      readOnlySessionVerified: true, hostingerApplicationIdentityVerified: false,
      r2BucketPermissionBoundaryVerified: false,
      productionReleaseAuthorized: false,
    });
  } catch {
    noGo();
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== '--read-only') {
    console.error('NO-GO: explicit --read-only is required.');
    process.exitCode = 2;
  } else {
    try {
      // Fail without importing a PostgreSQL driver when runtime safety is unproven.
      screenHostingerStagingRuntime(process.env);
      const { default: pg } = await import('pg');
      const result = await verifyHostingerStagingDatabaseReadOnly(
        process.env, options => new pg.Client(options));
      console.log(JSON.stringify(result));
    } catch {
      console.error('NO-GO: Hostinger QA runtime check failed. No secrets disclosed.');
      process.exitCode = 1;
    }
  }
}
