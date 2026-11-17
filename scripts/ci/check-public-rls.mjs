/**
 * CI-only, read-only RLS regression gate. It refuses every non-mock connection.
 * Run AFTER all Payload migrations on GitHub's disposable PostgreSQL service.
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const FIXTURE_URI = 'postgres://mock:mock@localhost:5432/mock'

export function assertDisposableUri(uri) {
  if (uri !== FIXTURE_URI) throw new Error('RLS_CI_NOT_DISPOSABLE_DATABASE')
}

export function assertRlsCoverage(rows) {
  if (!Array.isArray(rows)) throw new Error('RLS_CI_INVALID_CATALOG_RESULT')
  if (rows.length !== 0) {
    throw new Error('RLS_CI_GAP_' + rows.length + '_TABLES')
  }
}

export async function checkPublicRls() {
  const uri = process.env.DATABASE_URI
  assertDisposableUri(uri)
  const { Client } = await import('pg')
  const client = new Client({ connectionString: uri, connectionTimeoutMillis: 5000 })
  let inTransaction = false
  try {
    await client.connect()
    await client.query('BEGIN READ ONLY')
    inTransaction = true
    const { rows } = await client.query(`
      SELECT c.relname AS table_name
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND NOT c.relrowsecurity
      ORDER BY c.relname
    `)
    assertRlsCoverage(rows)
    console.log('RLS_CI_COVERAGE_PASS: all ordinary/partitioned public tables protected')
  } finally {
    if (inTransaction) await client.query('ROLLBACK').catch(() => {})
    await client.end().catch(() => {})
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkPublicRls().catch((error) => {
    console.error(error?.message || 'RLS_CI_CHECK_FAILED')
    process.exitCode = 1
  })
}
