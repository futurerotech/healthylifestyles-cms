#!/usr/bin/env node
/**
 * Read-only staging identity diagnostic for the Hostinger `cms-qa` runtime.
 *
 * Prints ONLY: database hostname, port, database name, role (user name),
 * Neon endpoint id, R2 bucket names and endpoint/public hostnames, boolean
 * flags, and verdicts against independently verified identities.
 * NEVER prints passwords, tokens, access keys or a full connection string.
 *
 * Usage (inside the staging app directory, as the app's own user):
 *   node scripts/ci/staging-identity-diagnostic.mjs          # configuration only, no network
 *   node scripts/ci/staging-identity-diagnostic.mjs --sql    # + read-only SQL fingerprint
 * The --sql mode opens a single connection with default_transaction_read_only=on,
 * runs SELECTs inside a READ ONLY transaction, and never writes.
 */

/** Independently verified identities (Neon runbook, R2 probe pins, public API). */
export const VERIFIED = Object.freeze({
  stagingDbHost: 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech',
  productionDbHost: 'ep-lucky-voice-ad5egz8d.c-2.us-east-1.aws.neon.tech',
  stagingDbName: 'neondb',
  stagingDbRole: 'neondb_owner',
  r2EndpointHost: 'c401e58f54e7278facea9f55e4186da6.r2.cloudflarestorage.com',
  stagingBucket: 'healthylifesstyles-staging-media',
  productionBucket: 'healthylifesstyles-media',
  productionPublicMediaHost: 'pub-0940dd2b700b4ad299ce1062cf639dd8.r2.dev',
  stagingMigrationRowsBefore: 17,
});

const computeHost = (h) => (h ? h.replace(/-pooler(?=\.)/, '') : h);
const hostOf = (value) => {
  if (!value) return null;
  try { return new URL(value).hostname || null; } catch { return null; }
};
const bareHost = (value) => {
  if (!value) return null;
  const v = String(value).trim();
  return /^[a-z0-9.-]+$/i.test(v) ? v.toLowerCase() : 'INVALID_FORMAT';
};

/** Pure: derive the allowlisted, non-secret summary from an environment. */
export function summarize(env) {
  let db = null;
  if (env.DATABASE_URI) {
    try {
      const u = new URL(env.DATABASE_URI);
      db = {
        host: u.hostname,
        port: u.port || '5432',
        database: decodeURIComponent(u.pathname.replace(/^\//, '')) || null,
        role: decodeURIComponent(u.username) || null,
        neonEndpointId: (u.hostname.match(/^(ep-[a-z0-9-]+?)(?:-pooler)?\./) || [])[1] ?? null,
        pooled: /-pooler\./.test(u.hostname),
        sslmode: u.searchParams.get('sslmode'),
      };
    } catch { db = { error: 'DATABASE_URI is not a parseable URL' }; }
  }
  const s = {
    isolatedStaging: env.HLS_ISOLATED_STAGING === 'true',
    indexNowDisabled: env.INDEXNOW_DISABLE === 'true',
    indexNowLiveEnabled: env.INDEXNOW_LIVE_ENABLED === 'true',
    database: db,
    configuredStagingDbHost: bareHost(env.HLS_STAGING_DATABASE_HOST),
    configuredProductionDbHost: bareHost(env.HLS_PRODUCTION_DATABASE_HOST),
    r2: {
      bucket: env.S3_BUCKET ?? null,
      configuredStagingBucket: env.HLS_STAGING_R2_BUCKET ?? null,
      configuredProductionBucket: env.HLS_PRODUCTION_R2_BUCKET ?? null,
      endpointHost: hostOf(env.S3_ENDPOINT),
      publicHost: hostOf(env.S3_PUBLIC_URL),
      configuredStagingPublicHost: hostOf(env.HLS_STAGING_MEDIA_PUBLIC_URL),
      accessKeyIdSet: Boolean(env.S3_ACCESS_KEY_ID),
      secretAccessKeySet: Boolean(env.S3_SECRET_ACCESS_KEY),
    },
    secretsPresent: {
      payloadSecret: Boolean(env.PAYLOAD_SECRET),
      vercelDeployHook: Boolean(env.VERCEL_DEPLOY_HOOK_URL),
      indexNowKey: Boolean(env.INDEXNOW_KEY || env.INDEXNOW_API_KEY),
      googleIndexingKey: Boolean(env.GOOGLE_INDEXING_KEY || env.GOOGLE_APPLICATION_CREDENTIALS),
    },
  };
  return s;
}

/** Pure: compare a summary with the verified identities. */
export function verdicts(s) {
  const v = [];
  const check = (name, ok, detail) => v.push({ check: name, result: ok ? 'PASS' : 'FAIL', detail });
  const host = computeHost(s.database?.host);
  check('HLS_ISOLATED_STAGING=true', s.isolatedStaging, '');
  check('INDEXNOW_DISABLE=true and INDEXNOW_LIVE_ENABLED not true', s.indexNowDisabled && !s.indexNowLiveEnabled, '');
  check('DATABASE_URI host is NOT the production Neon endpoint', !!host && host !== VERIFIED.productionDbHost, host ?? 'missing');
  check('DATABASE_URI host is the verified staging Neon endpoint', host === VERIFIED.stagingDbHost, host ?? 'missing');
  check('database/role are the verified staging values',
    s.database?.database === VERIFIED.stagingDbName && s.database?.role === VERIFIED.stagingDbRole,
    `${s.database?.database ?? '?'} / ${s.database?.role ?? '?'}`);
  check('HLS_STAGING_DATABASE_HOST matches the actual DATABASE_URI host',
    computeHost(s.configuredStagingDbHost) === host, s.configuredStagingDbHost ?? 'missing');
  check('HLS_PRODUCTION_DATABASE_HOST is the verified production endpoint',
    computeHost(s.configuredProductionDbHost) === VERIFIED.productionDbHost, s.configuredProductionDbHost ?? 'missing');
  check('S3_BUCKET is the verified staging bucket', s.r2.bucket === VERIFIED.stagingBucket, s.r2.bucket ?? 'missing');
  check('S3_BUCKET is NOT the production bucket', s.r2.bucket !== VERIFIED.productionBucket, s.r2.bucket ?? 'missing');
  check('configured staging/production buckets are the verified pair',
    s.r2.configuredStagingBucket === VERIFIED.stagingBucket && s.r2.configuredProductionBucket === VERIFIED.productionBucket,
    `${s.r2.configuredStagingBucket ?? '?'} / ${s.r2.configuredProductionBucket ?? '?'}`);
  check('S3_ENDPOINT host is the verified R2 account endpoint', s.r2.endpointHost === VERIFIED.r2EndpointHost, s.r2.endpointHost ?? 'missing');
  check('S3_PUBLIC_URL is NOT the production public media host', s.r2.publicHost !== VERIFIED.productionPublicMediaHost, s.r2.publicHost ?? 'missing');
  check('no Vercel deploy hook, IndexNow or Google indexing credential present',
    !s.secretsPresent.vercelDeployHook && !s.secretsPresent.indexNowKey && !s.secretsPresent.googleIndexingKey, '');
  return v;
}

/** Optional read-only SQL fingerprint. Returns counts/names only. */
export async function sqlFingerprint(uri) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString: uri,
    options: '-c default_transaction_read_only=on',
    statement_timeout: 15000,
  });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const one = async (sql) => (await client.query(sql)).rows[0];
    const ident = await one(`SELECT current_database() AS database, current_user AS role,
      current_setting('server_version') AS server_version,
      current_setting('neon.timeline_id', true) AS neon_timeline_id,
      current_setting('neon.tenant_id', true) AS neon_tenant_id,
      current_setting('transaction_read_only') AS read_only`);
    const migrations = await one(`SELECT count(*)::int AS rows, max(name) AS latest FROM payload_migrations`);
    const tools = await one(`SELECT count(*)::int AS rows, max(updated_at) AS newest FROM tools`);
    const articles = await one(`SELECT count(*)::int AS rows, max(updated_at) AS newest FROM articles`);
    const attempts = await one(`SELECT to_regclass('public.indexnow_attempts') IS NOT NULL AS present`);
    await client.query('ROLLBACK');
    return { ...ident, migrations, tools, articles, indexnowAttemptsTablePresent: attempts.present };
  } finally {
    await client.end();
  }
}

/** Defense in depth: refuse to print anything that looks like a secret. */
export function assertNoSecrets(text, env) {
  const secrets = [env.DATABASE_URI, env.S3_SECRET_ACCESS_KEY, env.S3_ACCESS_KEY_ID, env.PAYLOAD_SECRET,
    env.VERCEL_DEPLOY_HOOK_URL, env.INDEXNOW_KEY, env.INDEXNOW_API_KEY];
  let password = null;
  try { password = env.DATABASE_URI ? decodeURIComponent(new URL(env.DATABASE_URI).password) : null; } catch { /* ignore */ }
  for (const s of [...secrets, password]) {
    if (s && s.length >= 6 && text.includes(s)) throw new Error('Refusing to print: output would contain a secret.');
  }
  if (/postgres(ql)?:\/\/[^\s"]*@/i.test(text)) throw new Error('Refusing to print: output would contain a connection string.');
}

async function main() {
  const env = process.env;
  const summary = summarize(env);
  const report = { generatedAt: new Date().toISOString(), summary, verdicts: verdicts(summary) };
  if (process.argv.includes('--sql')) {
    if (!env.DATABASE_URI) report.sql = { error: 'DATABASE_URI not set' };
    else {
      try { report.sql = await sqlFingerprint(env.DATABASE_URI); }
      catch (e) { report.sql = { error: String(e?.code || 'connection or query failed') }; }
    }
  }
  const text = JSON.stringify(report, null, 2);
  assertNoSecrets(text, env);
  console.log(text);
  const failed = report.verdicts.filter((x) => x.result === 'FAIL').length;
  console.log(failed ? `\nNO-GO: ${failed} isolation check(s) failed.` : '\nPASS: configuration matches the verified staging identities.');
  process.exitCode = failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('staging-identity-diagnostic.mjs')) {
  main().catch((e) => { console.error('Diagnostic failed:', String(e?.message || e).replace(/postgres(ql)?:\/\/\S+/gi, '[redacted]')); process.exitCode = 2; });
}
