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

**2b — Full external-link scan + verified replacements (2026-07-09)**
- Scan: 142 sitemap pages, 230 unique external **citation** links (social-share,
  analytics, and asset hosts excluded — they only 403/redirect for bots). Result:
  210 × 200, 14 × 403 (authority bot-blocks), 5 × 404, 1 × 000.
- **Category 1 (non-authority genuinely dead): EMPTY** — every non-200 is a gov /
  authority / major-medical domain. Nothing auto-fixed blindly.
- Pre-flight on all replacements (GET + browser headers, follow redirects):

  **GROUP B — 4 CDC reorganized paths: BLOCKED (not applied).** All 4 replacement
  URLs return `403` to every automated client (CDC Akamai bot-block), so they
  **cannot be machine-verified as 200**. Per the hard rule (no unverified URL enters
  the DB), left untouched pending human in-browser confirmation:
  - `cdc.gov/healthyweight/assessing/bmi/adult_bmi/index.html` (→ proposed `cdc.gov/bmi/index.html`) — article `healthy-bmi-by-age`
  - `cdc.gov/healthyweight/healthy_eating/water-and-healthier-drinks.html` (→ proposed `cdc.gov/healthy-weight-growth/nutrition/index.html`) — ⚠ **DRIFT: matched 0 CMS docs / 0 frontend** despite scan seeing it live; needs investigation. Also ⚠ semantic: proposed page is general nutrition, not water/drinks.
  - `cdc.gov/healthyweight/physical_activity/index.html` (→ `cdc.gov/physical-activity-basics/index.html`) — article `metabolic-age-calculator-guide`
  - `cdc.gov/physicalactivity/basics/index.htm` (→ `cdc.gov/physical-activity-basics/index.html`) — article `calories-burned-calculator-guide`

  **GROUP C — 5 confirmed-dead links: APPLIED (verified 200 finals).**
  CMS article content (via `scripts/seo/fix-external-link.ts`, Local API, idempotent — re-run = 0):
  - C5 `medlineplus.gov/metabolism.html` → `medlineplus.gov/ency/article/002257.htm`
    **[SEMANTIC SUBSTITUTION]** proposed `metabolicdisorders.html` REJECTED — context is
    basic "Metabolism" (DefinedTerm + source titled *MedlinePlus — Metabolism*), not
    disease; `002257.htm` is the live MedlinePlus "Metabolism" encyclopedia (verified
    200, same source). Docs: `metabolic-age-calculator-guide` (×2), `lean-body-mass-calculator-guide` (×1). Republished.
  - C9 `nationalacademies.org/news/2004/02/report-sets-dietary-intake-levels-...` →
    `nationalacademies.org/projects/HMD-FNB-19-P-139/publication/10925` (final resolved
    URL after redirect). Doc: `how-much-water-should-you-drink-a-day` (×1). Republished.
  Frontend static data (targeted source edits, `href` only — citation text unchanged):
  - C6 `who.int/teams/.../ultraviolet-radiation-and-health` → `who.int/news-room/fact-sheets/detail/ultraviolet-radiation` (final resolved) — `src/data/nutrition-content.ts`
  - C7 `health.harvard.edu/healthblog/blue-light-has-a-dark-side-2016070710348` → `health.harvard.edu/healthy-aging-and-longevity/blue-light-has-a-dark-side` (final resolved) — `src/data/sleep-content.ts`
  - C8 `aaaai.org/conditions-treatments/allergies/food-allergies` → `aaaai.org/conditions-treatments/allergies/food-allergy` (200, no redirect) — `src/data/nutrition-content.ts`
- No-op: `https://www.dietaryguidelines.gov/` — verified 200 in-browser by human; unchanged (my `curl`/WebFetch time out — bot/slow).
- Tooling: extended `fix-external-link.ts` `CONTENT_FIELDS` to include `semanticEntities`.
- **Side effects:** indexing + push hooks no-op locally (no creds); no Google submissions / push sent.
- **⚠ Go-live dependency:** the CMS DB is updated + republished, but the local run did
  NOT fire the Vercel deploy hook (empty locally) — a **frontend rebuild is required**
  to reflect C5/C9 (and the C6/C7/C8 frontend edits) on the live static site.

### Phase 3 — Toxic backlinks
- Created `docs/disavow.txt` with 8 domains (rankinghighseo.shop, blog5.net, qowap.com, blog2learn.com, onesmablog.com, jaiblogs.com, getblogs.net, dbblog.net)
- Created `scripts/seo/check-new-backlinks.ts` (weekly monitor, requires Ahrefs/Moz API key)
- Wired into `package.json` as `npm run audit:backlinks`
- **HUMAN STEP:** Upload disavow.txt at search.google.com/search-console/disavow-links
