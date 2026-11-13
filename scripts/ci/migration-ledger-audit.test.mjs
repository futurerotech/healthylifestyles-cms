import test from 'node:test';
import assert from 'node:assert/strict';
import { auditMigrationLedger, migrationNamesFromIndex, parseAppliedLedger } from './migration-ledger-audit.mjs';

test('parses registered migration names without importing or running source', () => {
  assert.deepEqual(migrationNamesFromIndex("export const migrations = [{ name: 'migration-a' }, { name: 'migration-b' }]"),
    ['migration-a', 'migration-b']);
});
test('reports matching ledgers without claiming production readiness', () => {
  const report = auditMigrationLedger(['old', 'new'], ['old', 'new']);
  assert.equal(report.status, 'MATCH');
  assert.equal(report.migrationExecutionAuthorized, false);
});
test('flags pending migrations and unregistered applied entries separately', () => {
  const report = auditMigrationLedger(['old', 'new-auth', 'new-media'], ['old', 'manual-seo']);
  assert.equal(report.status, 'REVIEW_REQUIRED');
  assert.deepEqual(report.registeredButNotApplied, ['new-auth', 'new-media']);
  assert.deepEqual(report.appliedButNotRegistered, ['manual-seo']);
});
test('parses SQL-result names and rejects unknown fields, duplicates and invalid input', () => {
  assert.deepEqual(parseAppliedLedger('[{"name":"init"},{"name":"later"}]'), ['init', 'later']);
  assert.deepEqual(parseAppliedLedger('{"appliedMigrations":["init"]}'), ['init']);
  assert.throws(() => parseAppliedLedger('[{"name":"init","password":"test"}]'));
  assert.throws(() => parseAppliedLedger('[{"name":"init"},{"name":"init"}]'));
  assert.throws(() => parseAppliedLedger('not json'));
  assert.throws(() => migrationNamesFromIndex('const migrations = []'));
  assert.throws(() => auditMigrationLedger(['one', 'one'], ['one']));
});
