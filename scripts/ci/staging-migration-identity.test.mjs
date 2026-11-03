import test from 'node:test';
import assert from 'node:assert/strict';
import { screenStagingMigrationTarget as screen } from './staging-migration-identity.mjs';

const safe = { enable: 'true', project: 'small-hall-15225012', branch: 'br-wandering-poetry-bcxj8s3v',
  reviewedSha: 'a'.repeat(40), checkedOutSha: 'a'.repeat(40), role: 'neondb_owner',
  databaseUri: 'postgres://neondb_owner:synthetic@ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech/neondb' };
const unverified = { targetScreened: true, providerIdentityVerified: false,
  databaseRoleVerified: false, tlsVerified: false, migrationAuthorized: false };
test('offline target screening never claims provider or migration authorization', () => {
  assert.deepEqual(screen(safe), unverified);
});
test('accepts the canonical Neon Connect TLS flags without claiming TLS verification', () => {
  assert.deepEqual(screen({ ...safe, databaseUri: safe.databaseUri + '?sslmode=require&channel_binding=require' }), unverified);
  assert.deepEqual(screen({ ...safe, databaseUri: safe.databaseUri + '?channel_binding=require&sslmode=require' }), unverified);
  assert.deepEqual(screen({ ...safe, databaseUri: safe.databaseUri + '?sslmode=require' }), unverified);
});
test('rejects changed project, branch, code, role, or disabled staging', () => {
  for (const changes of [{ enable: 'false' }, { project: 'holy-sea-80468476' },
    { branch: 'br-bitter-brook-advb1lch' }, { checkedOutSha: 'b'.repeat(40) },
    { role: 'production' }, { role: '' }]) assert.throws(() => screen({ ...safe, ...changes }));
});
test('rejects production host, disguised destinations, query overrides and missing credentials', () => {
  for (const uri of [
    safe.databaseUri.replace('ep-plain-forest-bca0vqud.c-16', 'ep-lucky-voice-ad5egz8d.c-2'),
    safe.databaseUri.replace('neon.tech', 'neon.tech.example'),
    safe.databaseUri + '?host=production.invalid',
    safe.databaseUri + '?port=4444',
    safe.databaseUri + '?sslmode=disable',
    safe.databaseUri + '?sslmode=prefer',
    safe.databaseUri + '?sslmode=require&sslmode=disable',
    safe.databaseUri + '?sslmode=require&sslmode=require',
    safe.databaseUri + '?channel_binding=disable',
    safe.databaseUri + '?sslmode=require&channel_binding=disable',
    safe.databaseUri + '?SSLMode=require',
    safe.databaseUri + '?application_name=test',
    safe.databaseUri.replace('/neondb', '/other'),
    safe.databaseUri.replace(':synthetic@', '@'),
  ]) assert.throws(() => screen({ ...safe, databaseUri: uri }));
});
test('does not leak input or credentials on failure', () => {
  try { screen({ ...safe, project: 'bad' }); assert.fail('expected rejection'); }
  catch (error) { assert.doesNotMatch(String(error), /synthetic|postgres:\/\//); }
});
