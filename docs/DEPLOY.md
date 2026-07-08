# Deployment Flow

## Auto-promotion pipeline (dev → main → Hostinger)

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
- No feature branches, no PRs for routine work.
- Verify locally first: `npm run build:ci` (exit 0) + `npx tsc --noEmit` (0 errors).

## Rollback

```bash
# Force main back to the pre-SEO backup tag:
git push origin backup/pre-seo-2026-07:main --force-with-lease
# Then trigger a Hostinger redeploy (push or manual restart).
```

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
