# SEO Fixes Log — July 2026

## 2026-07-08

### Phase 0 — Auto-promotion pipeline
- Created `dev` branch from `main` head
- Created `.github/workflows/promote.yml` (push to dev → CI → fast-forward main)
- CI runs: `npm run check:domain` + `npx tsc --noEmit`
- Verified: green commit → main promoted ✅; red commit (type error) → main blocked ✅
- Backup tag: `backup/pre-seo-2026-07`
- Documented in `docs/DEPLOY.md`

### Phase 1 — /game/* verification
- Sitemap: 0 `/game/` entries
- Astro source: 0 route files for `/game/`
- Live test: `/game/test` returns 308 (redirect, not a page), `/game/` returns 308
- Conclusion: **External tool was wrong — no /game/ routes exist. Skipped.**

### Phase 2 — Broken external links

**2a — CDC link swap (re-verified 2026-07-08, no action needed)**
- Task premise: replace `https://www.cdc.gov/healthyweight/losing_weight/index.html`
  with `https://www.cdc.gov/healthy-weight-growth/index.html` in
  `/wellness-hub/how-long-does-it-take-to-lose-weight` and
  `/wellness-hub/how-many-calories-to-lose-weight`.
- **Independently re-verified against the CMS source-of-truth** (public REST API,
  read-only): the old URL appears **0 times** in either article. Both already
  link to `https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html`
  (the CDC 2024 reorg target), confirmed identical on the live rendered pages.
  → The literal find/replace matches nothing; **no content change applied.**
- Note: the task's proposed replacement (`/healthy-weight-growth/index.html`) is a
  *less* specific section root than what is already live
  (`/healthy-weight-growth/losing-weight/index.html`); swapping to it would be a
  regression, so it was not applied.
- **VERIFICATION BLOCKER:** CDC serves `403 Forbidden` to all automated clients
  (Akamai bot protection) — confirmed via both `curl` and WebFetch on every CDC
  URL. I therefore **cannot machine-confirm** whether the current link
  (`.../healthy-weight-growth/losing-weight/index.html`) is live (200) or dead.
  → **HUMAN STEP:** open that URL in a real browser. If it 200s, no action. If it
  404s/redirects, run the fixer below with the correct target:
  `OLD_URL="https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html" NEW_URL="<verified 200 CDC URL>" npx payload run scripts/seo/fix-external-link.ts`
- Tooling: added `scripts/seo/fix-external-link.ts` — idempotent, env-driven
  (`OLD_URL`/`NEW_URL`, `DRY=1`), replaces a URL across article `layout`/`sources`/
  `faq`/`excerpt` and republishes only changed docs. Reusable for 2b.

### Phase 3 — Toxic backlinks
- Created `docs/disavow.txt` with 8 domains (rankinghighseo.shop, blog5.net, qowap.com, blog2learn.com, onesmablog.com, jaiblogs.com, getblogs.net, dbblog.net)
- Created `scripts/seo/check-new-backlinks.ts` (weekly monitor, requires Ahrefs/Moz API key)
- Wired into `package.json` as `npm run audit:backlinks`
- **HUMAN STEP:** Upload disavow.txt at search.google.com/search-console/disavow-links
