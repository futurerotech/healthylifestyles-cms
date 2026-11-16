/**
 * CI-only synthetic RLS + least-privilege CRUD rehearsal.
 *
 * This process only connects to GitHub Actions' exact disposable localhost
 * mock database. NO real Neon/Hostinger URI or tenant data is accepted.
 * All fixture DDL/DML, including CREATE ROLE, is rolled back.
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const MOCK_DATABASE_URI = 'postgres://mock:mock@localhost:5432/mock';
const ROLE = 'hls_ci_role_policy_probe';
const TABLE = 'public.hls_ci_role_policy_probe';

export function assertDisposableMockEnvironment(env) {
  const ok = env.GITHUB_ACTIONS === 'true' &&
    env.CI === 'true' &&
    env.RUN_DATABASE_TESTS === '1' &&
    env.GITHUB_REPOSITORY === 'futurerotech/healthylifestyles-cms' &&
    env.DATABASE_URI === MOCK_DATABASE_URI;
  if (!ok) throw new Error('MOCK_ROLE_REHEARSAL_CI_ONLY');
}

export function assertRestrictedRoleEvidence(row) {
  if (!row || row.active_role !== ROLE || row.is_superuser !== false ||
      row.can_bypass_rls !== false || row.can_login !== false ||
      row.rls_active !== true || row.can_create_schema !== false) {
    throw new Error('MOCK_ROLE_REHEARSAL_NOT_RESTRICTED');
  }
}

async function asRestricted(client) {
  await client.query('SET LOCAL ROLE ' + ROLE);
}

async function asOwner(client) {
  await client.query('RESET ROLE');
}

async function expectRlsDenied(client, sql, params = []) {
  await client.query('SAVEPOINT hls_ci_reject_probe');
  let code = null;
  try {
    await client.query(sql, params);
  } catch (error) {
    code = error?.code || null;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT hls_ci_reject_probe');
    await client.query('RELEASE SAVEPOINT hls_ci_reject_probe');
  }
  assert.equal(code, '42501', 'RLS must reject disallowed write with SQLSTATE 42501');
}

export async function rehearseRestrictedCmsRole() {
  // Always validate BEFORE importing a SQL driver, making network connections,
  // or executing any SQL.
  assertDisposableMockEnvironment(process.env);
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: MOCK_DATABASE_URI,
    connectionTimeoutMillis: 5000,
    ssl: false,
  });
  let connected = false;
  let transaction = false;
  let success = false;
  try {
    await client.connect();
    connected = true;
    const baseline = (await client.query(`
      SELECT current_user AS active_role, session_user AS login_role,
        current_database() AS database_name,
        (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user) AS is_superuser,
        to_regclass('public.hls_ci_role_policy_probe') IS NULL AS no_fixture_table,
        NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1) AS no_fixture_role
    `, [ROLE])).rows[0];
    assert.deepEqual({
      activeRole: baseline.active_role, loginRole: baseline.login_role,
      database: baseline.database_name, superuser: baseline.is_superuser,
      emptyTable: baseline.no_fixture_table, emptyRole: baseline.no_fixture_role,
    }, {
      activeRole: 'mock', loginRole: 'mock', database: 'mock',
      superuser: true, emptyTable: true, emptyRole: true,
    }, 'Wrong disposable service identity or leftover fixture');

    await client.query('BEGIN');
    transaction = true;
    await client.query('CREATE ROLE ' + ROLE + ' NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await client.query(`CREATE TABLE ${TABLE} (
      id integer PRIMARY KEY, tenant_id integer NOT NULL, marker text NOT NULL
    )`);
    await client.query('ALTER TABLE ' + TABLE + ' ENABLE ROW LEVEL SECURITY');
    await client.query('GRANT USAGE ON SCHEMA public TO ' + ROLE);
    await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ' + TABLE + ' TO ' + ROLE);
    await client.query(`INSERT INTO ${TABLE} (id,tenant_id,marker)
      VALUES (1,1,'synthetic-tenant-one'), (2,2,'synthetic-tenant-two')`);

    // Rehearse the current zero-policy RLS default-deny design. No permanent
    // policy is added to any real or existing Payload collection.
    const beforePolicies = (await client.query(`
      SELECT count(*)::int AS n FROM pg_catalog.pg_policy
      WHERE polrelid = $1::regclass
    `, [TABLE])).rows[0].n;
    assert.equal(beforePolicies, 0, 'Fixture must begin with zero policies');
    const ownerRlsActive = (await client.query(
      'SELECT pg_catalog.row_security_active($1::regclass) AS active', [TABLE],
    )).rows[0].active;
    assert.equal(ownerRlsActive, false, 'Owner/superuser bypass must be observed');

    await asRestricted(client);
    const observed = (await client.query(`
      SELECT current_user AS active_role,
        (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) AS is_superuser,
        (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user) AS can_bypass_rls,
        (SELECT rolcanlogin FROM pg_catalog.pg_roles WHERE rolname=current_user) AS can_login,
        pg_catalog.row_security_active($1::regclass) AS rls_active,
        has_schema_privilege(current_user,'public','CREATE') AS can_create_schema
    `, [TABLE])).rows[0];
    assertRestrictedRoleEvidence(observed);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM ' + TABLE)).rows[0].n, 0,
      'Zero-policy RLS must deny reads');
    await expectRlsDenied(client,
      'INSERT INTO ' + TABLE + ' (id,tenant_id,marker) VALUES (9,1,$1)', ['no-policy']);
    await asOwner(client);

    // CI-only example of intended restrictive, tenant-scoped policies.
    // Application-policy design still requires human review and real staging
    // CRUD tests; these synthetic statements MUST NOT be copied to production.
    await client.query(`CREATE POLICY hls_ci_select ON ${TABLE}
      FOR SELECT TO ${ROLE} USING (tenant_id = 1)`);
    await client.query(`CREATE POLICY hls_ci_insert ON ${TABLE}
      FOR INSERT TO ${ROLE} WITH CHECK (tenant_id = 1)`);
    await client.query(`CREATE POLICY hls_ci_update ON ${TABLE}
      FOR UPDATE TO ${ROLE} USING (tenant_id = 1) WITH CHECK (tenant_id = 1)`);
    await client.query(`CREATE POLICY hls_ci_delete ON ${TABLE}
      FOR DELETE TO ${ROLE} USING (tenant_id = 1)`);

    await asRestricted(client);
    const visible = (await client.query('SELECT id FROM ' + TABLE + ' ORDER BY id')).rows;
    assert.deepEqual(visible.map(r => r.id), [1], 'Cross-tenant row must remain hidden');
    assert.equal((await client.query(`INSERT INTO ${TABLE} (id,tenant_id,marker)
      VALUES (3,1,'synthetic-allowed') RETURNING id`)).rows[0].id, 3);
    await expectRlsDenied(client,
      'INSERT INTO ' + TABLE + ' (id,tenant_id,marker) VALUES (4,2,$1)', ['forbidden-tenant']);
    assert.equal((await client.query(`UPDATE ${TABLE}
      SET marker='changed' WHERE id=3 RETURNING id`)).rowCount, 1);
    assert.equal((await client.query(`UPDATE ${TABLE}
      SET marker='forbidden' WHERE id=2 RETURNING id`)).rowCount, 0);
    await expectRlsDenied(client,
      'UPDATE ' + TABLE + ' SET tenant_id=2 WHERE id=3 RETURNING id');
    assert.equal((await client.query('DELETE FROM ' + TABLE + ' WHERE id=2 RETURNING id')).rowCount, 0);
    assert.equal((await client.query('DELETE FROM ' + TABLE + ' WHERE id=3 RETURNING id')).rowCount, 1);
    assert.deepEqual((await client.query('SELECT id FROM ' + TABLE + ' ORDER BY id')).rows.map(r => r.id), [1]);
    await asOwner(client);

    // No writes survive: the same transaction includes CREATE ROLE, all
    // policies and synthetic data, so even an error rolls every fixture back.
    await client.query('ROLLBACK');
    transaction = false;
    const cleanup = (await client.query(`
      SELECT to_regclass('public.hls_ci_role_policy_probe') IS NULL AS no_fixture_table,
        NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1) AS no_fixture_role
    `, [ROLE])).rows[0];
    assert.equal(cleanup.no_fixture_table, true, 'Fixture table survived rollback');
    assert.equal(cleanup.no_fixture_role, true, 'Fixture role survived rollback');
    success = true;
  } finally {
    if (connected) {
      if (transaction) {
        try { await client.query('ROLLBACK'); } catch { /* fail closed */ }
      }
      await client.end();
    }
  }
  if (success) {
    console.log('MOCK_CMS_DEFAULT_DENY_RLS_PASS');
    console.log('MOCK_CMS_TENANT_POLICY_CRUD_PASS');
    console.log('MOCK_CMS_CROSS_TENANT_DENIAL_PASS');
    console.log('MOCK_CMS_ROLE_AND_POLICY_ROLLBACK_PASS');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  rehearseRestrictedCmsRole().catch(error => {
    // Never print connection exceptions, SQL params or dynamic messages.
    console.error(error?.code === 'MOCK_ROLE_REHEARSAL_CI_ONLY'
      ? 'MOCK_ROLE_REHEARSAL_CI_ONLY' : 'MOCK_ROLE_REHEARSAL_FAILED');
    process.exitCode = 1;
  });
}
