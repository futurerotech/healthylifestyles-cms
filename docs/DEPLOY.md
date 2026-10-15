# Deployment Flow

## Current coordinated release hold (2026-10-15)

Implementation is local on `codex/seo-cms-sync` in both repositories. No push, production migration, or deployment is authorized. The frontend major security upgrade is separate; unresolved high/critical findings remain release blockers. A push to `dev` can automatically reach production, so obtain explicit approval before pushing.

## CMS-first migration and verification

1. Review the branches, run `npm test`, `npx tsc --noEmit`, `npm run check:domain`, and a database-isolated `npm run build:ci`. Compilation alone does not prove production migration compatibility.
2. Back up the production database and rehearse all pending migrations against a restored staging copy. Keep `ALLOW_DB_PUSH=false`; use registered migrations rather than schema push. The branch includes earlier pending auth/media migrations as well as `20261015_180000_unique_content_routes`.
3. Inspect duplicate slugs in articles, tools, pages, authors, tags, and category kind/slug pairs. The new migration refuses duplicates instead of deleting or renaming content. Resolve collisions with reviewed content edits and redirects before retrying. Its rollback deliberately preserves URL uniqueness.
4. After approval, deploy the CMS and apply reviewed migrations using the established release procedure. Verify public `pages` and `pseo-pages` reads return only published records. Confirm the deploy hook targets the intended frontend project without invoking it prematurely.
5. Deploy the frontend next using its deployment guide. Confirm the public `/content-manifest.json` identifies this CMS and contains rendered revisions. Until then the pending indicator may show verification unavailable; this must never mean the site is synchronized.
6. Rehearse publish/update/unpublish/delete/global changes in staging. Each change appends an immutable event. Requesting a build leaves events pending. The authenticated pending endpoint reconciles exact events against the deployed receipt; an older build cannot clear a newer edit.
7. Verify IndexNow is enabled only with the intended host/key. Automatic notifications occur after receipt confirmation. The manual endpoint accepts only deployed indexable URLs; it no longer calls Google's restricted Indexing API for general health pages.

Do not run a production build or migration with a placeholder database URL. The isolated build used for this review was compilation-only and did not access production data.

## Existing automatic promotion pipeline

1. All work is committed to the `dev` branch.
2. On push to `dev`, GitHub Actions runs CI:
   - `npm run check:domain` (domain spelling guard)
   - `npx tsc --noEmit` (type check)
   - `npm run build:ci` (build without DB migrations)
3. If CI passes → `main` is fast-forwarded to the `dev` commit automatically.
4. Hostinger detects the push to `main` → auto-deploys.
5. If CI fails → `main` is untouched → live site is unaffected.

## Rules
- **NEVER push to `main` directly.** Promotion is the workflow's job only.
- Use a local review branch before release approval. Landing on `dev` starts automatic production promotion.
- Verify locally first: `npm run build:ci` (exit 0) + `npx tsc --noEmit` (0 errors).

## Rollback

With release approval, select a known-good deployment and prepare a regular revert through `dev`. Rehearse database rollback compatibility separately; do not force-push `main` or assume a code rollback reverses database migrations.

## Branch setup (one-time, already done)
- `dev` branch created from `main` head
- `.github/workflows/promote.yml` created
- Backup tag: `backup/pre-seo-2026-07`

## GitHub repo settings (requires manual login)
1. Set `dev` as the default branch: Settings → Branches → Default branch → `dev`
2. Add branch protection rule for `main`: Settings → Branches → Add rule →
   - Branch name pattern: `main`
   - Require status checks to pass: ✅
   - Required: `ci` (from promote.yml)
   - Restrict who can push: only `github-actions[bot]`
3. Remove the Vercel integration if still present: Settings → Webhooks → remove Vercel
