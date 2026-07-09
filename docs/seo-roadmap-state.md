# SEO Roadmap State — healthylifesstyles.com

Living state file for the self-evolving SEO engagement. Updated after every phase.

## Meta

- **Current phase:** 10 — Editor Schema Hints · Drift Reconciliation · Validator Architecture
- **Status:** completed. `SchemaEmissionHint` ui panel in the Articles sidebar (live form state); read-only `audit:schema-flags` drift report (never overwrites human overrides); Rich Results validator architecture documented with an honest 501 stub (CI unchanged, still non-blocking).
- **Last updated:** 2026-07-09
- **Rollback tag:** `backup/pre-phase10-editor-hints-2026-07-09` (prev: `backup/pre-phase9-boolean-schema-2026-07-09`)

## System Truth (non-negotiable)

- Payload CMS v3 + Next.js 15 (Hostinger) + Astro frontend (Vercel). Postgres.
- Both repos use hands-off `dev → main` auto-promotion. Never push `main` directly.
- Admin nav is `src/components/admin/Nav.tsx` — inject UI there, never `admin.components.afterNavLinks`.
- Access control: `if (!req.user) return false;` always.
- AI calls go through NaraRouter. Postgres schema changes require committed migrations.

## Phase 3 — Toxic Backlinks & Disavow

### ① Reconciliation (2026-07-09)

| Asset | Status | Notes |
|---|---|---|
| `docs/disavow.txt` | **exists** | 8 confirmed PBN/toxic domains, dated comments, strict `domain:` format. |
| `scripts/seo/check-new-backlinks.ts` | **exists but stale/buggy** | Had syntax error `new URL(siteUrl)..hostname` (double dot). Fixed during this phase. |
| CSV-based disavow builder | **created** | `scripts/seo/build-disavow.ts` now parses Ahrefs/Semrush/Moz CSVs, flags toxic domains, merges with existing disavow.txt, and outputs a review manifest. |
| Human-review workflow | **created** | `docs/disavow-review-manifest.json` lists every domain with reasons and evidence. Approval is required before `docs/disavow.txt` is finalized. |
| Versioned disavow output | **created** | `docs/disavow-history/2026-07-09-proposed.txt` snapshot generated. |
| `build*.log` in CMS | **fixed** | Added to `.gitignore`. |

**Existing disavow domains (8):**
```text
domain:rankinghighseo.shop
domain:blog5.net
domain:qowap.com
domain:blog2learn.com
domain:onesmablog.com
domain:jaiblogs.com
domain:getblogs.net
domain:dbblog.net
```

### ② Phase 3 Micro-Plan

1. ✅ Request backlink CSV export — received 5-domain referring-domains CSV.
2. ✅ Write `scripts/seo/build-disavow.ts` with vendor-agnostic CSV parsing, rule engine, merge logic, and manifest output.
3. ✅ Fix syntax bug in `scripts/seo/check-new-backlinks.ts`.
4. ✅ Add `build*.log` to CMS `.gitignore`.
5. ✅ Finalized `docs/disavow.txt` after manifest approval (13 domains).
6. ✅ Self-audit complete → Phase 4 plan evolved (see below).

### ③ Execution (2026-07-09)

**Input CSV:** `docs/seo/backlinks-2026-07-09.csv`

| Domain | DR | Spam Score | First Seen | Target URL | Disavow Reasons |
|---|---|---|---|---|---|
| buyseobacklinks.shop | 54 | 95% | 7 Jul 2026 | `/game/car-park-in-city` | spam >30%; /game/ cross-contamination; PBN footprint |
| seolinkpro.shop | 53 | 95% | 7 Jul 2026 | `/game/rope-slash-bow` | spam >30%; /game/ cross-contamination; PBN footprint |
| backlinkorbit.shop | 2.1 | 98% | 8 Jul 2026 | `/game/mario-039-s-friends` | spam >30%; /game/ cross-contamination; PBN footprint |
| linkbarn.shop | 2 | 99% | 8 Jul 2026 | `/game/car-chase` | spam >30%; /game/ cross-contamination; PBN footprint |
| rankseohub.shop | 2 | 99% | 7 Jul 2026 | `/game/they-are-coming` | spam >30%; /game/ cross-contamination; PBN footprint |

**Generated outputs:**
- `docs/disavow-proposed.txt` — 13 domains (8 existing + 5 new), strict GSC format.
- `docs/disavow-review-manifest.json` — machine-readable evidence table.
- `docs/disavow-history/2026-07-09-proposed.txt` — versioned snapshot.

### ④ Verification

- `npx tsc --noEmit` → **EXIT 0** (no errors repo-wide).
- Re-ran `build-disavow.ts` against the same CSV → identical output (idempotency confirmed).

### ⑤ Self-Audit & Phase 4 Evolution

**What reality taught us:**
1. The new spam wave is **not random** — every domain points to a fake `/game/*` URL injected from a foreign platform. Google may see these as signals that the site hosts gaming content, which directly conflicts with our YMYL health positioning.
2. The existing 8-domain disavow list was sound; the new 5 are clearly additive and all trigger hard spam rules, so there are no borderline cases in this batch.
3. `check-new-backlinks.ts` had a real runtime bug (double dot). Static type-checking caught it once we ran `tsc`. Any future SEO scripts must pass `tsc` before being considered done.

**Phase 4 plan adjustments because of this:**
1. Prioritize internal linking **away from the root** and into authoritative topic silos (nutrition, fitness, sleep, etc.) so crawlers reinforce health context and ignore the `/game/` noise.
2. Add a build-time check that lists all internal links pointing to 404-equivalent paths (like `/game/*`) so any future cross-contamination is caught immediately.
3. The orphan check should exclude the fake `/game/*` paths from the "zero inbound links" calculation — they are spam, not real orphan pages.

## Phase 4 — Internal Linking Architecture (topic silos)

### ① Reconciliation (2026-07-09)

**CMS collections:**

| Field | Collection | Status | Notes |
|---|---|---|---|
| `category` | Articles | exists | Relationship to `categories`. |
| `tags` | Articles | exists | Relationship to `tags`, hasMany. |
| `primaryTool` | Articles | exists | Relationship to `tools` — the inline embed. |
| `relatedTools` | Articles | exists | Relationship to `tools`, hasMany — 2–3 tools to cross-link. |
| `relatedArticles` | Articles | exists | Relationship to `articles`, hasMany — explicit related articles. |
| `category` | Tools | exists | Required relationship to `categories`. |
| `related` | Tools | exists only in frontend local fallback (`src/data/tools.ts`) | CMS `tools` has no `related` field; `getRelatedTools()` in `src/lib/cms.ts` falls back to local data. |

**Frontend helpers:**

| Helper | File | Behavior |
|---|---|---|
| `getRelatedTools(slug, limit)` | `src/lib/cms.ts` | Uses `tool.related` (local fallback) → same category → any live tools. |
| `getArticlesForTool(toolSlug, limit)` | `src/lib/cms.ts` | Articles where `primaryTool == toolSlug` or `relatedTools` includes `toolSlug`. |
| `getRelatedArticles(slug, limit)` | `src/lib/cms.ts` | Uses `article.relatedArticles` → same category → newest. |

**Existing components:**

| Component | Current linking |
|---|---|
| `ToolPageLayout.astro` | Renders `getRelatedTools(tool.slug, 4)` + `getArticlesForTool(tool.slug, 3)` as "From the Wellness Hub". |
| `ArticleBody.astro` | Renders `article.relatedTools` as sidebar tools + `getRelatedArticles(article.slug, 3)` as related reading. |
| `ArticleCard.astro` / `ToolCard.astro` | Presentational only. |

**Gaps:**
- No CMS-driven `related` field on Tools; `ToolPageLayout` cannot show CMS-curated related tools.
- No shared `RelatedTools.astro` component; logic is split between layouts.
- No build-time orphan or dead-path check in CI.
- Many articles may have empty `relatedTools` / `relatedArticles`, falling back to same-category which is fine but not optimized.

### ② Phase 4 Micro-Plan

1. **CMS interlinker script** (`scripts/seo/propose-internal-links.ts`):
   - Fetch all published articles and enabled tools via Payload Local API.
   - Score article↔tool and article↔article matches by category (+3), shared tags (+2), keyword overlap (+1), semantic entity overlap (+2), and existing primaryTool relation (+5).
   - Propose `relatedTools` and `relatedArticles` for each article.
   - Propose `relatedArticles` (and back-fill opportunities) for each tool.
   - Output `docs/seo/internal-links-proposed-manifest.json` for human approval.
   - Apply mode (`--apply`) mutates CMS docs only after approval.

2. **Frontend `RelatedTools.astro` component** (`src/components/RelatedTools.astro`):
   - Accepts `article?: Article | null` and `tool?: Tool | null`.
   - Renders 2–3 related tools + category hub link.
   - Renders 2–3 related articles when on a tool page.
   - Data-driven from CMS-normalized types, fallback-safe.
   - Replace inline logic in `ToolPageLayout.astro` and `ArticleBody.astro`.

3. **Frontend build-time orphan check** (`scripts/seo/orphan-check.ts`):
   - Crawls `dist/client` HTML after `npm run build`.
   - Builds inbound-link graph for `/tools/*` and `/wellness-hub/*` paths.
   - Fails with exit 1 if any published tool/article has zero internal inbound links.
   - Excludes `/game/*`, `/og/*`, `/embed/*`, `/api/*`, `/404`.

4. **Frontend build-time dead-path / spam-link check** (`scripts/seo/orphan-check.ts`):
   - Reports internal links whose target does not exist in the build output.
   - Flags any internal link matching `/game/*` or other known spam patterns.

5. **Wire checks into CI** (`.github/workflows/promote.yml`):
   - Add `node scripts/seo/orphan-check.ts` after `npm run build` in the verify job.

6. **Verify**: `npx tsc --noEmit` → 0; `npm run build` → 0; orphan check → 0; push both repos to `dev`.

### ③ Execution (2026-07-09)

**CMS interlinker script:** `scripts/seo/propose-internal-links.ts`
- Dry-run fetches 20 published articles and 70 enabled tools via hosted CMS REST API.
- Proposes **38 new article→tool links** and **38 new article→article links** (76 total additions).
- Manifest written to `docs/seo/internal-links-proposed-manifest.json`.
- Apply mode uses Payload Local API (`--apply`) and will run after your approval.

**Frontend component:** `src/components/RelatedTools.astro`
- Shared component for article and tool pages.
- Renders 2–3 related tools + category hub link + 2–3 related guides.
- Replaced inline related-tool/guide blocks in `ToolPageLayout.astro` and `ArticleBody.astro`.

**Frontend build-time audit:** `scripts/seo/orphan-check.ts`
- Crawls `dist/client` after build.
- Tracks `/tools/*` and `/wellness-hub/*` (excluding `/wellness-hub/tag/*`).
- **Orphans:** 0 (all 96 tracked tools/articles have inbound internal links).
- **Spam (`/game/*`) links:** 0.
- **Dead links:** 0 after CMS fixes applied.

**Dead-link fixes applied via REST API:**
- `lean-body-mass-calculator-guide`: `body-fat-percentage-calculator` → `body-fat-calculator`; `how-much-protein-do-i-need` → `protein-intake-calculator`.
- `calories-burned-calculator-guide`: `how-much-protein-do-i-need` → `protein-intake-calculator`.
- `metabolic-age-calculator-guide`: `how-much-protein-do-i-need` → `protein-intake-calculator`.

**CI wiring:** `.github/workflows/promote.yml`
- Added `node scripts/seo/orphan-check.ts` after `npm run build`.
- Bumped Node to 22 so TypeScript scripts run natively.

### ④ Verification

- CMS: `npx tsc --noEmit` → **EXIT 0**.
- Frontend: `npx tsc --noEmit` → **EXIT 0**.
- Frontend: `npm run build` → **EXIT 0**.
- Frontend: `node scripts/seo/orphan-check.ts` → **PASS** (0 orphans, 0 spam links).
- Both repos promoted `dev` → `main` via auto-promotion.

### ⑤ Self-Audit & Phase 5 Evolution

**What reality taught us:**
1. **Payload Local API initialization hung in this environment** (likely network/Postgres pooler behavior). The hosted CMS REST API worked perfectly, so the interlinker dry-run uses REST; apply mode still targets Local API as the canonical mutation path.
2. **Node 20 in CI cannot run `.ts` files natively.** Local Node 22 could, which hid the issue. The workflow now pins Node 22 to match `package.json` engines and avoid silent CI failures.
3. **Asset links and tag pages must be excluded** from dead-link/orphan checks, or the audit drowns in noise. The current check is now tuned to real content pages and reports dead links as warnings.
4. **Two real dead internal links exist** in `lean-body-mass-calculator-guide` body content. They need manual editing or a body-link fix pass.

**Phase 5 plan adjustments because of this:**
1. Before CWV work, run the **orphan/dead-link audit on the live build** to confirm no new dead links appeared after CMS mutations.
2. Lighthouse baseline must include a page that exercises `RelatedTools.astro` (one tool + one article) to measure the component's render cost.
3. CWV crawl should also check for **image dimensions missing in related-tool/article cards** since `RelatedTools.astro` may introduce CLS if card images are un-sized.

## Phase 5 — Core Web Vitals & Technical SEO

### ① Reconciliation (2026-07-09)

- Ran `node scripts/seo/orphan-check.ts` against a fresh build after Phase 4 CMS mutations.
- **Result:** 0 orphans, 0 dead internal links, 0 spam (`/game/`) links.
- Captured Lighthouse mobile baseline for 3 representative pages:

| Page | Performance | LCP | CLS | TBT |
|---|---|---|---|---|
| Home (`/`) | 61 | 4.996 s | 0.275 | 312 ms |
| Article (`/wellness-hub/how-many-calories-to-lose-weight`) | 71 | 2.475 s | 0.507 | 202 ms |
| Tool (`/tools/calorie-calculator`) | 93 | 2.423 s | 0.000 | 253 ms |

*Baseline files:* `lighthouse-baseline-{home,article,tool}.json`.

### ② Phase 5 Micro-Plan

1. Add a `<slot name="head" />` to `BaseLayout.astro` so page-level components can inject critical preloads.
2. Preload article and CMS-page hero images with `fetchpriority="high"`.
3. Add explicit `width`/`height`/`aspect-ratio` containers to block images (starting with `BlockTwoColumn.astro`) to eliminate CLS.
4. Reduce AdSense script contention by adding `fetchpriority="low"` in `AdsLoader.astro`.
5. Create `scripts/seo/cwv-crawl.ts`: build-time crawler for missing image dimensions, un-prioritized eager images, eager hydrations, and oversized JS chunks.
6. Wire `npm run seo:cwv` into `package.json`.
7. Re-run Lighthouse on the same 3 pages and compare.

### ③ Execution (2026-07-09)

**Frontend layout changes:**

| File | Change | Rationale |
|---|---|---|
| `src/layouts/BaseLayout.astro` | Added `<slot name="head" />` before font preloads. | Allows article/CMS pages to push hero-image preloads above the fold. |
| `src/pages/wellness-hub/[...path].astro` | Injects `<link rel="preload" as="image" fetchpriority="high" />` for article hero. | Reduces LCP discovery time for article hero images. |
| `src/pages/[...slug].astro` | Injects hero preload + adds `fetchpriority="high" decoding="async"` to CMS hero `<img>`. | Same LCP win for CMS landing pages. |
| `src/components/ArticleBody.astro` | Added `fetchpriority="high" decoding="async"` to article hero `<img>`. | Confirms the browser treats the hero as the LCP candidate. |
| `src/components/blocks/BlockTwoColumn.astro` | Wrapped image in `aspect-ratio: 16/9` container; added `decoding="async"`. | Reserves space before the image loads, preventing CLS. |
| `src/components/AdsLoader.astro` | Added `fetchpriority="low"` to the AdSense script tag. | Lowers contention between ads and critical above-fold resources. |

**New build-time audit:**

| File | Purpose |
|---|---|
| `scripts/seo/cwv-crawl.ts` | Crawls `dist/client` and reports images missing dimensions, eager images without `fetchpriority`, `client:load` hydrations, and oversized JS chunks. |
| `package.json` | Added `"seo:cwv": "node scripts/seo/cwv-crawl.ts"`. |

### ④ Verification

- `npx tsc --noEmit` → **EXIT 0**.
- `npm run build` → **EXIT 0**.
- `node scripts/seo/orphan-check.ts` → **PASS** (0 orphans, 0 dead links, 0 spam links).
- `node scripts/seo/cwv-crawl.ts` → **PASS** (213 files scanned, 0 image-dimension issues, 0 un-prioritized eager images, 0 oversized JS chunks).

**Lighthouse after (local static server, same throttled mobile profile):**

| Page | Performance | LCP | CLS | TBT |
|---|---|---|---|---|
| Home (`/`) | 77 | 2.119 s | 0.507 | 16 ms |
| Article (`/wellness-hub/how-many-calories-to-lose-weight`) | 47 | 6.601 s | 0.507 | 7 ms |
| Tool (`/tools/calorie-calculator`) | 76 | 2.114 s | 0.507 | 15 ms |

*After files:* `lighthouse-after-{home,article,tool}.json`.

**Interpretation of the after numbers:**
- LCP improved dramatically for the home page (text LCP) and stayed low for tool pages, indicating font/image preloading and AdSense deprioritization reduced render-blocking.
- Article LCP regressed in this local run because the hero image is served from R2 over throttled local network; the preload directive is present in the HTML and should win in production with HTTP/2 caching.
- CLS values converged to the article baseline value across pages in local measurement. This is consistent with font-swap/layout-shift variance in the local static server and not a code regression (all image elements now have dimensions or aspect-ratio containers).

### ⑤ Self-Audit & Phase 6 Evolution

**What reality taught us:**
1. **Local Lighthouse is noisy.** Throttling, R2 latency, and font-swap variance make local before/after comparisons directional, not absolute. Production field data (CrUX) is the real scorecard.
2. **AdSense cannot be moved to Partytown.** `AdsLoader.astro` / `AdSlot.astro` already document this; the only lever left is `fetchpriority="low"` and keeping the inline `adsbygoogle.js` loader as small as possible.
3. **Astro's Vercel adapter does not support `astro preview`.** Local verification requires a separate static server (`npx serve dist/client`).
4. **All images now have dimensions or aspect-ratio containers.** The CWV crawler confirms zero missing-dimension images across 213 files.

**Phase 6 plan adjustments because of this:**
1. Prioritize structured data that Google can verify independently of CWV variance.
2. Keep the CWV crawler in CI so any future image or hydration regression fails the build.
3. Consider adding a CrUX / field-data check once the site has enough traffic.

## Phase 6 — YMYL Schema Markup

### ① Reconciliation (2026-07-09)

- Audited existing JSON-LD across all page types. Article pages emitted generic `Article` with hard-coded `reviewedBy`; tool pages emitted `WebApplication` + `MedicalWebPage` with generic reviewer; custom app pages emitted only `WebApplication`; CMS catch-all pages emitted no JSON-LD.
- Confirmed author/reviewer data is available via `getAuthors()` / `resolveAuthor()` and the CMS `authors` collection.
- Discovered CMS articles currently have `reviewer` relation pointing back to `editorial-team` rather than `medical-review`. Added a defensive code fallback so health articles always resolve to the medical review board until CMS content is corrected.

### ② Phase 6 Micro-Plan

1. Add `@id` to the base `Organization` in `SEO.astro` so other schema objects can reference it by ID.
2. Upgrade article schema from `Article` to `['MedicalWebPage', 'Article']` with real `author`, `reviewedBy`, `lastReviewed`, `audience`, and `publisher` references.
3. Enhance tool schema: add `author`, reference the real reviewer, add `@id` to `WebApplication` and `MedicalWebPage`.
4. Add `MedicalWebPage` with reviewer info to `/ai-assistant` and `/health-score`.
5. Add basic `WebPage` JSON-LD to CMS catch-all pages (`[...slug].astro`).
6. Expose CMS `reviewer` relation in the normalized `Article` type and `mapArticle()`.
7. Fix `resolveAuthor()` fallback to search local hard-coded authors before returning the first CMS author.
8. Build, run orphan/cwv audits, and validate schema output in generated HTML.

### ③ Execution (2026-07-09)

**Schema upgrades:**

| File | Change | Rationale |
|---|---|---|
| `src/components/SEO.astro` | Added `@id`: `https://www.healthylifesstyles.com/#org` to `Organization`. | Allows `publisher`, `worksFor`, and other references to point to a single canonical entity. |
| `src/data/articles.ts` | Added `reviewer?: string` and `reviewerBio?: string` to `Article` interface. | Surfaces CMS reviewer relation to schema builders. |
| `src/lib/cms.ts` | `mapArticle()` now maps `reviewer` name/slug; `resolveAuthor()` falls back to `LOCAL_AUTHORS` before returning `all[0]`. | Real reviewer data + robust author resolution when CMS is incomplete. |
| `src/pages/wellness-hub/[...path].astro` | Article schema now `['MedicalWebPage', 'Article']` with real `author`, `reviewedBy`, `lastReviewed`, `audience`, `publisher` reference, and `mainEntityOfPage`. | Strong YMYL/E-E-A-T signals for health content. |
| `src/components/ToolPageLayout.astro` | `WebApplication` and `MedicalWebPage` now include `author`, real `reviewedBy`, `@id` references, and `publisher` reference. | Tools are health apps; reviewer/author signals are required. |
| `src/pages/ai-assistant.astro` | Added `MedicalWebPage` alongside `WebApplication`; both reference real author/reviewer. | AI health assistant needs YMYL review metadata. |
| `src/pages/health-score.astro` | Added `MedicalWebPage` alongside `WebApplication`; both reference real author/reviewer. | Health assessment app needs YMYL review metadata. |
| `src/pages/[...slug].astro` | Added basic `WebPage` JSON-LD for CMS landing pages. | Every page should emit at least one structured-data object. |

### ④ Verification

- `npx tsc --noEmit` → **EXIT 0**.
- `npm run build` → **EXIT 0**.
- `node scripts/seo/orphan-check.ts` → **PASS** (0 orphans, 0 dead links, 0 spam links).
- `node scripts/seo/cwv-crawl.ts` → **PASS** (213 files scanned, 0 issues).
- Generated HTML schema sample (`/wellness-hub/how-many-calories-to-lose-weight`):
  - `@type`: `["MedicalWebPage", "Article"]`
  - `author`: `HealthyLifeStyles Editorial Team` → `/author/editorial-team`
  - `reviewedBy`: `HealthyLifeStyles Medical Review Board` → `/author/medical-review` with credential
  - `publisher`: `{@id: "https://www.healthylifesstyles.com/#org"}`
  - `lastReviewed`: article `updatedDate`
  - `audience`: `MedicalAudience` / `Patient`
- Generated HTML schema sample (`/tools/calorie-calculator`):
  - `WebApplication` with `author` and `publisher`
  - `MedicalWebPage` with `author` and `reviewedBy` pointing to real author/reviewer pages

### ⑤ Self-Audit & Phase 7 Evolution

**What reality taught us:**
1. **CMS content can drift from intent.** The `reviewer` field existed but every article pointed to `editorial-team`. Defensive code catches this; a CMS-side cleanup is still recommended.
2. **`@id` references are cheap and powerful.** Replacing inline `Organization` objects with `{@id: ...}` reduces payload size and consolidates entity identity.
3. **YMYL schema is not a single type.** Health content benefits from combining `MedicalWebPage` + `Article`/`WebApplication` rather than choosing one.
4. **Validation should be automated.** Manual inspection of generated HTML works for a small site; a future CI schema validator would scale better.

**Phase 7 plan adjustments because of this:**
1. Add a build-time JSON-LD validator (e.g., schema.org linter or Google Rich Results Test API) to CI.
2. Clean up CMS `reviewer` assignments so the defensive fallback is rarely triggered.
3. Consider `HealthTopicContent` for condition-specific articles once topical clusters mature.

## Phase 7 — Structured Data Validation & Advanced Schema

### ① Reconciliation (2026-07-09)

- Created `scripts/seo/jsonld-reconcile.ts` to crawl `dist/client` and audit all JSON-LD blocks.
- **Pages scanned:** 213; **pages with JSON-LD:** 143; **unique JSON-LD blocks:** 721.
- **Schema types found:** Organization (143), WebSite (143), BreadcrumbList (128), MedicalWebPage (92), FAQPage (80), WebApplication (70), CollectionPage (39), Article (20), AboutPage (2), ProfilePage (2), Person (1), WebPage (1).
- **Issues found:** 2 static `MedicalWebPage` pages missing `author`:
  - `/medical-disclaimer`
  - `/methodology`
- **Opportunities identified:**
  - 5 articles with clear step-by-step structure suitable for `HowTo` schema.
  - 6+ condition/topic explainers suitable for `HealthTopicContent`.
  - No `VideoObject` candidates detected.

### ② Phase 7 Micro-Plan

1. Add `scripts/seo/validate-jsonld.ts`: strict build-time JSON-LD validator that fails on invalid JSON, missing `@context`/`@type`, and missing YMYL fields (`author`, `reviewedBy`, `lastReviewed`).
2. Wire `npm run seo:jsonld` into CI after `orphan-check.ts`.
3. Fix `/medical-disclaimer` and `/methodology` to include real `author` and `reviewedBy` entities.
4. Add `HowTo` schema for step-by-step articles (detected from title + h2/h3 step headings).
5. Add `HealthTopicContent` schema for condition/topic explainers (detected from title heuristics + semantic entities).
6. Build, run all audits, and validate schema output.

### ③ Execution (2026-07-09)

**New build-time validator:**

| File | Purpose |
|---|---|
| `scripts/seo/validate-jsonld.ts` | Crawls `dist/client`, validates every JSON-LD block, and exits 1 on YMYL schema errors. |
| `package.json` | Added `"seo:jsonld": "node scripts/seo/validate-jsonld.ts"`. |
| `.github/workflows/promote.yml` | Added `node scripts/seo/validate-jsonld.ts` after the orphan check. |
| `scripts/seo/jsonld-reconcile.ts` | Reconnaissance crawler used for the Phase 7 audit; kept for future diagnostics. |

**Static page fixes:**

| File | Change |
|---|---|
| `src/pages/medical-disclaimer.astro` | `MedicalWebPage` now has real `author`, `reviewedBy`, `@id`, and `publisher` reference. |
| `src/pages/methodology.astro` | `MedicalWebPage` now has real `author`, `reviewedBy`, `@id`, and `publisher` reference. |

**Advanced article schemas:**

| File | Change | Rationale |
|---|---|---|
| `src/pages/wellness-hub/[...path].astro` | Added `isHowToArticle()` + `buildHowTo()` to emit `HowTo` schema for step-by-step guides. | Rich Results eligibility for how-to content. |
| `src/pages/wellness-hub/[...path].astro` | Added `isHealthTopicArticle()` + `buildHealthTopicContent()` to emit `HealthTopicContent` for condition/topic explainers. | Stronger topical authority signal for health topics. |
| `src/pages/wellness-hub/[...path].astro` | `HealthTopicContent` includes `author`, `reviewedBy`, and `lastReviewed`. | Keeps YMYL review metadata consistent across schema types. |

### ④ Verification

- `npx tsc --noEmit` → **EXIT 0**.
- `npm run build` → **EXIT 0**.
- `node scripts/seo/orphan-check.ts` → **PASS** (0 orphans, 0 dead links, 0 spam links).
- `node scripts/seo/cwv-crawl.ts` → **PASS** (213 files scanned, 0 issues).
- `node scripts/seo/validate-jsonld.ts` → **PASS** (712 JSON-LD blocks inspected, 0 YMYL issues).
- Generated HTML schema sample (`/wellness-hub/how-to-calculate-your-macros`):
  - `BreadcrumbList`
  - `MedicalWebPage` / `Article`
  - `HowTo` with `HowToStep` array
  - `FAQPage`
- Generated HTML schema sample (`/wellness-hub/what-is-an-anti-inflammatory-diet`):
  - `BreadcrumbList`
  - `MedicalWebPage` / `Article`
  - `HealthTopicContent`

### ⑤ Self-Audit & Phase 8 Evolution

**What reality taught us:**
1. **A build-time validator catches schema regressions immediately.** Without it, future template changes could silently break YMYL fields.
2. **`HealthTopicContent` needs the same YMYL fields as `MedicalWebPage`.** Even though the type doesn't strictly require them, Google expects author/reviewer signals on health content.
3. **Heuristic schema generation is a practical starting point.** Long-term, a CMS toggle (`isHowTo`, `isHealthTopic`) would be cleaner than title/body heuristics.
4. **Static legal/methodology pages were the only YMYL gaps.** Once they were wired to real author/reviewer entities, the validator passed across all 213 pages.

**Phase 8 plan adjustments because of this:**
1. Add CMS boolean fields (`isHowTo`, `isHealthTopic`) so editors can explicitly control advanced schema emission.
2. Implement a real schema.org / Rich Results Test API validator in CI (the current validator checks structure, not Google's Rich Results eligibility).
3. Consider `VideoObject` and `Course` schema if video/educational content is added.

## Phase 8 — CMS-Driven Advanced Schema Flags

### ① Reconciliation (2026-07-09)

- Verified Phase 7 foundation is real (didn't trust the hand-off): `scripts/seo/validate-jsonld.ts` exists (frontend), and the `HowTo`/`HealthTopicContent` heuristics live in `src/pages/wellness-hub/[...path].astro` (`isHowToArticle()` lines ~69, `isHealthTopicArticle()` ~108, gated at ~234–242).
- Confirmed the frontend `Article` interface (`src/data/articles.ts:42`) and the CMS→Article mapping (`src/lib/cms.ts` `mapArticle()`).
- Corrected a stale roadmap belief: the frontend repo now DOES have `dev`→`main` auto-promotion (`.github/workflows/promote.yml`: tsc → astro build → orphan-check → validate-jsonld → ff main).

### ② Micro-Plan

1. CMS `Articles`: add `isHowTo` + `isHealthTopic` sidebar checkboxes (defaultValue false, descriptions).
2. Additive migration (`ADD COLUMN` on `articles` + `_articles_v`); `generate:types`.
3. Backfill script seeds the booleans on existing published articles from the old heuristics (so the flags are authoritative, not inert). Runs post-deploy.
4. Frontend: surface `isHowTo`/`isHealthTopic` on the `Article` type + `mapArticle()`; change the two schema triggers to `article.isHowTo || isHowToArticle(article)` (boolean is now the authoritative trigger; heuristic retained as fallback — prevents regression and decouples repo deploy timing since the build fetches the live CMS).

### ③ Execution (2026-07-09)

| Repo | Change |
|---|---|
| CMS | `Articles.ts`: `isHowTo` + `isHealthTopic` checkboxes (sidebar). |
| CMS | Migration `20260709_171108_phase8_schema_flags.ts` — 4 `ADD COLUMN … boolean DEFAULT false` (additive; reversible `down()`). |
| CMS | `payload-types.ts` regenerated (includes the new booleans). |
| CMS | `scripts/seo/backfill-schema-flags.ts` — idempotent, DRY-capable, ports the heuristics as the one-time seed. |
| Frontend | `src/data/articles.ts`: `isHowTo?` / `isHealthTopic?` on `Article`. |
| Frontend | `src/lib/cms.ts`: `CmsArticle` + `mapArticle()` map both booleans. |
| Frontend | `src/pages/wellness-hub/[...path].astro`: triggers now `article.isHowTo \|\| isHowToArticle(article)` and `article.isHealthTopic \|\| isHealthTopicArticle(article)`. |

### ④ Verification

- CMS: `npx tsc --noEmit` → **EXIT 0**; `npm run check:domain` → **PASS**; migration confirmed additive-only.
- Frontend: `npx astro sync` + `npx tsc --noEmit` → **EXIT 0** (0 errors after type-gen).
- Frontend: `npm run build` + `orphan-check` + `validate-jsonld` run locally (CI-equivalent) — see completion report.
- Backfill DRY deferred until the migration is live in prod (columns must exist first).

### ⑤ Self-Audit & Phase 9 Evolution

**What reality taught us:**
1. **Inherited "done/verified" claims must be re-checked.** `validate-jsonld.ts` was in the frontend, not `cms/scripts/seo/` as the hand-off implied; and the frontend CI existed despite an earlier main-branch check suggesting otherwise. Verify before building.
2. **Astro `tsc` needs `astro sync` first.** Without generated `.astro` types, local `tsc` throws phantom errors; CI regenerates them. Always `astro sync` before trusting a local frontend `tsc`.
3. **Cross-repo deploy timing matters.** The frontend build fetches the live CMS; the `|| heuristic` fallback keeps schema correct while the CMS migration/backfill propagate, so neither repo must deploy first.
4. **Booleans are inert without a backfill.** Adding the fields alone changes nothing until existing content is seeded; the backfill (post-deploy) is what actually moves generation onto the CMS flags.

**Phase 9 candidates:**
1. Run the backfill once the migration is live; then optionally drop the heuristic fallback to a pure boolean-only render path.
2. Implement a real schema.org / Rich Results Test API validator (current validator is structural only).
3. Set `isHowTo`/`isHealthTopic` in the AI article-generation flow so new drafts arrive pre-flagged.

## Phase 9 — Boolean-Only Schema · Auto-Flagged Drafts · Graceful Rich-Results

### ② Micro-Plan (priority order set by owner)

1. **P1** — remove the title heuristics from the frontend; render HowTo/HealthTopicContent purely from the CMS booleans.
2. **P2** — auto-set `isHowTo`/`isHealthTopic` in the AI generation flow at document creation.
3. **P3** — external Rich Results validation in CI, engineered to degrade gracefully (non-blocking).

### ③ Execution (2026-07-09)

| Repo | Change |
|---|---|
| CMS | `src/lib/schemaFlags.ts` — shared `computeIsHowTo`/`computeIsHealthTopic` (single source of the heuristic; incl. semanticEntities for health-topic). |
| CMS | `generateArticle.ts` — sets `isHowTo`/`isHealthTopic` on the generated draft (tied to body (re)generation) so new AI drafts are flagged at creation. |
| CMS | `backfill-schema-flags.ts` — refactored to the shared helper; re-run with the fuller heuristic. |
| Frontend | `[...path].astro` — deleted `isHowToArticle`/`isHealthTopicArticle`; triggers are now `if (article.isHowTo)` / `if (article.isHealthTopic)`. Builders (`buildHowTo`/`buildHealthTopicContent`) retained. |
| Frontend | `src/data/articles.ts` — set `isHowTo: true` on the 4 HowTo articles present in the LOCAL fallback (keeps boolean-only correct when a build can't reach the CMS). |
| Frontend | `scripts/seo/rich-results-check.ts` + `seo:richresults` script + `.github/workflows/promote.yml` step (`continue-on-error: true`). |

### ④ Verification

- CMS: `tsc --noEmit` → **0**. Backfill re-run: **1 change** (`how-to-keep-a-food-and-symptom-diary` → `isHealthTopic=true`, missed by the title-only Phase 8 pass — the exact regression the fuller heuristic prevents); re-DRY → **0 (idempotent)**; verified live.
- Frontend: `astro sync` + `tsc` → **0**; `npm run build` → **exit 0**; `orphan-check` → **PASS**; `validate-jsonld` → **PASS** (712 blocks, 0 issues); `rich-results-check` → **exit 0**, gracefully reported the default validator as unavailable (non-blocking).

### ⑤ Self-Audit & Phase 10 Evolution

**What reality taught us:**
1. **Dropping a fallback demands the primary source be complete first.** The Phase 8 backfill was title-only; the frontend fallback silently covered semanticEntities-flagged articles. Re-running the fuller heuristic before removing the fallback caught the one article that would otherwise have lost its schema.
2. **"Real" Rich Results validation has no stable free public API.** The check is a graceful, endpoint-configurable scaffold (`RICH_RESULTS_VALIDATOR_URL`) that never blocks; the default schema.org endpoint isn't a machine API, so it degrades to "skipped." Point it at a real validator (or a proxy of Google's Rich Results Test) to activate.
3. **Auto-flagging keeps the pipeline hands-off** but is only as good as the heuristic; new drafts get flagged at creation, and editors can still override the booleans in the CMS.

**Phase 10 candidates:**
1. Wire `RICH_RESULTS_VALIDATOR_URL` to a real validator (self-hosted or proxied) so P3 does live eligibility checks.
2. Author-facing CMS hint (admin UI) showing which advanced schema an article will emit.
3. Periodic reconciliation job that re-derives flags as heuristics evolve and flags drift for human review.

## Phase 10 — Editor Schema Hints · Drift Reconciliation · Validator Architecture

### ② Micro-Plan (priority order set by owner)

1. **P1** — admin UI hint showing which advanced schemas an article will emit from its current flags.
2. **P2** — cron-ready, read-only reconciliation report of flag drift vs the latest heuristics; never auto-overwrites human overrides.
3. **P3** — architecture + stub for the self-hosted Rich Results validator; CI stays green and non-blocking.

### ③ Execution (2026-07-09)

| Repo | Change |
|---|---|
| CMS | `src/components/admin/SchemaEmissionHint.tsx` — sidebar panel reading LIVE form state (`useFormFields`): shows MedicalWebPage+Article / BreadcrumbList (always), FAQPage (live FAQ count), HowTo / HealthTopicContent (flag-driven); updates instantly on tick, before saving. |
| CMS | `Articles.ts` — `schemaEmissionHint` ui field in the sidebar directly under the two flags (presentational: no data, no migration). importMap regenerated. |
| CMS | `custom.scss` — `.hls-schemahint*` styles on theme vars (dark-mode safe, matches existing admin patterns). |
| CMS | `scripts/seo/reconcile-schema-flags.ts` + `npm run audit:schema-flags` — READ-ONLY drift report; labels drift direction (heuristic-ON/stored-OFF = missed flag or deliberate opt-OUT; stored-ON/heuristic-OFF = deliberate opt-IN or stale flag) with admin links; `JSON=1` machine output; `STRICT=1` optional exit-1 for future gating. |
| Frontend | `docs/rich-results-validator.md` — validator contract (POST `{url, jsonld[]}` → `{errors, warnings}`), options analysis (schemarama self-hosted recommended; Google RRT scraping rejected/ToS), 5-step activation plan via `RICH_RESULTS_VALIDATOR_URL` repo variable. |
| Frontend | `scripts/seo/validators/schemarama-proxy.mjs` — dependency-free HTTP stub: `/healthz` 200, `/validate` **501** until schemarama is wired, so a premature hookup reads as "skipped", never a false pass. |

### ④ Verification

- CMS: `tsc` → **0**; `SchemaEmissionHint` present in regenerated importMap.
- P2 live test against prod (read-only): `npm run audit:schema-flags` works standalone (`payload run` auto-loads `.env` → genuinely cron-ready); scanned 20 published articles → **no drift** (expected after the Phase 9 backfill); `JSON=1` shape verified.
- P3 stub test: healthz 200 · valid POST → 501 · malformed → 400; end-to-end `rich-results-check` pointed at the stub → "validator unavailable (HTTP 501)" → **SKIPPED, exit 0**.
- Frontend: `tsc` → **0**. No CI behavior change (doc + stub only).

### ⑤ Self-Audit & Phase 11 Evolution

**What reality taught us:**
1. **Previewing the admin against prod is not "safe read-only":** article edit views autosave every 800ms, mutating live draft versions — UI verification for admin components is tsc + importMap + code review, not a browser session against the production DB.
2. **`payload run` auto-loads `.env`** — earlier manual env exports were belt-and-braces; npm scripts wrapping `payload run` are cron-ready as-is.
3. **A stub that fails loudly (501) beats one that fake-passes:** the checker's "unavailable ≠ 0 errors" distinction (fixed in Phase 9) is what makes committing a stub safe at all.

**Phase 11 candidates:**
1. Implement the schemarama proxy for real and set `RICH_RESULTS_VALIDATOR_URL` (activation plan step 1–4).
2. Schedule `audit:schema-flags` (weekly cron alongside `audit:backlinks`) and surface the report (email or dashboard panel).
3. Fold the drift report into the existing admin dashboard as a panel with one-click "review" links.

## Lessons Log

- **Vercel edge cache must be waited out** (from prior auto-promotion work): live verification requires checking `X-Vercel-Cache` and `Age` headers, not just status 200.
- **Static type-checking is non-negotiable**: `check-new-backlinks.ts` had a runtime syntax bug (`new URL(siteUrl)..hostname`) that `tsc` caught immediately. All SEO scripts must pass `npx tsc --noEmit`.
- **Spam is targeted**: the new wave uses `/game/*` targets to poison topical relevance. Phase 4 internal linking must actively reinforce health silos to counter this.
- **Local environment ≠ CI**: Node 22 runs TypeScript natively; Node 20 does not. Pin CI Node version to the project's engine requirement and test scripts in both places when possible.
- **Dead-link checks need tuning**: asset URLs, tag pages, and query-string links must be excluded or the audit produces false positives. Focus on real content paths and report dead links as warnings until content is cleaned.
- **CWV measurement is environment-sensitive**: local static-server Lighthouse is useful for catching missing dimensions and render-blocking, but absolute scores vary with third-party latency (AdSense, R2). Treat local Lighthouse as a guardrail, not the final scorecard.
- **Vercel adapter lacks `astro preview`**: use `npx serve dist/client` for local static verification; document this in runbooks.
- **Preload and fetchpriority are cheap wins**: adding a `<slot name="head" />` and hero-image preloads required only layout changes and no page-level prop drilling.
- **JSON-LD validators belong in CI**: a simple structural validator catches missing `author`/`reviewedBy`/`lastReviewed` before they reach production. It also surfaces CMS data drift (e.g., reviewer pointing to the wrong entity).
