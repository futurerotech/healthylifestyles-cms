import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { assertCiOnlyEnvironment, assertRoleIsolationEvidence } from '../scripts/ci/check-public-rls-role.mjs'

const validEnv = Object.freeze({ GITHUB_ACTIONS: 'true', CI: 'true', DATABASE_URI: 'postgres://mock:mock@localhost:5432/mock' })
const validResult = Object.freeze({
  databaseName: 'mock', sessionUser: 'mock', restrictedRole: 'hls_ci_rls_probe_20261116',
  isSuperuser: false, bypassRls: false, protectedCount: 157, inactiveCount: 0,
  ownerVisible: 1, restrictedVisible: 0, rowSecurityActive: true,
})

test('role probe rejects non-GitHub environment, missing CI flag, or non-mock URI', () => {
  assert.doesNotThrow(() => assertCiOnlyEnvironment(validEnv))
  for (const changed of [{ GITHUB_ACTIONS: 'false' }, { CI: 'false' }, { DATABASE_URI: 'postgres://prod:prod@localhost:5432/live' }]) {
    assert.throws(() => assertCiOnlyEnvironment({ ...validEnv, ...changed }), /RLS_ROLE_TEST_NOT_GITHUB_CI|RLS_CI_NOT_DISPOSABLE_DATABASE/)
  }
})

test('role probe accepts evidence with non-bypass role and RLS denial', () => {
  assert.doesNotThrow(() => assertRoleIsolationEvidence(validResult))
})

test('role probe fails closed for superuser/BYPASSRLS/owner/privilege false positives', () => {
  for (const changed of [
    { isSuperuser: true }, { bypassRls: true }, { restrictedRole: 'mock' },
    { databaseName: 'live' }, { sessionUser: 'other' }, { inactiveCount: 1 },
    { protectedCount: 0 }, { protectedCount: null },
    { ownerVisible: 0 }, { restrictedVisible: 1 }, { rowSecurityActive: false },
  ]) {
    assert.throws(() => assertRoleIsolationEvidence({ ...validResult, ...changed }), /RLS_ROLE_TEST_/)
  }
})
