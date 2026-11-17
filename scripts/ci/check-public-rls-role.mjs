/**
 * CI-only effective RLS role-boundary regression.
 * The only permitted target is GitHub's disposable localhost/mock database.
 * Creates a synthetic row and NOLOGIN role in a single transaction, then
 * ALWAYS rolls that transaction back. Never run on user or production DBs.
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { assertDisposableUri } from './check-public-rls.mjs'

const FIXTURE_ROLE = 'hls_ci_rls_probe_20261116'
const FIXTURE_RUN_ID = 'hls-ci-rls-isolation-probe-only'

export function assertCiOnlyEnvironment(env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.CI !== 'true') {
    throw new Error('RLS_ROLE_TEST_NOT_GITHUB_CI')
  }
  assertDisposableUri(env.DATABASE_URI)
}

export function assertRoleIsolationEvidence(evidence) {
  if (!evidence || evidence.databaseName !== 'mock' || evidence.sessionUser !== 'mock') {
    throw new Error('RLS_ROLE_TEST_WRONG_DB_IDENTITY')
  }
  if (evidence.restrictedRole !== FIXTURE_ROLE || evidence.isSuperuser !== false || evidence.bypassRls !== false) {
    throw new Error('RLS_ROLE_TEST_NOT_RESTRICTED')
  }
  if (!Number.isInteger(evidence.protectedCount) || evidence.protectedCount < 1 || evidence.inactiveCount !== 0) {
    throw new Error('RLS_ROLE_TEST_INACTIVE_TABLES')
  }
  if (evidence.ownerVisible !== 1 || evidence.restrictedVisible !== 0 || evidence.rowSecurityActive !== true) {
    throw new Error('RLS_ROLE_TEST_DENY_BY_DEFAULT_FAILED')
  }
}

export async function checkPublicRlsRole() {
  assertCiOnlyEnvironment(process.env)
  const { Client } = await import('pg')
  const client = new Client({ connectionString: process.env.DATABASE_URI, connectionTimeoutMillis: 5000 })
  let inTransaction = false
  let failure
  try {
    await client.connect()
    const identity = (await client.query('SELECT current_database() AS database_name, session_user AS session_user')).rows[0]
    if (identity.database_name !== 'mock' || identity.session_user !== 'mock') {
      throw new Error('RLS_ROLE_TEST_WRONG_DB_IDENTITY')
    }
    await client.query('BEGIN')
    inTransaction = true
    await client.query(`CREATE ROLE ${FIXTURE_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS`)
    await client.query('INSERT INTO public.audit_log (run_id) VALUES ($1)', [FIXTURE_RUN_ID])
    const ownerVisible = (await client.query('SELECT COUNT(*)::int AS count FROM public.audit_log WHERE run_id = $1', [FIXTURE_RUN_ID])).rows[0].count
    await client.query(`GRANT USAGE ON SCHEMA public TO ${FIXTURE_ROLE}`)
    await client.query(`GRANT SELECT ON TABLE public.audit_log TO ${FIXTURE_ROLE}`)
    await client.query(`SET LOCAL ROLE ${FIXTURE_ROLE}`)
    await client.query('SET LOCAL row_security = on')
    const roleStatus = (await client.query(`
      SELECT current_user AS role_name,
             r.rolsuper AS is_superuser,
             r.rolbypassrls AS bypass_rls,
             pg_catalog.row_security_active('public.audit_log'::regclass) AS active
      FROM pg_catalog.pg_roles AS r
      WHERE r.rolname = current_user
    `)).rows[0]
    const coverage = (await client.query(`
      SELECT COUNT(*)::int AS protected_count,
             COUNT(*) FILTER (WHERE NOT pg_catalog.row_security_active(c.oid))::int AS inactive_count
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    `)).rows[0]
    const restrictedVisible = (await client.query('SELECT COUNT(*)::int AS count FROM public.audit_log WHERE run_id = $1', [FIXTURE_RUN_ID])).rows[0].count
    assertRoleIsolationEvidence({
      databaseName: identity.database_name,
      sessionUser: identity.session_user,
      restrictedRole: roleStatus?.role_name,
      isSuperuser: roleStatus?.is_superuser,
      bypassRls: roleStatus?.bypass_rls,
      protectedCount: coverage.protected_count,
      inactiveCount: coverage.inactive_count,
      ownerVisible,
      restrictedVisible,
      rowSecurityActive: roleStatus.active,
    })
    console.log('RLS_CI_NONBYPASS_ROLE_DENIED_PASS: synthetic row invisible to granted non-bypass role')
    console.log('RLS_CI_EFFECTIVE_ROLE_COVERAGE_PASS: RLS active on every public table for restricted role')
  } catch (error) {
    failure = error
  } finally {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        failure = new Error('RLS_ROLE_TEST_ROLLBACK_FAILED', { cause: rollbackError })
      }
    }
    try { await client.end() } catch (endError) {
      failure ??= endError
    }
  }
  if (failure) throw failure
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkPublicRlsRole().catch((error) => {
    console.error(error?.message || 'RLS_CI_ROLE_CHECK_FAILED')
    process.exitCode = 1
  })
}
