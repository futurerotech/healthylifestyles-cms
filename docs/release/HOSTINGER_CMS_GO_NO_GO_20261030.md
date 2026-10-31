# HealthyLifeStyles CMS — release acceptance and Go/No-Go

**Decision at 2026-10-30: NO-GO for production changes; CODE CI PASS.**
This is an evidence ledger, not permission to merge, deploy, migrate, publish, or submit IndexNow.
The public Astro frontend and the Payload CMS have separate hosting and acceptance gates.

## Verified code and test evidence

| Scope | Exact reviewed head | GitHub Actions | Result |
| --- | --- | --- | --- |
| IndexNow release candidate, draft PR #34 | `9eebdb4411a068a524c8d3e8779ad40d0382ac2e` | [41090191372](https://github.com/futurerotech/healthylifestyles-cms/actions/runs/41090191372) | COMPLETED / SUCCESS |
| Combined QA, draft PR #36 | `cb4bd9078d3191d4548092f6ebb488021b3ad2ed` | [41090221727](https://github.com/futurerotech/healthylifestyles-cms/actions/runs/41090221727) | COMPLETED / SUCCESS |
| Search Intelligence, draft PR #35 | `32c8629db9f1ba9e4768b1823f1a7567255335de` | Prior CI success; separate scope | NOT approved for release |

PR #36 CI's actual job log reports **195 unit tests in 27 files** and **25 integration tests in 4 files**, plus TypeScript, disposable PostgreSQL migration chain and restore rehearsal, high-severity security gate, production `npm run build`, built Next/Payload runtime smoke, admin/editor HTTP authorization and article-draft confidentiality. This CI uses only **disposable mock PostgreSQL**, not production Neon. A green CI result proves neither Hostinger staging nor the public Vercel deployment was changed.

Diff review: draft PR #34 changes application, admin and test code plus package/lockfile and CI; **no file under the CMS migrations directory is in its changed-file list**. This is not a guarantee that production database schema is compatible; inspect actual startup, environment and migration status in staging. Do not automatically run migrations on production.

## Deployment ownership (do not conflate these)

- **Hostinger** hosts `https://cms.healthylifesstyles.com` (Next.js/Payload CMS and admin). Neon PostgreSQL stores CMS data.
- **Vercel** builds and hosts the public **Astro** frontend `https://www.healthylifesstyles.com`. Cloudflare R2 supplies media.
- The CMS's manual Deploy action requests an **Astro** build through the Vercel deploy hook. That action is NOT a deployment of the Hostinger CMS itself.
- A Vercel GitHub status on the CMS repository does not prove that the Hostinger CMS build failed. Evaluate CMS build with its Hostinger-equivalent CI command and an independently approved Hostinger staging deployment.
- IndexNow provider submission is a separate, later step **after** an actual public Astro build is Ready and verifiably contains the current CMS revisions.

## Hostinger staging: required acceptance, not yet run

A designated operator must first supply an **isolated, authorized Hostinger staging deployment** and staging-only data; do not copy personal health data or production secrets to CI. The current assistant has no authenticated staging/Hostinger deploy session and therefore **cannot attest** to the checks below.

1. Record the exact candidate commit, Hostinger Node runtime, target database identity, and runtime environment *variable names only*. Never paste tokens or connection strings into PRs or logs.
2. Confirm a protected, restorable **Neon database backup** and an approved rollback route. Use a staging database, distinct from production, for all tests; no production migration/DDL during evaluation.
3. Ensure staging has **`INDEXNOW_DISABLE=true`** and no live submission opt-in. Keep real Vercel deploy hook disabled/unconfigured during testing. Do not send indexing API requests or public build requests.
4. Install the exact lockfile dependencies with `npm ci`; check `npm run security:check`, `npm run check:domain`, `npx tsc --noEmit` and `npm run build` with approved staging configuration. The build must not execute production migrations as a side effect.
5. Start the built CMS using the actual Hostinger process configuration; verify `/admin/login`, admin auth, read permissions and audit logs. Confirm the version is the exact candidate. Do not infer deployment from GitHub CI.
6. With **staging-only** editor/admin identities, verify editor draft creation, revision visibility to editor, anonymous draft privacy, no deploy queue event on a draft, admin-only queue read and no cross-origin deploy or IndexNow POST. Review results without leaking JWTs or user data.
7. Test manual deployment preview and IndexNow **dry-run** only; verify no Vercel hook call, no provider request, and queue unchanged. Confirm the disabled-tool and noindex gates on realistic staging records.
8. Confirm rollback restores the previous build and database state in staging, and that unrelated CMS content, image references, sitemap, redirects and ad configuration are not overwritten.

Stop on any failed assertion. Escalate a reproducible log (without secrets), and patch **only** an evidenced defect on a draft branch with another exact-head CI run.

## Separate public Astro + IndexNow acceptance (not yet authorized)

Only after a CMS release and a new real **public Astro Production Ready** deployment:

1. Read `/content-manifest.json` over HTTPS from the **exact canonical public origin** (no redirects); require a CMS-backed build with an up-to-date buildStartedAt, current revisions, and genuine rendered URL paths.
2. Verify the public HTML returns HTTP 200, the exact self-canonical, and no `noindex`/`none` directions. For **tools** require a current published and explicitly enabled CMS record.
3. Verify the 32-hex IndexNow key file at its exact public origin URL, with no redirect. Do not log the key. This verification is relevant **only** for a future authorized actual submission.
4. Log in as admin and run a **manual IndexNow dry-run preview**; verify URL/revision/build approval snapshots. Keep the pending queue unless a later **explicitly authorized** provider 200 is acknowledged with an exact-revision conditional queue update.
5. A Vercel build-hook 2xx is **not** Production Ready; neither a successful CI build nor a search-engine submission guarantees indexing.

Do not enable live IndexNow, clear pending queue entries, use Google's unsupported Indexing API for health pages, or publish article drafts from this acceptance plan.

## Final release gates

| Gate | Result as of 2026-10-30 |
| --- | --- |
| IndexNow code CI exact head | PASS |
| Integrated code, auth, PostgreSQL, build and runtime CI exact head | PASS |
| Hostinger **staging** running candidate, role and draft QA | **NOT VERIFIED — BLOCKER** |
| Production Neon backup/rollback approved and tested in staging | **NOT VERIFIED — BLOCKER** |
| Frontend Astro Production Ready manifest/key proof for later IndexNow send | **NOT VERIFIED — separate blocker for live IndexNow only** |
| Owner sign-off for merge and Hostinger production deployment | **NOT GRANTED** |
| Owner sign-off for actual IndexNow notification | **NOT GRANTED** |

**Current action:** keep PR #34, PR #35 and PR #36 as drafts. Freeze unrelated features. Release PR #34 ahead of PR #35 only after its own Hostinger staging and owner gates. PR #36 is an integration QA record and is **not** the production merge vehicle. Rerun exact-head CI if any candidate file changes.

## Isolated staging: admin IndexNow preview without live submission

Production-mode `/api/seo/reconcile-indexnow` previously required the live CMS
Origin even with `HLS_ISOLATED_STAGING=true`, blocking manual preview from
the isolated staging admin. The staging origin is now accepted for authenticated
**preview requests only**. Any JSON object with `confirm:true` is rejected
with HTTP 403 **before external page proof requests, provider calls or queue
acknowledgement**. Privileged Vercel deploy POST remains blocked in staging.
Non-staging production behavior and IndexNow owner controls remain unchanged.

The staging preview may read the *current public Astro manifest* but is **not
proof** of the staging dataset being deployed to Vercel, not an E2E deployment
test, and not approval for production indexing. `INDEXNOW_DISABLE=true`
and an unset deploy hook remain mandatory on staging.

## Hostinger production-mode isolated CMS staging origins (opt-in)

A Payload CMS staging app normally builds with `NODE_ENV=production`. The
legacy CORS/CSRF allowlist trusts only the real production CMS/frontend origins,
even if Payload `SERVER_URL` points to an alternate staging hostname. This
can prevent staging admin browser authentication or draft testing.

Release candidate PR #34 adds a fail-closed, **explicitly opted-in** staging
configuration. On an **authorized, separately deployed** Hostinger staging CMS,
set `HLS_ISOLATED_STAGING=true`, `HLS_STAGING_CMS_ORIGIN` to the owned
HTTPS staging subdomain of `healthylifesstyles.com`, and `SERVER_URL`
to that same exact origin. Require `INDEXNOW_DISABLE=true`, disable
`INDEXNOW_LIVE_ENABLED`, and REMOVE `VERCEL_DEPLOY_HOOK_URL`. Starting
staging with missing/mismatched settings fails fast. In that mode, Payload
CORS/CSRF trusts **only the staging CMS origin**, never the live frontend or
production CMS; the privileged Vercel deploy POST still rejects the staging
origin. Unconfigured production behavior stays unchanged.

**This does not create a Hostinger staging app or isolate its database.** The
owner must supply a staging-only database, confirm the exact deployed release
SHA, and explicitly authorize staging before running admin tests. Never reuse
Neon production credentials. No IndexNow or Vercel provider call is intended
or permitted in the staging acceptance procedure.

## Operator-initiated anonymous staging preflight

File: `scripts/ci/hostinger-staging-preflight.mjs`. This is a **GET-only** probe with zero credentials, disabled by default and gated by `HLS_STAGING_READ_ONLY_APPROVED=yes`. The operator must explicitly set `HLS_STAGING_ORIGIN` to the actual authorized HTTPS STAGING origin. It rejects the known live CMS and public site, localhost, IP targets, unowned external hosts, and trailing-dot aliases before making any requests. The sample staging hostname is illustrative only; it is NOT evidence that Hostinger staging exists.

Example invocation (substitute a real, approved staging hostname; this is NOT an existing deployed URL):
```sh
HLS_STAGING_ORIGIN=https://cms-qa.healthylifesstyles.com HLS_STAGING_READ_ONLY_APPROVED=yes node scripts/ci/hostinger-staging-preflight.mjs
```

The six checks cover admin login reachability, anonymous queue and user-directory denial, anonymous `/api/users/me` session, and *sampled* anonymous article and pSEO draft visibility. They log only names/statuses, not response bodies. This probe does not authenticate as a real user, prove revision SHA, test backups/rollback, cover all drafts or constitute a staging GO decision. On the actual isolated staging system, the existing authenticated CI role/release tests and manual rollback verification are **still mandatory**.

The GitHub workflow runs the *mocked unit tests for this probe only*; it never contacts Hostinger automatically or receives staging credentials.
## Non-production release-source provenance for PR #34

The final PR release-candidate CI job validates the **source head** against the GitHub PR merge checkout and event SHA before running tests; after building the Hostinger-equivalent CMS against disposable Postgres, it emits a short-lived, hash-only `cms-source-provenance-<run-id>` artifact. It includes source/tested SHAs, SHA-256 digests for the committed lockfile, code, workflow, and Next build ID. This mechanism was first verified on QA-only PR #36 (run 41127083051), but a **new green run on the final PR #34 head is mandatory** and cannot be inherited from PR #36.

To avoid source identity confusion: GitHub PR workflows typically test a synthetic merge; the SHA recorded in `testedCommitSha` is not necessarily `sourceHeadSha`. This is a release *traceability* check, not Hostinger staging, a signed artifact, proof of production installation, data backup/rollback, or authorization to deploy or send IndexNow. Keep IndexNow disabled and PR #34 draft until the separate owner/staging GO gate.

## Verified production migration ledger discrepancy (read-only; 2026-10-30)

A read-only inspection of Neon production and the archived October 16 branch
found the same 15 recorded Payload migration names in both branches. The checked-in
`src/migrations/index.ts` on **main** and PR #34 lists **16** migrations.
The database contains an additional `seo-audit-fix` entry absent from that
index, and does not record the two October 8 migrations
`20261008_190423_add_reset_password_requested_at` and
`20261008_225200_add_media_object_key`. Both referenced columns were
confirmed to exist already as nullable columns on the examined branches.
Their committed migration SQL uses `ADD COLUMN IF NOT EXISTS`, but no
production migration was run and idempotency alone is **not** a staging rehearsal.
The standalone `seo-audit-fix.ts` source is a separate opt-in editorial data
remediation script and is not in the migration index. This ledger mismatch
predates PR #34, which did not change the migration index.

Safe operator procedure: on an *authorized isolated staging copy*, first inspect
`SELECT name FROM payload_migrations ORDER BY id`; export ONLY the list
of migration names (no credentials or content) as JSON and run
`node scripts/ci/migration-ledger-audit.mjs --applied-file /secure/path/names.json`.
A mismatch exits with REVIEW_REQUIRED (exit code 2), **never modifies data**.
Then review `payload migrate:status` and rehearse required changes on the
staging-only database with tested recovery BEFORE requesting production approval.
Do not manually backfill `payload_migrations`, run a production migration,
or treat the old backup as a fresh restore point.

GitHub CI runs only synthetic offline unit tests for the checker; it never
contacts production Neon and cannot certify the live ledger. The exact release
commit still requires a green new CI run after this documentation/test change.

## Synthetic production-like migration ledger rehearsal

CI now runs a *real Payload migration command against a cloned disposable mock
PostgreSQL database*. The mock clone first gets the same **migration names** as
the Neon production ledger observed by read-only inspection (15 entries,
`seo-audit-fix` present, two Oct 8 names absent). Both October target columns
already exist. It takes a synthetic backup, invokes the Payload migration CLI,
checks resulting ledger entries, schema and synthetic pSEO fixtures, then restores
the pre-migration backup into a different mock database to check rollback.

Before/after and rollback also compare fingerprints of **every synthetic public table's row content** (excluding only the expected-changing Payload migration ledger) and of non-ledger sequence values; the check logs no row data or production secrets. A mismatch fails CI rather than reporting a successful rollback.

This does NOT use production data, real Hostinger staging, or Neon credentials,
so it cannot certify their deploy/restore path. A separate authorized staging
rehearsal, current recovery point and owner production approval remain mandatory.

## Built isolated staging mode smoke gate — CI mock only (2026-10-31)

The release-candidate workflow now boots the compiled Next/Payload CMS with
`HLS_ISOLATED_STAGING=true`, a simulated owned HTTPS staging origin, disabled
IndexNow and deploy integrations, and **disposable CI-only PostgreSQL**. The
bounded HTTP test verifies login reachability, anonymous queue denial,
production-origin rejection and staging-mode forbidden deploy/submit paths.
It never accesses Hostinger or live Neon, and is NOT a substitute for an
owner-approved isolated Hostinger staging instance, staging-only user-role
acceptance, fresh recovery point or demonstrated real rollback. A new exact-head
CI PASS is required before claiming this mock runtime gate has succeeded.

## Authenticated staging-only CI acceptance — 2026-10-31

The opt-in isolated-staging test now creates disposable Admin and Editor staff in mock PostgreSQL, checks queue role limits, and rejects authenticated stage-origin deploy and confirmed IndexNow before external fetch. It also confirms a preview attempt fails closed when the synthetic public manifest is unavailable. The workflow passes temporary 0600 mock JWTs to the built CMS HTTP smoke, where an actual authenticated Admin must receive `stagingPreviewOnly:true` and cannot deploy or submit IndexNow; Editor cannot read the queue. The runner deletes the token fixture, and no live credentials or production database are used. This remains a GitHub-only rehearsal; it does NOT verify real Hostinger staging, current Neon backup, or rollback. New head CI must pass.

## Isolated staging database fail-closed startup guard — 2026-10-31

When HLS_ISOLATED_STAGING=true, Payload startup now requires HLS_STAGING_DATABASE_HOST and HLS_PRODUCTION_DATABASE_HOST (hostnames only, no credentials) and confirms the current DATABASE_URI points to the declared staging endpoint, not to the declared production compute. It normalizes Neon `-pooler` aliases to catch the same underlying endpoint. If the two declared endpoints coincide, a declaration is missing, or the live URI hostname differs from the dedicated staging endpoint, startup fails closed before Payload is built. Operators must separately verify the branch/project identities in the Neon console; hostnames are not cryptographic attestations. Only a tightly gated GitHub Actions mock runtime/integration test is exempt for the exact disposable PostgreSQL fixture URI. Never store database passwords or complete connection strings in the release log. This guard does not provision staging or approve production deployment.

## Staging R2 media isolation — 2026-10-31

With HLS_ISOLATED_STAGING=true, startup now refuses a missing or shared R2 bucket, malformed R2 endpoint, missing staging credentials, and a configured public media URL that is not explicitly distinct from production. Operators must supply HLS_STAGING_R2_BUCKET, HLS_PRODUCTION_R2_BUCKET and, if a staging public CDN is used, HLS_STAGING_MEDIA_PUBLIC_URL and HLS_PRODUCTION_MEDIA_PUBLIC_URL. The exact GitHub Actions mock-only runtime has no configured R2 integration, and is allowed to remain disconnected. These are startup guardrails, not a verification of Cloudflare IAM: a separately restricted R2 API token and confirmation of bucket-level access remain an operator acceptance requirement. No production R2 writes or Hostinger deployment were performed. New exact-head CI must pass before considering this source change tested.

## R2 CDN alias hardening — 2026-10-31

After CI #41155577400 SUCCESS on the previous head, the staging media validator was tightened to compare full configured HTTPS CDN bases (including optional paths), reject encoded/ambiguous paths, and reject staging and production sharing a hostname even with different prefixes. This avoids accidentally using production media through a staging-looking path. Synthetic unit cases were added; this follow-up source change requires its own exact-head CI PASS. No actual R2 credentials, production bucket actions, Hostinger deploys, or Neon writes were performed.

## External outbound integration isolation — 2026-10-31

A staging-only handler gate returns HTTP 503 without external calls for push notifications, subscriber synchronization, AI-writing/SEO/assistant calls, backlink checks, CSV imports and pSEO generation. The gate is neutral in ordinary production mode and tested separately. It is defense in depth; independent runtime verification and review of remaining endpoints are required. No live services were changed. The last run for the preceding head (Actions 41156730319) was still in progress during this record, and the current new head needs its own CI result.

## Additional isolated staging outbound coverage — 2026-10-31

The shared staging-only outbound guard now covers all four AI article authoring endpoints through their common preflight, and blocks launching the detached site-audit crawler before creating an audit record. The weekly schema-flags report is forced into dry-run under isolated staging, so it cannot call the email transport. Existing production behavior remains unchanged. These edits still require exact-head CI verification and do not prove that all service integrations or actual Hostinger staging are isolated. Never enable live providers for staging. No production calls were made.

## Provider-route HTTP fail-closed acceptance — 2026-10-31

The recipe analyzer now rejects isolated-staging requests before invoking AI parsing or USDA. The built Next/Payload HTTP smoke checks 13 provider-backed POST paths and the backlink GET endpoint for HTTP 503 with a disposable administrator JWT. This extends coverage beyond testing the shared utility function alone. The mail-only schema flags cron intentionally remains a dry-run, not a blocked provider call. This is CI synthetic staging, NOT real Hostinger acceptance; new exact-head CI must pass and no real provider traffic is authorized.

## CI staging HTTP route collision follow-up — 2026-10-31

The built runtime returned HTTP 404 at POST /api/subscribers/sync, not 503, during Actions 41158782353. This may be due to Payload collection dynamic routing shadowing the custom sync endpoint; 404 alone is NOT evidence that the staging guard ran. The HTTP smoke now explicitly records and checks this current routing behavior, while a separate staging integration assertion invokes the protected handler directly and requires 503 before any subscriber writes or n8n calls. Production routing remains unchanged. Resolve the collision independently before asserting that subscriber sync is reachable in live CMS. This test correction requires fresh exact-head CI PASS; do not merge, deploy, or submit IndexNow.

## Collision-free API aliases — 2026-10-31

Real built-runtime smoke on Actions 41159250177 failed on legacy /api/backlinks/check with HTTP 404, matching the earlier /api/subscribers/sync collision. The collections expose dynamic /api/backlinks/:id and /api/subscribers/:id routes, which can intercept these custom paths. To preserve backwards compatibility, added distinct authenticated aliases /api/backlink-check (GET) and /api/subscriber-sync (POST) with the identical guarded handlers; legacy paths remain registered, not removed. Built HTTP staging CI must now assert 503 for both aliases, and separately record legacy /api/subscribers/sync 404 without treating that 404 as proof of protection. Existing cron/integration callers can migrate only after explicit release approval. New exact-head CI is required; no production changes.

## API alias authorization regression — 2026-10-31

Following the successful CI #41159938478 for exact head 87a77fba548993d158f932e6ee9ee4838f8c26ee (166 unit, 19 disposable DB integration, 5 staging-role integration, built HTTP staging aliases 503), added `src/endpoints/api-aliases.test.ts` using synthetic in-memory payload mocks. It checks that the new subscriber-sync alias denies a wrong shared secret and creates a synthetic subscriber with the expected secret, that the backlink-check alias rejects missing API credentials and safely runs an empty scan with the expected key, and that both refuse even authorized attempts in staging. These tests do not connect to live systems or relax existing access controls. Current source head 6222c4cbd97c9d6379f81e80757419f2503849cb needs exact-head CI acceptance. No production deployment or cron URL changes.
