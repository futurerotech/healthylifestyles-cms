/**
 * Fail-closed one-time staging migration runner, armed by an exact Git tag.
 * Normal builds and ordinary branch pushes cannot invoke this entrypoint.
 * Secrets and raw migration stdout/stderr must never enter logs.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { screenStagingMigrationTarget } from './staging-migration-identity.mjs';
import { verifyStagingNeonProvider } from './staging-neon-provider.mjs';

const TARGET = Object.freeze({
  project: 'small-hall-15225012',
  branch: 'br-wandering-poetry-bcxj8s3v',
  database: 'neondb',
  host: 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech',
  role: 'neondb_owner',
  origin: 'https://cms-qa.healthylifesstyles.com',
  stageBucket: 'healthylifesstyles-staging-media',
  prodBucket: 'healthylifesstyles-media',
  prodHost: 'ep-lucky-voice-ad5egz8d.c-2.us-east-1.aws.neon.tech',
  r2Endpoint: 'https://c401e58f54e7278facea9f55e4186da6.r2.cloudflarestorage.com',
});
const fail = () => { throw new Error('Staging migration refused; no authorization or safe target could be established.'); };

export function assertMigrationArm(env, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha) ||
      env.CI !== 'true' || env.GITHUB_ACTIONS !== 'true' ||
      env.GITHUB_REPOSITORY !== 'futurerotech/healthylifestyles-cms' ||
      env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF_TYPE !== 'tag' ||
      env.GITHUB_REF_NAME !== 'staging-migrate-' + sha ||
      env.GITHUB_SHA !== sha ||
      env.HLS_STAGING_MIGRATION_ENABLE !== 'yes' ||
      env.HLS_STAGING_MIGRATION_REVIEWED_SHA !== sha ||
      env.HLS_STAGING_MIGRATION_APPROVED_SHA !== sha ||
      env.HLS_ISOLATED_STAGING !== 'true' ||
      env.HLS_STAGING_CMS_ORIGIN !== TARGET.origin || env.SERVER_URL !== TARGET.origin ||
      env.INDEXNOW_DISABLE !== 'true' || env.INDEXNOW_LIVE_ENABLED !== 'false' ||
      env.ALLOW_DB_PUSH !== 'false' || Boolean(env.VERCEL_DEPLOY_HOOK_URL) ||
      env.HLS_STAGING_DATABASE_HOST !== TARGET.host ||
      env.HLS_PRODUCTION_DATABASE_HOST !== TARGET.prodHost ||
      env.S3_BUCKET !== TARGET.stageBucket ||
      env.HLS_STAGING_R2_BUCKET !== TARGET.stageBucket ||
      env.HLS_PRODUCTION_R2_BUCKET !== TARGET.prodBucket ||
      !env.PAYLOAD_SECRET || env.PAYLOAD_SECRET.length < 32 ||
      !env.NEON_API_KEY || !env.DATABASE_URI || env.S3_ENDPOINT !== TARGET.r2Endpoint ||
      !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || Boolean(env.S3_PUBLIC_URL)) fail();
}

async function boundedGet(url, token, fetcher) {
  try {
    const res = await fetcher(url, {
      method: 'GET', redirect: 'error', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok || res.redirected || (res.url && res.url !== url) || !res.body) fail();
    const sizeHeader = res.headers.get('content-length');
    if (sizeHeader !== null && (!/^\d+$/.test(sizeHeader) || Number(sizeHeader) > 32768)) fail();
    let size = 0; const chunks = []; const reader = res.body.getReader();
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 32768) fail();
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    return JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
  } catch { fail(); }
}

export async function verifyRoleAndDatabase(apiKey, fetcher = fetch) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey !== apiKey.trim()) fail();
  const root = 'https://console.neon.tech/api/v2/projects/' + TARGET.project +
    '/branches/' + TARGET.branch;
  const role = await boundedGet(root + '/roles/' + TARGET.role, apiKey, fetcher);
  const db = await boundedGet(root + '/databases/' + TARGET.database, apiKey, fetcher);
  if (role?.role?.name !== TARGET.role || role.role.branch_id !== TARGET.branch ||
      db?.database?.name !== TARGET.database || db.database.branch_id !== TARGET.branch ||
      db.database.owner_name !== TARGET.role) fail();
  return true;
}

function safePgOptions(uri) {
  const url = new URL(uri);
  // Remove vetted Neon UI TLS hints: pg URL parameters can override ssl object.
  url.search = '';
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, servername: TARGET.host, minVersion: 'TLSv1.2' },
    enableChannelBinding: true,
    connectionTimeoutMillis: 15000,
    query_timeout: 12000,
    statement_timeout: 12000,
  };
}

export async function inspectStagingPg(uri, createClient, stage) {
  const client = createClient(safePgOptions(uri));
  try {
    await client.connect();
    const socket = client.connection?.stream;
    if (socket?.encrypted !== true || socket?.authorized !== true) fail();
    const identity = (await client.query(
      "SELECT current_database() AS database_name, current_user AS role_name, " +
      "current_setting('server_version_num')::integer AS version_num"
    )).rows?.[0];
    if (identity?.database_name !== TARGET.database || identity?.role_name !== TARGET.role ||
        identity?.version_num < 180000 || identity?.version_num >= 190000) fail();
    const tables = (await client.query(
      "SELECT count(*)::integer AS table_count FROM information_schema.tables " +
      "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    )).rows?.[0];
    if (!Number.isInteger(tables?.table_count) ||
        (stage === 'before' && tables.table_count !== 0) ||
        (stage === 'after' && tables.table_count < 16)) fail();
    if (stage === 'after') {
      const migrations = (await client.query(
        'SELECT count(*)::integer AS migration_count FROM public.payload_migrations'
      )).rows?.[0];
      if (migrations?.migration_count !== 16) fail();
    }
    return Object.freeze({ roleVerified: true, tlsVerified: true, schemaVerified: true });
  } catch { fail(); }
  finally { await client.end().catch(() => {}); }
}

function migrationChildEnv(env) {
  const keys = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'CI', 'GITHUB_ACTIONS',
    'DATABASE_URI', 'PAYLOAD_SECRET', 'NODE_ENV', 'HLS_ISOLATED_STAGING',
    'HLS_STAGING_CMS_ORIGIN', 'SERVER_URL', 'HLS_STAGING_DATABASE_HOST',
    'HLS_PRODUCTION_DATABASE_HOST', 'INDEXNOW_DISABLE', 'INDEXNOW_LIVE_ENABLED',
    'ALLOW_DB_PUSH', 'S3_BUCKET', 'S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY', 'HLS_STAGING_R2_BUCKET', 'HLS_PRODUCTION_R2_BUCKET'];
  const result = Object.fromEntries(keys.filter(k => env[k] !== undefined)
    .map(k => [k, env[k]]));
  result.NODE_ENV = 'production';
  return result;
}

export async function runOneTimeMigration({ env, checkedOutSha, fetcher = fetch,
  createClient, runCommand = spawnSync, verifyProvider = verifyStagingNeonProvider }) {
  assertMigrationArm(env, checkedOutSha);
  const input = { enable: 'true', project: TARGET.project, branch: TARGET.branch,
    checkedOutSha, reviewedSha: env.HLS_STAGING_MIGRATION_REVIEWED_SHA,
    role: TARGET.role, databaseUri: env.DATABASE_URI };
  screenStagingMigrationTarget(input);
  const provider = await verifyProvider(input, env.NEON_API_KEY, fetcher);
  if (provider?.providerIdentityVerified !== true) fail();
  await verifyRoleAndDatabase(env.NEON_API_KEY, fetcher);
  if (!createClient) {
    const pg = await import('pg');
    createClient = options => new pg.default.Client(options);
  }
  await inspectStagingPg(env.DATABASE_URI, createClient, 'before');
  const output = runCommand('npm', ['run', 'migrate', '--', '--force-accept-warning'], {
    shell: false, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300000, maxBuffer: 1048576, env: migrationChildEnv(env),
  });
  if (output?.status !== 0 || output?.error || output?.signal) fail();
  await inspectStagingPg(env.DATABASE_URI, createClient, 'after');
  return Object.freeze({ kind: 'one-time-staging-migration', sourceSha: checkedOutSha,
    providerIdentityVerified: true, databaseRoleVerified: true, tlsVerified: true,
    migrationsVerified: 16, executed: true, productionTouched: false });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--execute') {
    console.error('NO-GO: an explicit --execute invocation is required.');
    process.exitCode = 2;
  } else {
    try {
      const head = execFileSync('git', ['rev-parse', 'HEAD'],
        { encoding: 'utf8', timeout: 10000 }).trim();
      const result = await runOneTimeMigration({ env: process.env, checkedOutSha: head });
      console.log(JSON.stringify(result));
    } catch {
      console.error('NO-GO: staging migration refused or failed. No credentials disclosed.');
      process.exitCode = 1;
    }
  }
}
