import assert from 'node:assert/strict';
import { Client } from 'pg';
const expected = 'postgres://mock:mock@localhost:5432/mock';
assert.equal(process.env.DATABASE_URI, expected);
assert.equal(process.env.HLS_CI_OFFLINE_CONTAINER, '1');
const db = new Client({ connectionString: expected, ssl: false });
await db.connect();
try {
  const tables = ['indexnow_attempts', 'indexnow_attempt_items', 'indexnow_attempt_reviews'];
  const { rows } = await db.query(`SELECT relname, relrowsecurity FROM pg_class
    JOIN pg_namespace n ON n.oid = pg_class.relnamespace WHERE n.nspname='public'
    AND relname = ANY($1::text[])`, [tables]);
  assert.equal(rows.length, tables.length, 'Expected all three audited IndexNow tables');
  for (const row of rows) assert.equal(row.relrowsecurity, true, row.relname + ' must have RLS');
  // Temporary low-privilege role and synthetic row are fully rolled back.
  await db.query('BEGIN');
  try {
    await db.query('CREATE ROLE hls_ci_rls_probe NOLOGIN');
    await db.query('GRANT USAGE ON SCHEMA public TO hls_ci_rls_probe');
    for (const table of tables) await db.query(`GRANT SELECT ON public.${table} TO hls_ci_rls_probe`);
    const uuid = '00000000-0000-4000-8000-000000000001';
    await db.query(`INSERT INTO indexnow_attempts(id,state,approved_build,actor_id)
      VALUES($1,'reserved','2026-11-11T12:00:00Z','ci-rls-probe')`, [uuid]);
    await db.query('SET LOCAL ROLE hls_ci_rls_probe');
    assert.equal((await db.query('SELECT current_user')).rows[0].current_user, 'hls_ci_rls_probe');
    const visible = await db.query('SELECT count(*)::int AS n FROM indexnow_attempts WHERE actor_id=$1', ['ci-rls-probe']);
    assert.equal(visible.rows[0].n, 0, 'RLS must hide the synthetic row from unprivileged role');
  } finally { await db.query('ROLLBACK'); }
  console.log('PASS: all IndexNow tables enable RLS; non-owner role cannot read synthetic attempt');
} finally { await db.end(); }
