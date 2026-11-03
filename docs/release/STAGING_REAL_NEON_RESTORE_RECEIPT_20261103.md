# HealthyLifeStyles: real Neon staging snapshot/restore receipt (2026-11-03)

**Scope:** isolated Neon project `small-hall-15225012` only. **No production access, PR merge, Hostinger deployment, or external indexing submission.** Read-only SQL was used for verification; provider snapshot, restore and cleanup operations are recorded below.

## Verified source and preconditions
- GitHub draft PR #60, tested source SHA `8da419d8110e526cc3a8264c424e0fd46277748b`; [CI 41594899354](https://github.com/futurerotech/healthylifestyles-cms/actions/runs/41594899354) passed PostgreSQL 16+18 checks. A passing CI is not proof that Hostinger has deployed this revision.
- Neon project: `small-hall-15225012` (`healthylifestyles-staging`), Free v3, PostgreSQL 18.6; distinct from the unrelated production project. The default branch is named `production` **inside this staging-only project**, not the real production database.
- Source branch `br-wandering-poetry-bcxj8s3v`, database `neondb`, 157 public base tables, 17 migration rows; articles/tools/users/media are 0 rows. Actual migration application occurred during the earlier protected workflow #41579807594; workflow status was failure because its old post-condition expected 16 rather than the actual 17 migrations (16 indexed plus inert `seo-audit-fix`).
- The protected workflow MUST NOT be retriggered on a nonempty source branch. No new migration tag was pushed in this verification.

## Real recovery drill (not mock)
1. Created separate staging-only comparison branch `br-falling-leaf-bc92q0fl` with name `hls-staging-restore-check-20261103` and parent `br-wandering-poetry-bcxj8s3v`. Initial attempt specifying a custom compute autosuspend was refused by Neon HTTP 412, so the branch was created with account defaults.
2. Read-only check on source and comparison branch found identical **157 public tables, 710 indexes, 1,015 constraints, 17 migration rows**, and identical schema-table and migration-name digests. Articles, tools, users and media all had 0 rows.
3. Created real manual Snapshot `snap-green-sky-bczx21i5` named `hls-staging-post-migrations-20261103` from the staging source branch.
4. Invoked `restore_snapshot` with **`finalize:false`**, new name `hls-staging-snapshot-restore-20261103`, and comparison target `br-falling-leaf-bc92q0fl`. The provider created `br-quiet-mountain-bcyz8quy` with `restore_status: restored` and `restored_from: snap-green-sky-bczx21i5`; no original branch swap or compute cutover was authorized.
5. Read-only SQL recheck matched source vs actual snapshot-restored branch: 157 tables, 710 indexes, 1,015 constraints, 17 migrations, and identical digests, with 0 rows in articles/tools/users/media. The original source branch was independently rechecked.
6. Deleted manual Snapshot `snap-green-sky-bczx21i5` after successful restore and verified `list_snapshots` returned `[]`. **The two new staging-only branches remain**; no deletion or reset was performed.

## Billing and limitations — do not overclaim
- Neon docs [Backup & restore](https://neon.com/docs/guides/backup-restore) say Free allows one manual snapshot **but snapshot storage is billed $0.09/GB-month**. The manually-created snapshot was promptly deleted to avoid ongoing snapshot storage. A short-lived charge cannot be ruled out; this must not be described as guaranteed zero-cost.
- Separate branch usage consumes Free-plan branch/compute quota; source+comparison+restored branch totaled 3, below the project owner's 10-branch limit when checked. This is not an unlimited-cost guarantee.
- This is authentic Neon *snapshot-to-new-branch restore* proof of schema fidelity. It is **not** a production recovery test, point-in-time recovery drill, content-rich backup proof, full ACL/auth proof, R2 object backup/restore, nor Hostinger application rollback.
- No staging business records were populated, so restored user-generated content fidelity is not tested. Do not treat an empty media table as proof that R2 object storage is isolated.
- No snapshot currently remains for long-term recovery. The restored branch is a staging-only recovery artifact, not a substitute for a validated and funded backup policy.

## Current release acceptance
| Gate | Status | Grounding |
| --- | --- | --- |
| Staging PostgreSQL schema / migrations | **PASS (read-only inventory)** | 157 tables / 17 rows / PostgreSQL 18.6 |
| Live Neon snapshot creation and restoration to separate branch | **PASS** | `restore_status: restored`, exact digest/structure parity |
| Original staging branch unaffected by test | **PASS for observed structure** | Source rechecked; no finalize or reset |
| Snapshot retention / zero-cost guarantee | **NOT CERTIFIED** | Snapshot deleted; potential prorated billing; no retained snapshot |
| Hostinger CMS staging deployment and real HTTP | **NOT VERIFIED / NO-GO** | No authenticated Hostinger deployment receipt; no verified runtime/build SHA |
| Cloudflare R2 credential bucket-only scope, media upload and restore | **NOT VERIFIED / NO-GO** | Code guards and user-provided token labels are not provider permissions proof |
| App backup/rollback against live Hostinger | **NOT VERIFIED / NO-GO** | Not yet exercised |
| Production release | **NO-GO** | No merges, DNS switch, production migration, publishing or IndexNow |

## Next primary path
1. Verify `cms-qa.healthylifesstyles.com` points to an **independent existing Hostinger app**, not to the production CMS or an email-linked Hostinger site; use only a checked source ref and dedicated staging vars. Do not touch live DNS or click deploy on the production instance.
2. Review staging R2 API credential resource scope in Cloudflare: dedicated bucket only, no production bucket access. Never paste the keys or DB URI into logs/chat.
3. After independent Hostinger staging app and R2 policy are proven, perform an approved staging-only deployment; use `npm run build`, no `payload migrate` auto-run. Capture exact deployed SHA and Next BUILD_ID.
4. Run credential-free anonymous read-only probe on that validated staging origin, then use synthetic-only admin/editor records for authenticated security checks.
5. Verify isolated app rollback to the prior build; never swap or restore the original Neon staging branch just to make a check pass. Production remains unchanged.

**No step in this document authorizes paid upgrades, snapshot retention, further resource creation, deleting a branch, merging PRs, or a production deployment.**
