# SEO Roadmap State — healthylifesstyles.com

Living state file for the self-evolving SEO engagement. Updated after every phase.

## Meta

- **Current phase:** 3 — Toxic Backlinks & Disavow
- **Status:** reconciled; awaiting backlink CSV export
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
| `scripts/seo/check-new-backlinks.ts` | **exists but stale/buggy** | Has a syntax error `new URL(siteUrl)..hostname` (double dot). Requires API key (Ahrefs/Moz) and is API-only — no CSV support. |
| CSV-based disavow builder | **missing** | Need `scripts/build-disavow.ts`. |
| Human-review workflow | **missing** | Need manifest output + approval gate before finalizing `disavow.txt`. |
| Versioned disavow output | **missing** | Currently single static file. |
| `build*.log` in CMS | **untracked noise** | Not in `.gitignore` yet. |

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

1. Request backlink CSV export from Ahrefs/Semrush/Moz (see required columns below).
2. Write `scripts/build-disavow.ts`:
   - Auto-detect vendor by column headers.
   - Normalize to: `referring_domain`, `target_url`, `dr`/`da`, `spam_score`, `first_seen`.
   - Flag rules:
     - spam score > 30%
     - PBN footprints (blog5, qowap, blog2learn, onesmablog, jaiblogs, getblogs, dbblog, rankinghighseo patterns + subdomain-blog networks)
     - irrelevant foreign TLDs for a US health site
     - any `target_url` containing `/game/`
   - Merge with existing `docs/disavow.txt` (dedupe, preserve dated comments).
   - Output:
     - `docs/disavow.txt` (final, only after human approval)
     - `docs/disavow-review-manifest.json` (human-review table: domain, reason, evidence, suggested action)
     - `docs/disavow-history/YYYY-MM-DD-disavow.txt` (versioned snapshot)
3. Fix the syntax bug in `scripts/seo/check-new-backlinks.ts`.
4. Add `build*.log` to CMS `.gitignore`.
5. Run `npx tsc --noEmit` + `npm run build` (CMS) before landing on `dev`.
6. Self-audit → update Phase 4 plan.

### Required CSV Columns

Please export a **referring domains** report (not individual backlinks) from Ahrefs, Semrush, or Moz. I need these columns:

1. `Referring domain` (or `Domain`) — the source domain.
2. `Target URL` (or `Linked page`) — which of our pages is linked.
3. `DR` / `DA` / `Authority score` — domain authority.
4. `Spam score` (Moz) or `AS` / `Spam Score` (Ahrefs/Semrush) — the spam metric.
5. `First seen` — when the link was first discovered.

Optional but useful:
6. `Backlinks` — number of links from that domain.
7. `Dofollow %` or `Dofollow links`.

Accepted header variants will be auto-detected.

## Phase 4 — Internal Linking Architecture (topic silos)

*Plan will be finalized after Phase 3 self-audit. Tentative:*

1. Reconcile existing linking: `primaryTool`, `relatedTools`, `relatedArticles`, tag pages, category hubs.
2. Payload Local API script: propose article ↔ calculator matches (slug/keyword/category), output manifest for approval, then apply.
3. `RelatedTools.astro` component: 2–3 related tools + category hub, data-driven from CMS.
4. Build-time orphan check: fail CI if any published tool/article has zero inbound internal links.

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

- *None yet for this engagement — first state file.*
- From the prior auto-promotion work: always verify on the live site, not just CI; Vercel edge cache can lag and must be waited out or explicitly checked.
