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
