import assert from 'node:assert/strict';
import { Client } from 'pg';
const url = new URL(process.env.DATABASE_URI || 'postgres://invalid/invalid');
assert.ok(process.env.GITHUB_ACTIONS === 'true' && process.env.RUN_DATABASE_TESTS === '1' &&
  ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname === '/mock' && url.username === 'mock',
  'Restore validation requires the disposable CI database');
const original = new Client({ connectionString: url.toString() });
url.pathname = '/mock_restore';
const restored = new Client({ connectionString: url.toString() });
try {
  await original.connect();
  await restored.connect();
  const tables = async client => (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(row => row.tablename);
  const before = await tables(original);
  assert.deepEqual(await tables(restored), before, 'Restored table set differs');
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
  assert.equal((await restored.query('SELECT count(*)::int AS count FROM pseo_pages')).rows[0].count, 3,
    'Rehearsal must include the published/draft REST fixtures, not an empty database');
  console.log(`Disposable backup/restore verified: ${before.length} tables, ${rows} rows, exact data fingerprints, IDs, indexes and sequences. No production backup was accessed or claimed.`);
} finally {
  await original.end();
  await restored.end();
}
