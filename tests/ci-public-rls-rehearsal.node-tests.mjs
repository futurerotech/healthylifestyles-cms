import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { assertMockCiEnvironment, extractExactMigrationSql, assertRehearsalEvidence } from '../scripts/ci/check-public-rls-rehearsal.mjs'

const goodEnv = { GITHUB_ACTIONS: 'true', CI: 'true', DATABASE_URI: 'postgres://mock:mock@localhost:5432/mock' }
const goodEvidence = {
  database: 'mock', sessionUser: 'mock', beforeEnabled: false, firstEnabled: true, secondEnabled: true,
  beforeForced: false, firstForced: false, secondForced: false,
  beforePolicyCount: 1, firstPolicyCount: 1, secondPolicyCount: 1,
  beforeOwner: 'mock', firstOwner: 'mock', secondOwner: 'mock',
  beforeRows: 1, firstRows: 1, secondRows: 1,
}

test('mock-only rehearsal rejects remote and non-GitHub targets', () => {
  assert.doesNotThrow(() => assertMockCiEnvironment(goodEnv))
  for (const change of [{ CI: 'false' }, { GITHUB_ACTIONS: 'false' },
    { DATABASE_URI: 'postgres://mock:mock@localhost:5433/mock' },
    { DATABASE_URI: 'postgres://mock:mock@neon.example.com:5432/mock' }]) {
    assert.throws(() => assertMockCiEnvironment({ ...goodEnv, ...change }), /RLS_REPLAY_NOT_/)
  }
})

test('exact migration SQL extraction rejects structural drift and templates', () => {
  const goodSql = 'ALTER TABLE x ENABLE ROW LEVEL SECURITY, NOT c.relrowsecurity, format('
  assert.equal(extractExactMigrationSql('await db.execute(sql`' + goodSql + '`)'), goodSql)
  for (const source of ['', 'db.execute(sql`' + goodSql + '`)',
    'await db.execute(sql`SELECT 1`)', 'await db.execute(sql`' + goodSql + '${danger}`)']) {
    assert.throws(() => extractExactMigrationSql(source), /RLS_REPLAY_MIGRATION_/)
  }
})

test('rehearsal evidence verifies idempotence, preserved data, owner and policies', () => {
  assert.doesNotThrow(() => assertRehearsalEvidence(goodEvidence))
  for (const change of [{ firstEnabled: false }, { secondEnabled: false }, { secondForced: true },
    { firstPolicyCount: 0 }, { secondOwner: 'other' }, { secondRows: 0 }, { beforeEnabled: true },
    { database: 'live' }, { sessionUser: 'other' }]) {
    assert.throws(() => assertRehearsalEvidence({ ...goodEvidence, ...change }), /RLS_REPLAY_/)
  }
})
