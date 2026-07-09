# SEO Roadmap State — healthylifesstyles.com

Living state file for the self-evolving SEO engagement. Updated after every phase.

## Meta

- **Current phase:** 3 — Toxic Backlinks & Disavow
- **Status:** completed; disavow.txt finalized and awaiting CI promotion
- **Last updated:** 2026-07-09
- **Rollback tag:** `backup/pre-phase3-backlinks-2026-07-09`

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

*Plan finalized after Phase 3 self-audit:*

1. Reconcile existing linking: `primaryTool`, `relatedTools`, `relatedArticles`, tag pages, category hubs.
2. Payload Local API script: propose article ↔ calculator matches (slug/keyword/category), output manifest for approval, then apply.
3. `RelatedTools.astro` component: 2–3 related tools + category hub, data-driven from CMS.
4. Build-time orphan check: fail CI if any published tool/article has zero inbound internal links (exclude `/game/*` spam targets).
5. Build-time dead-path check: surface any internal link whose target returns 404 or matches known spam patterns.

## Phase 5 — Core Web Vitals & Technical SEO

*Plan will be finalized after Phase 4 self-audit. Tentative:*

1. Baseline Lighthouse mobile on home, one article, one calculator.
2. Apply astro:assets, font preload, Partytown for third-party scripts, defer non-critical JS.
3. `scripts/cwv-crawl.ts`: local build crawler for missing image dimensions, oversized JS, hydration bottlenecks.
4. Re-run Lighthouse, present before/after.

## Phase 6 — YMYL Schema Markup

*Plan will be finalized after Phase 5 self-audit. Tentative:*

1. Reconcile existing JSON-LD in served HTML.
2. `ArticleSchema.astro`: MedicalWebPage + HealthTopicContent, real `reviewedBy` only.
3. `ToolSchema.astro`: WebApplication (HealthApplication, price 0, OS Web Browser).
4. Validate with Rich Results Test / schema validator.

## Lessons Log

- **Vercel edge cache must be waited out** (from prior auto-promotion work): live verification requires checking `X-Vercel-Cache` and `Age` headers, not just status 200.
- **Static type-checking is non-negotiable**: `check-new-backlinks.ts` had a runtime syntax bug (`new URL(siteUrl)..hostname`) that `tsc` caught immediately. All SEO scripts must pass `npx tsc --noEmit`.
- **Spam is targeted**: the new wave uses `/game/*` targets to poison topical relevance. Phase 4 internal linking must actively reinforce health silos to counter this.
