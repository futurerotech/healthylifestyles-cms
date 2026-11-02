import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStagingRecoveryPlan } from './staging-recovery-plan.mjs';

const good = () => ({
  sourceSha: 'a'.repeat(40),
  hostinger: {
    stagingOrigin: 'https://cms-qa.healthylifesstyles.com',
    stagingInstanceId: 'hst-stage-001',
    productionInstanceId: 'hst-live-001',
  },
  neon: {
    stagingProjectId: 'holy-stage-001',
    stagingBranchId: 'br-synthetic-stage-001',
    productionProjectId: 'holy-production-001',
    productionBranchId: 'br-production-001',
    stagingDataOrigin: 'new-empty-project-with-synthetic-fixtures',
  },
  r2: {
    stagingBucket: 'hls-staging-media',
    productionBucket: 'hls-production-media',
    stagingKeyScope: 'staging-bucket-only',
  },
  restore: {
    sourceProjectId: 'holy-stage-001',
    sourceBranchId: 'br-synthetic-stage-001',
    targetProjectId: 'holy-stage-001',
    targetBranchId: 'br-synthetic-restore-001',
    dataOrigin: 'staging-synthetic-only',
  },
});

test('valid synthetic plan remains UNVERIFIED and unauthorized', () => {
  assert.deepEqual(validateStagingRecoveryPlan(good()), {
    kind: 'staging-and-restore-plan-static-check',
    sourceHeadSha: 'a'.repeat(40),
    staticSafetyChecksPassed: true,
    realProviderIsolationVerified: false,
    realBackupRestoreVerified: false,
    ownerReleaseApprovalVerified: false,
    productionReleaseAuthorized: false,
  });
});

test('rejects staging project or branch reused from production', () => {
  const sameProject = good();
  sameProject.neon.stagingProjectId = sameProject.neon.productionProjectId;
  assert.throws(() => validateStagingRecoveryPlan(sameProject), /separate empty project/);
  const sameBranch = good();
  sameBranch.neon.stagingBranchId = sameBranch.neon.productionBranchId;
  assert.throws(() => validateStagingRecoveryPlan(sameBranch), /separate empty project/);
});

test('rejects a plan to clone production records, even with distinct IDs', () => {
  const plan = good();
  plan.neon.stagingDataOrigin = 'cloned-from-production';
  assert.throws(() => validateStagingRecoveryPlan(plan), /separate empty project/);
});

test('refuses production restore sources and any non-disposable target', () => {
  const fromProd = good();
  fromProd.restore.sourceProjectId = fromProd.neon.productionProjectId;
  assert.throws(() => validateStagingRecoveryPlan(fromProd), /distinct disposable branch/);
  const sameStage = good();
  sameStage.restore.targetBranchId = sameStage.neon.stagingBranchId;
  assert.throws(() => validateStagingRecoveryPlan(sameStage), /distinct disposable branch/);
  const toProd = good();
  toProd.restore.targetProjectId = toProd.neon.productionProjectId;
  assert.throws(() => validateStagingRecoveryPlan(toProd), /distinct disposable branch/);
});

test('refuses production R2 bucket or broadly scoped staging access claim', () => {
  const reused = good();
  reused.r2.stagingBucket = reused.r2.productionBucket;
  assert.throws(() => validateStagingRecoveryPlan(reused), /R2 staging/);
  const broadKey = good();
  broadKey.r2.stagingKeyScope = 'all-buckets';
  assert.throws(() => validateStagingRecoveryPlan(broadKey), /R2 staging/);
});

test('rejects reused production Hostinger instance or unsafe staging origins', () => {
  const reused = good();
  reused.hostinger.stagingInstanceId = reused.hostinger.productionInstanceId;
  assert.throws(() => validateStagingRecoveryPlan(reused), /Hostinger staging/);
  for (const origin of [
    'https://cms.healthylifesstyles.com',
    'https://cms-qa.example.com',
    'http://cms-qa.healthylifesstyles.com',
    'https://user:pass@cms-qa.healthylifesstyles.com',
  ]) {
    const plan = good();
    plan.hostinger.stagingOrigin = origin;
    assert.throws(() => validateStagingRecoveryPlan(plan));
  }
});

test('rejects credentials or unknown resource fields without echoing them', () => {
  const databaseUri = good();
  databaseUri.neon.DATABASE_URI = 'postgres://owner:secret@example.com/db';
  assert.throws(() => validateStagingRecoveryPlan(databaseUri), /unexpected fields/);
  const secret = good();
  secret.r2.secretAccessKey = 'private-secret';
  assert.throws(() => validateStagingRecoveryPlan(secret), /unexpected fields/);
});

test('rejects malformed SHA, IDs and branch names', () => {
  const sha = good();
  sha.sourceSha = 'main';
  assert.throws(() => validateStagingRecoveryPlan(sha), /40-character SHA/);
  const branch = good();
  branch.restore.targetBranchId = 'production';
  assert.throws(() => validateStagingRecoveryPlan(branch), /invalid branch/);
  const instance = good();
  instance.hostinger.stagingInstanceId = '';
  assert.throws(() => validateStagingRecoveryPlan(instance), /invalid identifier/);
});
