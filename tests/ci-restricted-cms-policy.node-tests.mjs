import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDisposableMockEnvironment,
  assertRestrictedRoleEvidence,
  MOCK_DATABASE_URI,
} from '../scripts/ci/rehearse-restricted-cms-policy.mjs';

const safe = Object.freeze({
  GITHUB_ACTIONS: 'true',
  CI: 'true',
  RUN_DATABASE_TESTS: '1',
  GITHUB_REPOSITORY: 'futurerotech/healthylifestyles-cms',
  DATABASE_URI: MOCK_DATABASE_URI,
});

test('only the exact Github Actions localhost/mock environment is permitted', () => {
  assert.doesNotThrow(() => assertDisposableMockEnvironment(safe));
  for (const [key, value] of [
    ['GITHUB_ACTIONS', 'false'], ['CI', 'false'], ['RUN_DATABASE_TESTS', '0'],
    ['GITHUB_REPOSITORY', 'some-other/repo'],
    ['DATABASE_URI', 'postgres://mock:mock@localhost:5432/production'],
    ['DATABASE_URI', 'postgres://mock:mock@127.0.0.1:5432/mock'],
    ['DATABASE_URI', 'postgres://mock:mock@localhost:5432/mock?host=remote.example'],
    ['DATABASE_URI', 'postgres://mock:mock@some-other.example:5432/mock'],
    ['DATABASE_URI', 'postgresql://mock:mock@localhost:5432/mock'],
    ['DATABASE_URI', ''],
  ]) {
    assert.throws(
      () => assertDisposableMockEnvironment({ ...safe, [key]: value }),
      { message: 'MOCK_ROLE_REHEARSAL_CI_ONLY' },
      key,
    );
  }
});

test('rejects a superuser, bypass, login, non-RLS or schema-owner role', () => {
  const good = {
    active_role: 'hls_ci_role_policy_probe',
    is_superuser: false, can_bypass_rls: false,
    can_login: false, rls_active: true, can_create_schema: false,
  };
  assert.doesNotThrow(() => assertRestrictedRoleEvidence(good));
  for (const fail of [
    { active_role: 'neondb_owner' }, { is_superuser: true },
    { can_bypass_rls: true }, { can_login: true },
    { rls_active: false }, { can_create_schema: true },
  ]) {
    assert.throws(() => assertRestrictedRoleEvidence({ ...good, ...fail }),
      { message: 'MOCK_ROLE_REHEARSAL_NOT_RESTRICTED' });
  }
  assert.throws(() => assertRestrictedRoleEvidence(null),
    { message: 'MOCK_ROLE_REHEARSAL_NOT_RESTRICTED' });
});
