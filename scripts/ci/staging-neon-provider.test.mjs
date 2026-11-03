import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyStagingNeonProvider as verify } from './staging-neon-provider.mjs';

const project = 'small-hall-15225012', branch = 'br-wandering-poetry-bcxj8s3v';
const host = 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech';
const input = { enable: 'true', project, branch, reviewedSha: 'a'.repeat(40), checkedOutSha: 'a'.repeat(40),
  role: 'stage_migrator', databaseUri: `postgres://stage_migrator:synthetic@${host}/neondb` };
function mock(changes = {}) {
  const calls = [];
  const values = [{ project: { id: project } }, { branch: { id: branch, project_id: project } },
    { endpoints: [{ project_id: project, branch_id: branch, host, type: 'read_write' }] }];
  return { calls, fetcher: async (url, options) => {
    calls.push({ url, options });
    const index = calls.length - 1;
    return Response.json(changes[index] ?? values[index]);
  } };
}
test('checks only staging control-plane GETs and never authorizes migration', async () => {
  const client = mock();
  assert.deepEqual(await verify(input, 'synthetic-token', client.fetcher),
    { providerIdentityVerified: true, databaseRoleVerified: false, tlsVerified: false, migrationAuthorized: false });
  assert.equal(client.calls.length, 3);
  for (const call of client.calls) {
    assert.equal(call.options.method, 'GET'); assert.equal(call.options.redirect, 'error');
    assert.ok(call.url.startsWith('https://console.neon.tech/api/v2/projects/' + project));
  }
});
test('rejects project, branch, endpoint, and write-mode mismatches', async () => {
  for (const changes of [
    { 0: { project: { id: 'other' } } }, { 1: { branch: { id: branch, project_id: 'other' } } },
    { 2: { endpoints: [{ project_id: project, branch_id: branch, host, type: 'read_only' }] } },
    { 2: { endpoints: [{ project_id: project, branch_id: 'other', host, type: 'read_write' }] } },
    { 2: { endpoints: [] } },
  ]) await assert.rejects(verify(input, 'synthetic-token', mock(changes).fetcher), /identity mismatch/);
});
test('invalid target and provider failures never reveal tokens or connect to a database', async () => {
  const client = mock();
  await assert.rejects(verify({ ...input, project: 'wrong' }, 'synthetic-token', client.fetcher));
  assert.equal(client.calls.length, 0);
  await assert.rejects(verify(input, 'synthetic-token', async () => { throw Error('synthetic-token'); }),
    error => !String(error).includes('synthetic-token'));
});
