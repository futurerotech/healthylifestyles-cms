import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { assertDisposableUri, assertRlsCoverage } from '../scripts/ci/check-public-rls.mjs'

test('CI RLS gate accepts only the synthetic disposable Postgres URI', () => {
  assert.doesNotThrow(() => assertDisposableUri('postgres://mock:mock@localhost:5432/mock'))
  for (const uri of [undefined, '', 'postgres://mock:mock@localhost:5433/mock', 'postgres://other:test@localhost:5432/mock', 'postgres://x:y@remote.example/db']) {
    assert.throws(() => assertDisposableUri(uri), /RLS_CI_NOT_DISPOSABLE_DATABASE/)
  }
})

test('CI RLS gate passes when every public table is protected', () => {
  assert.doesNotThrow(() => assertRlsCoverage([]))
})

test('CI RLS gate fails closed for at least one unprotected table', () => {
  assert.throws(() => assertRlsCoverage([{ table_name: 'articles' }]), /RLS_CI_GAP_1_TABLES/)
  assert.throws(() => assertRlsCoverage([{ table_name: 'a' }, { table_name: 'b' }]), /RLS_CI_GAP_2_TABLES/)
  assert.throws(() => assertRlsCoverage(null), /RLS_CI_INVALID_CATALOG_RESULT/)
})
