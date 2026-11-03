# HealthyLifeStyles CMS - One-time staging migration operator runbook

**Scope:** isolated staging only. The presence of this file or passing CI never grants permission to migrate, merge or deploy production.

## Verified inventory (read-only, 2026-11-03)

- Neon staging project: small-hall-15225012 (PostgreSQL 18)
- Staging branch: br-wandering-poetry-bcxj8s3v (the branch is *named* production inside the separate staging project)
- Staging database and role: neondb, neondb_owner
- Staging direct read/write endpoint: ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech
- Staging R2 bucket: healthylifesstyles-staging-media (operator-provided; actual token scope not yet proven)
- Hostinger target: cms-qa.healthylifesstyles.com (operator-provided; deployment not yet verified)
- Production Neon project/branch and production R2 bucket are out of scope and must not be modified.
- Payload migration chain: 16 committed indexed schema migrations plus the inert `seo-audit-fix.ts` CLI file (discovered and recorded by `payload migrate` as a 17th no-op). CI on disposable PostgreSQL 16/18 is not evidence of real Neon execution.

## Real staging incident / read-only reconciliation — 2026-11-03

- Original protected-tag GitHub Actions run [41579807594](https://github.com/futurerotech/healthylifestyles-cms/actions/runs/41579807594) on SHA `8a45b177998817112b61e0baba17f9d6636414c3` exited 1 in the execution step after successful checkout, npm install and eight runner tests.
- A subsequent **read-only Neon SQL inspection** on the authorized staging project/branch `small-hall-15225012 / br-wandering-poetry-bcxj8s3v` found **157 public base tables and 17 rows** in `public.payload_migrations`, all stamped `2026-11-03 04:49:44 UTC`. Core `articles`, `tools`, `media`, `users`, `categories`, and `authors` tables exist. Article/tool/media/user/category row counts were zero. This supports completed schema application without copying production records.
- Root cause in the gate: old postcondition asserted **exactly 16** migration rows. The Payload CLI also records the inert `seo-audit-fix` file from `src/migrations` as a 17th migration, although its `up` function explicitly does nothing. The check was corrected to enforce the exact 17-name allowlist.
- **Do not rerun run 41579807594 or create another migration tag** for the already-nonempty staging branch. The fail-closed precondition is supposed to reject replay. Do not delete tables or reset the database to make the old one-time workflow pass.
- This incident reconciles schema state; it is **not** proof that the CMS runtime, token scope, actual backup/restore, Hostinger deployment or rollback has passed. Those remain independent GO/NO-GO gates. No production changes are authorized.

## Why this does not use workflow_dispatch

GitHub requires workflow_dispatch workflows to exist on the repository default branch. This migration workflow is developed on a draft feature branch and MUST NOT be merged merely to unlock dispatch.

Instead, the workflow .github/workflows/staging-neon-migration-once.yml listens for a **manually created lightweight tag** named staging-migrate-<exact-40-character-reviewed-commit-SHA>. It does not run on normal branch pushes or builds. Tag creation is a separate, intentional release-control operation. GitHub Actions must have permission to run tag-triggered workflows in the repository.

The execution job uses the staging-migration GitHub Environment. With independent operators, use required reviewers. **For this single-maintainer repository**, required reviewers cannot be populated: enable a 5-minute wait timer, disable administrator bypass, and restrict deployment to TAG refs matching staging-migrate-*. This solo-operator mode is a weaker control, not an independent approval. The exact reviewed SHA, separately-entered approved SHA and staging-only secrets remain mandatory. Do not trigger an unprotected environment.

## GitHub Environment configuration (owner/operator only)

Create a protected environment named staging-migration. Set Deployment branches and tags to Selected branches and tags, with a **Tag** rule (not a Branch rule) matching staging-migrate-*. If the rule displays Currently applies to 0 branches, remove that Branch rule and recreate it as Tag. For a sole maintainer, use the 5-minute wait timer and turn off Allow administrators to bypass configured protection rules; do not leave Required reviewers checked with an empty reviewer list. Verify the saved settings in GitHub before proceeding.

One environment **variable**:

- HLS_STAGING_MIGRATION_REVIEWED_SHA - the exact final 40-character reviewed commit SHA containing the migration runner and all preceding security changes.

Environment **secrets** (never put real values into GitHub files, issue comments or chat):

- HLS_STAGING_MIGRATION_ENABLE - literal yes; only set after explicit staging approval.
- HLS_STAGING_MIGRATION_APPROVED_SHA - same exact reviewed SHA, entered by the owner after reviewing the SHA and successful CI; this is not an independent human approval for a solo maintainer.
- HLS_NEON_STAGING_API_KEY - Neon control-plane credential capable of GET project, branch, endpoints, role and database, limited to staging if supported.
- HLS_STAGING_DATABASE_URI - Neon **direct** PostgreSQL 18 staging URI for neondb / neondb_owner, including secure credentials.
- HLS_STAGING_PAYLOAD_SECRET - independent secret never exposed in messages or production.
- HLS_STAGING_R2_ACCESS_KEY_ID - staging R2 bucket-only credential.
- HLS_STAGING_R2_SECRET_ACCESS_KEY - staging R2 bucket-only secret.

No production secrets, database URLs, indexing keys, deploy hooks or customer media should be accessible to this job. Verify the actual R2 token scope separately; its environment-variable labels alone do not prove isolation.

## Release gate and execution sequence

1. Have an authorized reviewer inspect the final branch, source SHA, exact-head PostgreSQL 18 CI, workflow diff and repository's existing automatic promotion rules. If the repository is maintained by one person only, the owner must personally validate these items; acknowledge that independent review is unavailable. Do not merge.
2. Confirm the protected GitHub Environment and credential sources above. Ensure the staging Neon project is separate from production; inspect provider inventory and staging bucket policy. No new billable resources without approval.
3. Confirm the production Hostinger app and frontend will be unaffected. Do not change Hostinger build command, which remains npm run build.
4. The authorized operator creates a **lightweight** tag pointing to the exact reviewed commit on the draft branch, following the name staging-migrate-<sha>, then pushes that tag. Do not point it to main or an arbitrary commit. Never create this tag before protected environment approval.
5. With an independent reviewer, wait for their explicit GitHub Environment approval. In solo-maintainer mode, the restricted Tag rule and saved wait timer must be verified; there is no second-person approval. After these gates GitHub checks out the exact commit, runs npm ci and offline safety tests, then launches the runner. The timer alone does NOT authorize migrations.
6. The runner verifies the tag/commit/approval secrets; rejects redirecting URI query parameters; authenticates Neon project, branch, endpoint, role, database and owner via read-only control-plane requests; then opens a certificate-verified TLS PostgreSQL connection with channel binding enabled. It checks actual current_user, database, PostgreSQL 18 and absence of all public base tables. TLS authentication is verified on the PostgreSQL client socket (CA/hostname), not via pg_stat_ssl: Neon's proxy may terminate external TLS before the backend, so pg_stat_ssl=false is not evidence of an insecure client-to-proxy connection. A nonempty schema refuses automatic replay.
7. Only after the checks pass does the runner invoke npm run migrate -- --force-accept-warning, with a constrained environment and no shell. It suppresses raw child stdout/stderr to prevent secret disclosure.
8. The runner reconnects using verified TLS and checks a populated schema and the **exact reviewed set of 17 recorded migration names**, rejecting missing, unknown, or duplicated names. The execution result is a sanitized status, not a full provider backup or release certificate.
9. A failure at any stage is NO-GO. Investigate privately, never reset staging schema or rerun migrations blindly. No automatic rollback or production fallback exists.
10. Once real staging migrations pass, keep npm run build for Hostinger and separately approve/test the staging deployment, real R2 isolation, staging-only restore, and staging application rollback. None is authorized by the migration receipt alone.

## Constraints and remaining independent verification

- Real Hostinger secrets are already supplied by the owner; they are not readable by GitHub, and copying them into an unprotected Actions context would be unsafe.
- CI can prove the runner and offline regression tests without provider access. The protected execution job cannot run without a reviewed SHA, environment secrets, manual tag creation and satisfied environment protection rules. Solo-maintainer mode cannot provide independent reviewer approval.
- Production release remains NO-GO; no PR merge, DNS cutover, production migration, production R2 access or IndexNow submission.
- Review the exact GitHub Actions run and compare its source SHA to the final approved commit; retain only sanitized CI evidence.
