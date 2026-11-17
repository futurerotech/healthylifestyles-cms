/**
 * CI-only real owner/ACL restore check on a disposable local PostgreSQL cluster.
 * Roles must already exist in the cluster: pg_dump never restores global roles.
 */
import assert from 'node:assert/strict'
import { Client } from 'pg'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const MOCK_URI = 'postgres://mock:mock@localhost:5432/mock'
const OWNER = 'hls_ci_restore_owner'
const READER = 'hls_ci_restore_reader'
const TABLE = 'hls_ci_owner_acl_probe'

export function assertMockEnvironment(env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.CI !== 'true' ||
      env.RUN_DATABASE_TESTS !== '1' || env.DATABASE_URI !== MOCK_URI) {
    throw new Error('OWNER_ACL_RESTORE_NOT_MOCK_CI')
  }
}
export function assertRoleEvidence(e) {
  if (!e || e.owner !== OWNER || e.rlsEnabled !== true ||
      e.forceRls !== false || e.totalRows !== 2 ||
      e.reader !== READER || e.superuser !== false || e.bypassRls !== false ||
      e.rlsActive !== true || e.canSelect !== true || e.canInsert !== false ||
      e.visibleRows !== 1 || e.schemaUsage !== true ||
      e.policyCount !== 1 || e.tableGrant !== true) {
    throw new Error('OWNER_ACL_RESTORE_EVIDENCE_FAILED')
  }
}
function urlFor(dbName) {
  const url = new URL(MOCK_URI)
  url.pathname = '/' + dbName
  return url.toString()
}
async function snapshot(client) {
  const identity = (await client.query('SELECT current_database() AS database, session_user AS db_user')).rows[0]
  const objects = (await client.query(`
    SELECT c.relname AS name, c.relkind AS kind,
           pg_catalog.pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl,
           c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind IN ('r','p')
     ORDER BY c.relname, c.relkind
  `)).rows
  const policies = (await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_catalog.pg_policies WHERE schemaname='public'
     ORDER BY tablename, policyname
  `)).rows
  const schemaAcl = (await client.query("SELECT nspacl::text AS acl FROM pg_catalog.pg_namespace WHERE nspname='public'")).rows[0]?.acl
  const fixture = objects.find(x => x.name === TABLE)
  const rows = (await client.query(`
    SELECT count(*)::int AS count,
      md5(coalesce(string_agg(id::text || ':' || marker, '|' ORDER BY id), '')) AS digest
    FROM public.hls_ci_owner_acl_probe
  `)).rows[0]
  let role, visibleRows
  await client.query('BEGIN READ ONLY')
  try {
    await client.query('SET LOCAL ROLE ' + READER)
    role = (await client.query(`
      SELECT current_user AS name, rol.rolsuper AS superuser, rol.rolbypassrls AS bypass,
        pg_catalog.row_security_active('public.hls_ci_owner_acl_probe'::regclass) AS active,
        has_table_privilege(current_user, 'public.hls_ci_owner_acl_probe', 'SELECT') AS can_select,
        has_table_privilege(current_user, 'public.hls_ci_owner_acl_probe', 'INSERT') AS can_insert,
        has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage
      FROM pg_catalog.pg_roles rol WHERE rol.rolname=current_user
    `)).rows[0]
    visibleRows = (await client.query('SELECT count(*)::int AS count FROM public.hls_ci_owner_acl_probe')).rows[0].count
  } finally {
    await client.query('ROLLBACK')
  }
  const evidence = {
    owner:fixture?.owner, rlsEnabled:fixture?.rls, forceRls:fixture?.force_rls,
    totalRows:rows?.count, reader:role?.name, superuser:role?.superuser,
    bypassRls:role?.bypass, rlsActive:role?.active, canSelect:role?.can_select,
    canInsert:role?.can_insert, visibleRows, schemaUsage:role?.schema_usage,
    policyCount:policies.filter(p => p.tablename===TABLE &&
      p.policyname==='hls_ci_restore_reader_select' && p.cmd==='SELECT' &&
      String(p.roles).includes(READER) && String(p.qual).includes('visible')).length,
    tableGrant:fixture?.acl?.includes(READER+'=r/')??false
  }
  assertRoleEvidence(evidence)
  return {identity,objects,policies,schemaAcl,rows,evidence}
}
export async function verifyOwnerAclRestore() {
  assertMockEnvironment(process.env)
  const original = new Client({connectionString:urlFor('mock'),connectionTimeoutMillis:5000})
  const restored = new Client({connectionString:urlFor('mock_owner_acl_restore'),connectionTimeoutMillis:5000})
  let a=false,b=false
  try {
    await original.connect();a=true
    await restored.connect();b=true
    const before=await snapshot(original),after=await snapshot(restored)
    assert.deepEqual(before.identity, {database:'mock',db_user:'mock'})
    assert.deepEqual(after.identity, {database:'mock_owner_acl_restore',db_user:'mock'})
    assert.ok(before.objects.length>=158,'Missing fresh mock CMS migration schema')
    assert.deepEqual(after.objects,before.objects,'Restored owner/table grants or RLS flags differ')
    assert.deepEqual(after.policies,before.policies,'Restored RLS policies differ')
    assert.equal(after.schemaAcl,before.schemaAcl,'Restored schema usage grants differ')
    assert.deepEqual(after.rows,before.rows,'Restored synthetic row fingerprints differ')
    assert.deepEqual(after.evidence,before.evidence,'Restricted role behavior changed')
    console.log('OWNER_ACL_RESTORE_PASS: owner, table/schema ACL, policy, RLS and restricted-row visibility preserved')
    console.log('OWNER_ACL_GLOBAL_ROLES_PREREQUISITE_PASS: synthetic cluster roles provisioned separately')
  } finally {
    if(a)await original.end().catch(()=>{})
    if(b)await restored.end().catch(()=>{})
  }
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  verifyOwnerAclRestore().catch(e=>{console.error(e?.message||'OWNER_ACL_RESTORE_FAILED');process.exitCode=1})
}
