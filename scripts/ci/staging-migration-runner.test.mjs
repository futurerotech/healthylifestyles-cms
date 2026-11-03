import test from 'node:test';
import assert from 'node:assert/strict';
import { assertMigrationArm, verifyRoleAndDatabase, inspectStagingPg, runOneTimeMigration } from './staging-migration-runner.mjs';

const sha = 'a'.repeat(40);
const host = 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech';
const env = Object.freeze({
  CI: 'true', GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'futurerotech/healthylifestyles-cms',
  GITHUB_EVENT_NAME: 'push', GITHUB_REF_TYPE: 'tag',
  GITHUB_REF_NAME: 'staging-migrate-' + sha, GITHUB_SHA: sha,
  HLS_STAGING_MIGRATION_ENABLE: 'yes',
  HLS_STAGING_MIGRATION_REVIEWED_SHA: sha,
  HLS_STAGING_MIGRATION_APPROVED_SHA: sha,
  HLS_ISOLATED_STAGING: 'true',
  HLS_STAGING_CMS_ORIGIN: 'https://cms-qa.healthylifesstyles.com',
  SERVER_URL: 'https://cms-qa.healthylifesstyles.com',
  INDEXNOW_DISABLE: 'true', INDEXNOW_LIVE_ENABLED: 'false', ALLOW_DB_PUSH: 'false',
  HLS_STAGING_DATABASE_HOST: host,
  HLS_PRODUCTION_DATABASE_HOST: 'ep-lucky-voice-ad5egz8d.c-2.us-east-1.aws.neon.tech',
  S3_BUCKET: 'healthylifesstyles-staging-media',
  HLS_STAGING_R2_BUCKET: 'healthylifesstyles-staging-media',
  HLS_PRODUCTION_R2_BUCKET: 'healthylifesstyles-media',
  S3_ENDPOINT: 'https://c401e58f54e7278facea9f55e4186da6.r2.cloudflarestorage.com',
  S3_ACCESS_KEY_ID: 'synthetic-access',
  S3_SECRET_ACCESS_KEY: 'synthetic-secret',
  DATABASE_URI: 'postgres://neondb_owner:synthetic@' + host +
    '/neondb?sslmode=require&channel_binding=require',
  PAYLOAD_SECRET: 'synthetic-payload-secret-of-sufficient-length',
  NEON_API_KEY: 'synthetic-token',
});

function fetcher(url, options) {
  assert.equal(options.method, 'GET');
  assert.equal(options.redirect, 'error');
  assert.ok(url.startsWith('https://console.neon.tech/api/v2/projects/small-hall-15225012/branches/br-wandering-poetry-bcxj8s3v/'));
  if (url.endsWith('/roles/neondb_owner')) {
    return Promise.resolve(Response.json({ role: {
      name: 'neondb_owner', branch_id: 'br-wandering-poetry-bcxj8s3v',
    } }));
  }
  if (url.endsWith('/databases/neondb')) {
    return Promise.resolve(Response.json({ database: {
      name: 'neondb', branch_id: 'br-wandering-poetry-bcxj8s3v',
      owner_name: 'neondb_owner',
    } }));
  }
  throw Error('unexpected URL');
}

function clients({ tls = true, beforeTables = 0, afterTables = 35,
  afterCount = 16, role = 'neondb_owner' } = {}) {
  const instances = [], options = [];
  const createClient = opts => {
    const stage = instances.length === 0 ? 'before' : 'after';
    options.push(opts);
    const client = {
      connection: { stream: { encrypted: tls, authorized: tls, servername: host } },
      async connect() {}, async end() {},
      async query(sql) {
        if (sql.includes('current_database()')) {
          return { rows: [{ database_name: 'neondb', role_name: role,
            version_num: 180006, ssl_active: false }] };
        }
        if (sql.includes('information_schema')) {
          return { rows: [{ table_count: stage === 'before' ? beforeTables : afterTables }] };
        }
        if (sql.includes('payload_migrations')) {
          return { rows: [{ migration_count: afterCount }] };
        }
        throw Error('unexpected query');
      },
    };
    instances.push(client);
    return client;
  };
  return { createClient, instances, options };
}

function setup(opts = {}) {
  const c = clients(opts), commands = [];
  const deps = {
    env, checkedOutSha: sha, fetcher, createClient: c.createClient,
    verifyProvider: async () => ({ providerIdentityVerified: true }),
    runCommand: (cmd, args, options) => {
      commands.push({ cmd, args, options });
      return { status: 0 };
    },
  };
  return { deps, c, commands };
}

test('exact manual tag, reviewed SHA and protected staging context are required', () => {
  assert.doesNotThrow(() => assertMigrationArm(env, sha));
  for (const patch of [
    { CI: 'false' }, { GITHUB_REPOSITORY: 'untrusted/fork' },
    { GITHUB_REF_TYPE: 'branch' }, { GITHUB_REF_NAME: 'wrong' },
    { HLS_STAGING_MIGRATION_APPROVED_SHA: 'b'.repeat(40) },
    { HLS_STAGING_MIGRATION_ENABLE: 'no' },
    { HLS_ISOLATED_STAGING: 'false' },
    { INDEXNOW_DISABLE: 'false' }, { ALLOW_DB_PUSH: 'true' },
    { DATABASE_URI: '' }, { S3_BUCKET: 'healthylifesstyles-media' },
    { VERCEL_DEPLOY_HOOK_URL: 'https://example.org' },
  ]) assert.throws(() => assertMigrationArm({ ...env, ...patch }, sha));
});

test('role and database require bounded Neon control-plane GETs', async () => {
  assert.equal(await verifyRoleAndDatabase('synthetic-token', fetcher), true);
  await assert.rejects(() =>
    verifyRoleAndDatabase('synthetic-token', async () => Response.json({ role: { name: 'wrong' } }))
  );
  await assert.rejects(() =>
    verifyRoleAndDatabase('synthetic-token', async () => { throw Error('synthetic-token'); }),
    error => !String(error).includes('synthetic-token')
  );
});

test('client-authenticated PostgreSQL 18 TLS, role and empty schema are mandatory (Neon backend may report no TLS)', async () => {
  const c = clients();
  assert.deepEqual(await inspectStagingPg(env.DATABASE_URI, c.createClient, 'before'),
    { roleVerified: true, tlsVerified: true, schemaVerified: true });
  assert.equal(c.options[0].ssl.rejectUnauthorized, true);
  assert.equal(c.options[0].ssl.servername, host);
  assert.equal(c.options[0].enableChannelBinding, true);
  assert.ok(!c.options[0].connectionString.includes('sslmode'));
  for (const bad of [{ tls: false }, { beforeTables: 1 }, { role: 'production' }]) {
    const d = clients(bad);
    await assert.rejects(() => inspectStagingPg(env.DATABASE_URI, d.createClient, 'before'));
  }
});

test('provider authorization failure cannot connect or execute', async () => {
  const x = setup();
  x.deps.verifyProvider = async () => ({ providerIdentityVerified: false });
  await assert.rejects(() => runOneTimeMigration(x.deps));
  assert.equal(x.c.instances.length, 0);
  assert.equal(x.commands.length, 0);
});

test('malicious database URI cannot reach the child process', async () => {
  const x = setup();
  x.deps.env = { ...env, DATABASE_URI: env.DATABASE_URI + '&host=wrong.neon.tech' };
  await assert.rejects(() => runOneTimeMigration(x.deps));
  assert.equal(x.c.instances.length, 0);
  assert.equal(x.commands.length, 0);
});

test('a database with tables refuses repeat migrations', async () => {
  const x = setup({ beforeTables: 1 });
  await assert.rejects(() => runOneTimeMigration(x.deps));
  assert.equal(x.commands.length, 0);
});

test('only an approved migration executes and 16 records are checked afterward', async () => {
  const x = setup();
  const result = await runOneTimeMigration(x.deps);
  assert.equal(result.executed, true);
  assert.equal(result.migrationsVerified, 16);
  assert.equal(x.c.instances.length, 2);
  assert.equal(x.commands.length, 1);
  assert.equal(x.commands[0].cmd, 'npm');
  assert.deepEqual(x.commands[0].args,
    ['run', 'migrate', '--', '--force-accept-warning']);
  assert.equal(x.commands[0].options.shell, false);
  assert.equal(x.commands[0].options.env.ALLOW_DB_PUSH, 'false');
  assert.equal(x.commands[0].options.env.NODE_ENV, 'production');
  assert.equal(x.commands[0].options.env.NEON_API_KEY, undefined);
});

test('command failure or incomplete schema never reports success', async () => {
  const x = setup();
  x.deps.runCommand = () => ({ status: 1, stderr: env.DATABASE_URI });
  await assert.rejects(() => runOneTimeMigration(x.deps),
    error => !String(error).includes('synthetic@'));
  const y = setup({ afterCount: 15 });
  await assert.rejects(() => runOneTimeMigration(y.deps));
});


test('diagnostic stage reports safe names only, with no secret or raw error propagation', async () => {
  const provider = setup();
  provider.deps.verifyProvider = async () => { throw Error(env.NEON_API_KEY + env.DATABASE_URI); };
  await assert.rejects(() => runOneTimeMigration(provider.deps), error => {
    assert.equal(error.safeStage, 'neon-control-plane');
    assert.ok(!String(error).includes(env.NEON_API_KEY));
    assert.ok(!String(error).includes(env.DATABASE_URI));
    assert.equal(provider.commands.length, 0);
    return true;
  });
  const tls = setup({ tls: false });
  await assert.rejects(() => runOneTimeMigration(tls.deps), error => {
    assert.equal(error.safeStage, 'postgres-precheck-postgres-tls');
    assert.equal(tls.commands.length, 0);
    return true;
  });
  const blocked = setup();
  blocked.deps.env = { ...env, HLS_STAGING_MIGRATION_ENABLE: 'no' };
  await assert.rejects(() => runOneTimeMigration(blocked.deps),
    error => error.safeStage === 'arm');
  const invalid = setup();
  invalid.deps.env = { ...env, DATABASE_URI: env.DATABASE_URI + '&host=bad' };
  await assert.rejects(() => runOneTimeMigration(invalid.deps),
    error => error.safeStage === 'target-uri');
  const failed = setup();
  failed.deps.runCommand = () => ({ status: 1, stderr: env.NEON_API_KEY });
  await assert.rejects(() => runOneTimeMigration(failed.deps), error => {
    assert.equal(error.safeStage, 'migration-command');
    assert.ok(!String(error).includes(env.NEON_API_KEY));
    return true;
  });
});
