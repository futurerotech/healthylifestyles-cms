/**
 * GitHub Actions source provenance for a NON-DEPLOY release handoff.
 * No network, no credentials, no production calls. PR jobs normally checkout
 * a synthetic merge commit, NOT the PR head. Record both explicitly.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const shaPattern = /^[a-f0-9]{40}$/;
const OWN_REPO = 'futurerotech/healthylifestyles-cms';

export function validateCIIdentity({ eventName, githubSha, checkoutSha, prHead, parents }) {
  if (!shaPattern.test(githubSha) || !shaPattern.test(checkoutSha) ||
      githubSha !== checkoutSha) {
    throw new Error('The tested checkout does not match the GitHub event SHA.');
  }
  if (eventName === 'pull_request') {
    if (!shaPattern.test(prHead || '') || parents.length !== 2 ||
        parents.some(p => !shaPattern.test(p)) || parents[1] !== prHead) {
      throw new Error('Pull request checkout is not the verified merge of the claimed head.');
    }
    return {
      testedCommitSha: checkoutSha,
      sourceHeadSha: prHead,
      testedBaseSha: parents[0],
      testMode: 'github-pull-request-merge',
    };
  }
  if (eventName === 'push') {
    if (prHead) throw new Error('Push event unexpectedly declares a PR head.');
    return {
      testedCommitSha: checkoutSha,
      sourceHeadSha: checkoutSha,
      testedBaseSha: null,
      testMode: 'branch-push',
    };
  }
  throw new Error('Unsupported GitHub event for release provenance.');
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', timeout: 10000 }).trim();
}
function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
function main(argv = process.argv) {
  if (!['--verify', '--write'].includes(argv[2]) || argv.length !== 3) {
    throw new Error('Usage: release-provenance.mjs --verify|--write');
  }
  if (process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.GITHUB_REPOSITORY !== OWN_REPO ||
      !/^\d+$/.test(process.env.GITHUB_RUN_ID || '')) {
    throw new Error('Provenance can only run for the intended repository in GitHub Actions.');
  }
  const parts = git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/);
  const actual = git('rev-parse', 'HEAD');
  if (parts[0] !== actual) throw new Error('Git history changed during verification.');
  const identity = validateCIIdentity({
    eventName: process.env.GITHUB_EVENT_NAME,
    githubSha: process.env.GITHUB_SHA,
    checkoutSha: actual,
    prHead: process.env.HLS_EXPECTED_PR_HEAD || '',
    parents: parts.slice(1),
  });
  if (argv[2] === '--verify') {
    console.log('PASS: checked-out test commit and source head provenance verified (' +
      identity.testMode + ').');
    return;
  }
  // The build is not distributed here. Only hashes, never source bytes,
  // environment values, user data, signed JWTs or credentials.
  const files = [
    'package.json',
    'package-lock.json',
    '.github/workflows/promote.yml',
    'scripts/ci/release-provenance.mjs',
    'src/lib/indexnow-postdeploy.ts',
  ];
  const buildId = readFileSync('.next/BUILD_ID', 'utf8').trim();
  if (!buildId || buildId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(buildId)) {
    throw new Error('Missing or invalid built Next.js BUILD_ID.');
  }
  const proof = {
    schemaVersion: 1,
    kind: 'non-production-ci-source-provenance',
    repository: OWN_REPO,
    workflowRunId: process.env.GITHUB_RUN_ID,
    ...identity,
    fileSha256: Object.fromEntries(files.map(path => [path, digest(path)])),
    builtNextIdSha256: createHash('sha256').update(buildId).digest('hex'),
    releaseGate: {
      sourceAndMergeIdentityVerified: true,
      stagingHostingerVerified: false,
      backupAndRollbackVerified: false,
      ownerProductionApproval: false,
      indexingSubmissionAuthorized: false,
    },
    caveat: 'Source/test provenance only. This is not a production deployment attestation or a staging GO decision.',
  };
  const target = resolve('.ci-artifacts/release-provenance.json');
  mkdirSync(resolve('.ci-artifacts'), { recursive: true });
  writeFileSync(target, JSON.stringify(proof, null, 2) + '\n', { mode: 0o600 });
  console.log('PASS: wrote hash-only non-deploy CI provenance: ' + identity.testMode +
    ', source ' + identity.sourceHeadSha.slice(0, 12) +
    ', tested ' + identity.testedCommitSha.slice(0, 12));
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try { main(); } catch (error) {
    console.error('PROVENANCE NO-GO: ' + error.message);
    process.exitCode = 1;
  }
}
