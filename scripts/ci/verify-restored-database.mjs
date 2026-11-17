import assert from 'node:assert/strict';
import { Client } from 'pg';
import { postgresPoolOptions } from '../../src/lib/postgres-connection.ts';
const exactMockUri = 'postgres://mock:mock@localhost:5432/mock';
const profile = process.env.RUN_DATABASE_RESTORE_PROFILE || 'full-integration';
assert.equal(process.env.DATABASE_URI, exactMockUri, 'Restore must target exact disposable mock URI');
assert.ok(['full-integration', 'rls-pg18'].includes(profile), 'Unrecognized restore profile');
const url = new URL(exactMockUri);
assert.ok(process.env.GITHUB_ACTIONS === 'true' && process.env.RUN_DATABASE_TESTS === '1' &&
  ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname === '/mock' && url.username === 'mock',
  'Restore validation requires the disposable CI database');
const original = new Client(postgresPoolOptions(url.toString(), process.env.DATABASE_CA_CERT));
url.pathname = '/mock_restore';
const restored = new Client(postgresPoolOptions(url.toString(), process.env.DATABASE_CA_CERT));
try {
  await original.connect();
  await restored.connect();
  const tables = async client => (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(row => row.tablename);
  const before = await tables(original);
  assert.deepEqual(await tables(restored), before, 'Restored table set differs');
  // RLS semantics are schema state: pg_dump/pg_restore must preserve both
  // flags and actual policy definitions. Nonempty synthetic fixture makes the
  // comparison meaningful even when application tables have no policies.
  const rlsRelations = async client => (await client.query(`
    SELECT c.relname AS table_name, c.relkind AS table_kind,
           c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
    ORDER BY c.relname, c.relkind
  `)).rows;
  const rlsPolicies = async client => (await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `)).rows;
  const sourceRelations = await rlsRelations(original);
  assert.deepEqual(await rlsRelations(restored), sourceRelations, 'Restored RLS flags differ');
  const sourcePolicies = await rlsPolicies(original);
  assert.deepEqual(await rlsPolicies(restored), sourcePolicies, 'Restored RLS policy definitions differ');
  const fixture = sourceRelations.find(row => row.table_name === 'hls_ci_restore_rls_probe');
  assert.ok(fixture && fixture.rls_enabled === true && fixture.rls_forced === true,
    'Restore probe must exist with ENABLE and FORCE RLS');
  assert.ok(sourcePolicies.some(row =>
    row.tablename === 'hls_ci_restore_rls_probe' && row.policyname === 'hls_ci_restore_select'
      && row.cmd === 'SELECT' && String(row.qual).includes('ci-allow')),
    'Restore must preserve a nonempty synthetic RLS policy');
  console.log('RESTORE_RLS_METADATA_PASS: restored ENABLE/FORCE flags and synthetic policy definitions match source');
  let rows = 0;
  for (const table of before) {
    const identifier = '"' + table.replaceAll('"', '""') + '"';
    const query = `SELECT count(*)::int AS count, md5(coalesce(string_agg(value, E'\\n' ORDER BY value), '')) AS digest FROM (SELECT row_to_json(t)::text AS value FROM public.${identifier} t) rows`;
    const source = (await original.query(query)).rows[0];
    assert.deepEqual((await restored.query(query)).rows[0], source, `Restored row data differs in ${table}`);
    rows += source.count;
  }
  for (const query of [
    "SELECT sequencename, last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename",
    "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
  ]) assert.deepEqual((await restored.query(query)).rows, (await original.query(query)).rows, 'Restored sequence/index state differs');
  const expectedPseoRows = profile === 'full-integration' ? 3 : 0;
  assert.equal((await restored.query('SELECT count(*)::int AS count FROM pseo_pages')).rows[0].count, expectedPseoRows,
    'Unexpected fixture count for the isolated restore profile');
  assert.ok((await restored.query("SELECT count(*)::int AS count FROM public.hls_ci_restore_rls_probe")).rows[0].count === 2,
    'Restored RLS fixture must contain both synthetic rows');
  console.log(`Disposable backup/restore verified (${profile}): ${before.length} tables, ${rows} synthetic/fixture rows, row fingerprints, indexes, sequences, RLS flags and policies. --no-owner/--no-acl does NOT validate ownership or grants.`);
} finally {
  await original.end();
  await restored.end();
}
