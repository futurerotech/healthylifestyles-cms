/**
 * Transaction-only rehearsal of the EXACT committed Payload RLS migration SQL.
 * Only GitHub Actions' disposable mock PostgreSQL is allowed.
 * A synthetic quoted-identifier table and policy are created and rolled back.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const MOCK_URI = 'postgres://mock:mock@localhost:5432/mock'
export const FIXTURE = 'hls-ci-rls-replay-fixture'

export function assertMockCiEnvironment(env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.CI !== 'true') {
    throw new Error('RLS_REPLAY_NOT_GITHUB_CI')
  }
  if (env.DATABASE_URI !== MOCK_URI) {
    throw new Error('RLS_REPLAY_NOT_DISPOSABLE_DB')
  }
}

export function extractExactMigrationSql(source) {
  const opener = 'await db.execute(sql`'
  const start = source.indexOf(opener)
  if (start < 0 || source.indexOf(opener, start + opener.length) >= 0) {
    throw new Error('RLS_REPLAY_MIGRATION_SHAPE_CHANGED')
  }
  const end = source.indexOf('`)', start + opener.length)
  if (end < 0) throw new Error('RLS_REPLAY_MIGRATION_SHAPE_CHANGED')
  const sql = source.slice(start + opener.length, end)
  if (sql.includes('${') || !sql.includes('ENABLE ROW LEVEL SECURITY') ||
      !sql.includes('NOT c.relrowsecurity') || !sql.includes('format(')) {
    throw new Error('RLS_REPLAY_MIGRATION_SQL_CHANGED')
  }
  return sql
}

export function assertRehearsalEvidence(e) {
  if (!e || e.database !== 'mock' || e.sessionUser !== 'mock') {
    throw new Error('RLS_REPLAY_WRONG_DB_IDENTITY')
  }
  if (e.beforeEnabled !== false || e.firstEnabled !== true || e.secondEnabled !== true ||
      e.beforeForced !== false || e.firstForced !== false || e.secondForced !== false ||
      e.beforePolicyCount !== 1 || e.firstPolicyCount !== 1 || e.secondPolicyCount !== 1 ||
      e.beforeOwner !== 'mock' || e.firstOwner !== 'mock' || e.secondOwner !== 'mock' ||
      e.beforeRows !== 1 || e.firstRows !== 1 || e.secondRows !== 1) {
    throw new Error('RLS_REPLAY_DATA_POLICY_OR_IDEMPOTENCE_FAILED')
  }
}

export async function rehearseRlsMigration() {
  assertMockCiEnvironment(process.env)
  const source = readFileSync(new URL('../../src/migrations/20261116_110500_enable_rls_after_collections.ts', import.meta.url), 'utf8')
  const migrationSql = extractExactMigrationSql(source)
  const { Client } = await import('pg')
  const client = new Client({ connectionString: MOCK_URI, connectionTimeoutMillis: 5000 })
  let inTransaction = false
  let error
  try {
    await client.connect()
    const identity = (await client.query('SELECT current_database() AS database, session_user AS session_user')).rows[0]
    if (identity.database !== 'mock' || identity.session_user !== 'mock') {
      throw new Error('RLS_REPLAY_WRONG_DB_IDENTITY')
    }
    await client.query('BEGIN')
    inTransaction = true
    await client.query("SET LOCAL lock_timeout = '10s'")
    await client.query('CREATE TABLE public."hls-ci-rls-replay-fixture" (id integer PRIMARY KEY, marker text NOT NULL)')
    await client.query('CREATE POLICY hls_ci_rls_deny_select ON public."hls-ci-rls-replay-fixture" FOR SELECT USING (false)')
    await client.query('INSERT INTO public."hls-ci-rls-replay-fixture" (id, marker) VALUES (1, $1)', ['synthetic-only'])

    async function state() {
      const x = (await client.query(`
        SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
               pg_catalog.pg_get_userbyid(c.relowner) AS owner
          FROM pg_catalog.pg_class AS c
          JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'
      `, [FIXTURE])).rows[0]
      if (!x) throw new Error('RLS_REPLAY_FIXTURE_MISSING')
      const policies = (await client.query(`
        SELECT count(*)::int AS count FROM pg_catalog.pg_policies
         WHERE schemaname = 'public' AND tablename = $1 AND policyname = 'hls_ci_rls_deny_select'
      `, [FIXTURE])).rows[0].count
      const rows = (await client.query('SELECT count(*)::int AS count FROM public."hls-ci-rls-replay-fixture"')).rows[0].count
      return { enabled: x.enabled, forced: x.forced, owner: x.owner, policies, rows }
    }
    const before = await state()
    await client.query(migrationSql)
    const first = await state()
    await client.query(migrationSql)
    const second = await state()
    assertRehearsalEvidence({
      database: identity.database, sessionUser: identity.session_user,
      beforeEnabled: before.enabled, firstEnabled: first.enabled, secondEnabled: second.enabled,
      beforeForced: before.forced, firstForced: first.forced, secondForced: second.forced,
      beforePolicyCount: before.policies, firstPolicyCount: first.policies, secondPolicyCount: second.policies,
      beforeOwner: before.owner, firstOwner: first.owner, secondOwner: second.owner,
      beforeRows: before.rows, firstRows: first.rows, secondRows: second.rows,
    })
    console.log('RLS_CI_MIGRATION_REPLAY_PASS: exact migration enabled protected synthetic table twice without data/policy/ownership/force changes')
  } catch (caught) {
    error = caught
  } finally {
    if (inTransaction) {
      try { await client.query('ROLLBACK') }
      catch (rollbackError) { error = new Error('RLS_REPLAY_ROLLBACK_FAILED', { cause: rollbackError }) }
    }
    if (!error) {
      try {
        const check = (await client.query("SELECT to_regclass('public.\"hls-ci-rls-replay-fixture\"') IS NULL AS absent")).rows[0]
        if (check.absent !== true) throw new Error('RLS_REPLAY_FIXTURE_PERSISTED')
        console.log('RLS_CI_MIGRATION_ROLLBACK_PASS: synthetic table and policy fully removed')
      } catch (cleanupError) { error = cleanupError }
    }
    try { await client.end() }
    catch (endError) { error ??= endError }
  }
  if (error) throw error
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  rehearseRlsMigration().catch((error) => {
    console.error(error?.message || 'RLS_REPLAY_FAILED')
    process.exitCode = 1
  })
}
