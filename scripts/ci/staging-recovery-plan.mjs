/**
 * Credential-free OFFLINE staging/rollback plan validator.
 *
 * A passing static plan NEVER proves Neon/R2/Hostinger provider identity,
 * actual permissions, a backup, a restore, or owner release authorization.
 * No network, database, filesystem, environment, or secret access.
 */
import { validateStagingOrigin } from './hostinger-staging-preflight.mjs';

function exactFields(value, names, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== [...names].sort().join(',')) {
    throw new Error(label + ': missing or unexpected fields; staging plan refused');
  }
}
function requiredId(value, label) {
  if (typeof value !== 'string' || value.length > 100 ||
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(value)) {
    throw new Error(label + ': invalid identifier; staging plan refused');
  }
  return value;
}
function requiredBranch(value, label) {
  if (typeof value !== 'string' || value.length > 100 ||
      !/^br-[a-z0-9-]+$/.test(value)) {
    throw new Error(label + ': invalid branch identifier; staging plan refused');
  }
  return value;
}
function requiredBucket(value, label) {
  if (typeof value !== 'string' || value.length < 3 || value.length > 63 ||
      !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(value) ||
      value.includes('..')) {
    throw new Error(label + ': invalid R2 bucket; staging plan refused');
  }
  return value;
}

/**
 * Reject obviously unsafe resource/restore plans BEFORE any provider action.
 * Independently authenticated provider inventory is required afterwards.
 */
export function validateStagingRecoveryPlan(plan) {
  exactFields(plan, ['sourceSha', 'hostinger', 'neon', 'r2', 'restore'], 'Release');
  if (typeof plan.sourceSha !== 'string' || !/^[a-f0-9]{40}$/.test(plan.sourceSha)) {
    throw new Error('Source commit must be an exact 40-character SHA; staging plan refused');
  }
  exactFields(plan.hostinger, ['stagingOrigin', 'stagingInstanceId', 'productionInstanceId'], 'Hostinger');
  validateStagingOrigin(plan.hostinger.stagingOrigin);
  const hostStage = requiredId(plan.hostinger.stagingInstanceId, 'Hostinger staging');
  const hostProd = requiredId(plan.hostinger.productionInstanceId, 'Hostinger production');
  if (hostStage === hostProd) {
    throw new Error('Hostinger staging must use a distinct instance; staging plan refused');
  }

  exactFields(plan.neon, ['stagingProjectId', 'stagingBranchId', 'productionProjectId', 'productionBranchId', 'stagingDataOrigin'], 'Neon');
  const stageProject = requiredId(plan.neon.stagingProjectId, 'Neon staging project');
  const prodProject = requiredId(plan.neon.productionProjectId, 'Neon production project');
  const stageBranch = requiredBranch(plan.neon.stagingBranchId, 'Neon staging branch');
  const prodBranch = requiredBranch(plan.neon.productionBranchId, 'Neon production branch');
  // A normal Neon branch copies its parent snapshot. Require a distinct
  // EMPTY project for staging rather than cloning real production content.
  if (stageProject === prodProject || stageBranch === prodBranch ||
      plan.neon.stagingDataOrigin !== 'new-empty-project-with-synthetic-fixtures') {
    throw new Error('Neon staging must be a separate empty project with synthetic data; staging plan refused');
  }

  exactFields(plan.r2, ['stagingBucket', 'productionBucket', 'stagingKeyScope'], 'R2');
  const stageBucket = requiredBucket(plan.r2.stagingBucket, 'R2 staging');
  const prodBucket = requiredBucket(plan.r2.productionBucket, 'R2 production');
  if (stageBucket === prodBucket || plan.r2.stagingKeyScope !== 'staging-bucket-only') {
    throw new Error('R2 staging bucket and declared key scope must be isolated; staging plan refused');
  }

  exactFields(plan.restore, ['sourceProjectId', 'sourceBranchId', 'targetProjectId', 'targetBranchId', 'dataOrigin'], 'Restore');
  const sourceProject = requiredId(plan.restore.sourceProjectId, 'Restore source project');
  const sourceBranch = requiredBranch(plan.restore.sourceBranchId, 'Restore source branch');
  const targetProject = requiredId(plan.restore.targetProjectId, 'Restore target project');
  const targetBranch = requiredBranch(plan.restore.targetBranchId, 'Restore target branch');
  if (sourceProject !== stageProject || sourceBranch !== stageBranch ||
      targetProject !== stageProject || targetBranch === stageBranch ||
      targetProject === prodProject || targetBranch === prodBranch ||
      plan.restore.dataOrigin !== 'staging-synthetic-only') {
    throw new Error('Restore must target a distinct disposable branch with staging-only synthetic data; staging plan refused');
  }

  // Deliberately never echo operator identifiers or imply real approval.
  return Object.freeze({
    kind: 'staging-and-restore-plan-static-check',
    sourceHeadSha: plan.sourceSha,
    staticSafetyChecksPassed: true,
    realProviderIsolationVerified: false,
    realBackupRestoreVerified: false,
    ownerReleaseApprovalVerified: false,
    productionReleaseAuthorized: false,
  });
}
