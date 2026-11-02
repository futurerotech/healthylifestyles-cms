# HealthyLifeStyles CMS — combined-code staging readiness checkpoint

**Prepared:** 2026-11-02. **Decision: NO-GO for production release.**
This is a review artifact and operator checklist, not proof of a staging deployment, a backup, a successful rollback, a real Google Search Console permission, or authorization to merge/deploy.

## Versioned source evidence

- Combined draft review candidate: [CMS PR #46](https://github.com/futurerotech/healthylifestyles-cms/pull/46), baseline SHA `6077322233ee3d9c4f7d5e8f952e8f687c18829a`.
- Exact-head [CI #41520890710](https://github.com/futurerotech/healthylifestyles-cms/actions/runs/41520890710) succeeded: 276/276 unit tests, 25/25 disposable PostgreSQL integration tests, 5/5 isolated staging role tests, Next/Payload mocked build and runtime smoke. The **new origin-parity fix** in the child draft PR must pass CI on its own exact source commit; the baseline result does not certify it.
- Ancestor CMS review sequence: PR #36 → #38 → #39 → #40 → #42 → #43 → #44 → #46. They are still drafts, unmerged and unreleased. PR #34 (IndexNow) and PR #35 (GSC) remain separate, divergent branches, so individual CI success does not authorize combining/releasing them.
- File-level comparison against source branches confirms `src/lib/indexnow-postdeploy.ts` matches the reviewed PR #34 and the core `src/lib/gscAuthorizedReadOnlyAnalytics.ts` matches PR #35 in the baseline. This **does not** establish full feature parity or release approval.
- **Missing parity:** PR #35's isolated GSC operator script `scripts/seo/gsc-isolated-property-probe.mjs`, its dedicated CLI/mock tests and `tests/integration/gsc-payload-readonly.test.ts` are absent from the PR #46 branch. These are unreviewed integration gaps, not permission to copy/run a Google credential-bearing tool. The earlier GSC collector source-write denial remains in force.
- The remaining 10 npm audit notices are low-severity Payload/deepmerge lineage, not zero vulnerabilities.

## Fixed in this child review: staging origin contract parity

The read-only staging preflight originally accepted any HTTPS hostname, even one rejected by `src/lib/allowedOrigins.ts::resolveIsolatedStagingCmsOrigin`. It now requires a project-owned `*.healthylifesstyles.com` staging subdomain and continues to reject the real public/frontend/CMS hosts, IP literals, local hosts, URLs with credentials, paths, ports or queries.

This does **not** prove that any such hostname is a running Hostinger staging deployment. Use only the operator-approved actual hostname, and never point the preflight at production or an arbitrary third-party domain.

The probe is GET-only, credential-free and requires an explicit `HLS_STAGING_READ_ONLY_APPROVED=yes` gate. CI runs its synthetic tests only; it does not probe Hostinger.

## Direct Neon provider inventory — read-only observation (2026-11-02)

Connected Neon project inventory was inspected **without connecting to PostgreSQL, reading credentials, creating branches or restoring data**. The project returned three branches: one default production branch and two older backup-named branches. **No separately identified staging branch was found in this connected project.** Neither backup-named branch is authorized to serve as a testing database.

The production branch inventory reported branch protection disabled. An owner/operator should review production branch protection independently. This branch-name inventory cannot prove the status of any other Neon project or Cloudflare R2 bucket.

The new startup guard requires real-looking `*.neon.tech` compute host syntax for **both** staging and production references and the actual staging database URI, except for the explicitly gated disconnected CI mock. This avoids treating an arbitrary PostgreSQL hostname or a suffix-spoofed DNS name as a verified Neon endpoint. **It does NOT authenticate a Neon branch or prove that separate credentials, roles and compute exist.**

**Real staging status: NO-GO until an owner approves and independently verifies a dedicated staging branch, distinct compute/role identity, restricted R2 bucket, authorized Hostinger stage and staging-only backup/restore evidence.** No live resources were created or tested by this code change.

## Evidence still required — owner/operator-gated

| Release gate | Verification required | Current evidence |
| --- | --- | --- |
| Hostinger runtime | Approved isolated host running **exact reviewed SHA**, checked Node version and build ID | NOT VERIFIED |
| Staging CMS origin | Real approved owned staging subdomain and same-origin CORS/CSRF; `HLS_ISOLATED_STAGING=true` | Unit/mock checks only |
| Neon identity | Independently confirm staging branch, database, role permissions, compute ID distinct from production; do not expose connection strings | Code startup guard only |
| Cloudflare R2 | Dedicated staging bucket, restricted access key and public-media origin distinct from production; demonstrate inability to access production bucket | Code startup guard only |
| Security | Mock role tests passed; real staging anonymized auth, draft privacy, deploy and IndexNow denial need operator test | Mock checks only |
| Backlink egress | PR #46 validates public addresses and redirects in mocked tests; real Hostinger DNS/proxy behavior untested | Mock checks only |
| Backup and rollback | Verify an authorized staging-only backup, restore and previous application build rollback without touching production | Disposable CI backup rehearsal only |
| GSC | Resolve previous source edit authorization denial; preserve exact read-only scopes and no live requests until approved | NOT VERIFIED |
| Frontend release | Separately confirm Vercel production-ready build, manifest and sitemap **after explicit deployment approval** | NOT STARTED |
| Owner sign-off | Separate explicit approval for PR merges, Hostinger deployment, any production DB change and IndexNow submission | NOT GRANTED |

## Safe operator checklist (NO actual execution by this PR)

1. Record **only** source SHA, staging host and infrastructure resource identifiers, never secrets or raw URIs.
2. Confirm the proposed Hostinger instance is isolated and staging Neon/R2 credentials cannot access production, using provider console access controlled by the owner.
3. Obtain separate owner approval before any real staging deployment, staging HTTP probe or rollback exercise.
4. On approved isolated staging, check exact source/build identity, `npm ci`, TypeScript, security gate and the real application startup before authenticated testing.
5. Run the read-only staging probe with **an actual approved owned subdomain** and the explicit approval flag. Its report only tests anonymous response behavior; it cannot certify isolated resources.
6. Use dedicated synthetic staging-only admin/editor accounts for draft privacy, queued revision, disabled deploy/IndexNow, and staging media checks.
7. Demonstrate a protected staging backup, restore, and rollback to the prior build and staging database state. Log only sanitized evidence (status, hashes, timestamps), not content or credentials.
8. If any check fails, record NO-GO and repair a reproducible issue on a draft branch with exact-head CI. Never apply a configuration workaround to production.

**Release decision remains NO-GO**, regardless of passing mock CI. No merge, production data access or live indexing submission is authorized by this document.
