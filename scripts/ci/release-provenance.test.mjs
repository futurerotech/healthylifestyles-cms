import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCIIdentity } from './release-provenance.mjs';
const A = 'a'.repeat(40), B = 'b'.repeat(40), M = 'c'.repeat(40);
test('identifies PR merge and original source head separately', () => {
  assert.deepEqual(validateCIIdentity({
    eventName: 'pull_request', githubSha: M, checkoutSha: M,
    prHead: B, parents: [A, B],
  }), {
    testedCommitSha: M, sourceHeadSha: B, testedBaseSha: A,
    testMode: 'github-pull-request-merge',
  });
});
test('identifies direct push checkout', () => {
  const r = validateCIIdentity({
    eventName: 'push', githubSha: B, checkoutSha: B,
    prHead: '', parents: [A],
  });
  assert.equal(r.sourceHeadSha, B);
  assert.equal(r.testMode, 'branch-push');
  assert.equal(r.testedBaseSha, null);
});
test('rejects false exact-head claims and mismatched PR merge parents', () => {
  const ok = {eventName:'pull_request', githubSha:M, checkoutSha:M, prHead:B, parents:[A,B]};
  for(const bad of [
    {...ok,checkoutSha:A},
    {...ok,prHead:A},
    {...ok,parents:[A,A]},
    {...ok,parents:[A]},
    {...ok,prHead:''},
    {...ok,githubSha:'invalid'},
    {...ok,eventName:'pull_request_target'},
  ]) assert.throws(()=>validateCIIdentity(bad));
});
test('rejects push with PR metadata or mismatched checked-out commit', () => {
  const base={eventName:'push',githubSha:B,checkoutSha:B,prHead:'',parents:[A]};
  assert.throws(()=>validateCIIdentity({...base,prHead:A}));
  assert.throws(()=>validateCIIdentity({...base,checkoutSha:M}));
});
