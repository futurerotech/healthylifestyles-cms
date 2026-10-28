# HealthyLifeStyles — Search Intelligence & Editorial OS
Status: RESEARCH FOUNDATION / READ-ONLY prototype. No production data access, paid APIs, automatic CMS creation or publishing. October 28, 2026.

## Principles
- Discover user problems and actual queries using authorized Google Search Console data; never confuse GSC impressions with total global searches.
- Google Trends is a relative 0–100 index; Keyword Planner advertising competition is not organic SEO difficulty. External query expansion is exploratory and must be labeled by source/time/market.
- Rank existing-page improvement opportunities first. New URLs require independent intent, no cannibalization, verified differentiator, and manual approval.
- Every output retains source, UTC date range, country, device, metric definitions, sample biases, and confidence; null for unsupported metrics.
- Avoid scaled, thin, automatically published YMYL content. Do not manufacture author/reviewer credentials or scientific studies.
- Existing DeepSeek SEO Copilot, AI Writing Assistant, generate-article endpoint, pSEO, URL Inspection and editorial CMS must be reused, not duplicated.

## Initial isolated implementation
src/lib/searchOpportunityEngine.ts takes authorized, already-exported GSC query+page rows for 28-day periods; rejects untrusted hosts/private or query-string URLs and invalid numbers; dedupes; emits explainable priority score (55% observed on-site demand proxy, 35% ranking improvement window, 10% observed change). This number is editorial triage only, not keyword difficulty, search volume, ranking probability or a forecast. Includes explicit risk-flag for medical topics (not a complete clinical-risk classifier).
src/lib/searchOpportunityEngine.test.ts provides deterministic regressions, rejects invented volume, stale/private host and malformed rows. No API calls.

## Roadmap (separate gates, after IndexNow PR #34 review)
1. Data-availability and permissions: verify read-only GSC property with existing account and Search Analytics API; paginate safely; anonymization is not guaranteed, so protect query exports, minimize retention and never send to AI providers by default.
2. Discovery adapters: authorized GSC Search Analytics, verified Trends surfaces/exports if allowed, first-party site search feedback. Keyword Planner only if user's authenticated account legitimately has access; never scrape Google autocomplete or violate provider terms. Mark unofficial/free third-party sources with provenance and rate limits.
3. Clustering and exact-match duplicate checks against live CMS tools/articles, query/page cannibalization detection, SERP intent review with evidence rather than fake SEO "KD".
4. Editorial brief: search intent, unmet user need, original tool vs article choice, competing site URLs, authoritative source plan, article outline, meaningful examples, claim verification, internal linking and clear review owner.
5. Review pipeline: research lead -> senior health content editor -> source verifier -> qualified medical reviewer when needed -> owner final publish gate. No AI physician impersonation. Every claim citation must be checked, accessible and applicable; review claims before setting reviewedByHuman.
6. Feedback loop: compare 28d/28d and 90d/90d, normalized for query, device and country; distinguish seasonality, content revisions, sparse data and Google algorithm changes. Log changed recommendations; never self-rewrite production code or self-publish.
7. Quality metrics: updated-page lift in nonbrand clicks/impressions, verified content accuracy, completion of user tasks, tool usage (privacy-respecting), no newly orphaned/duplicate pages; no guaranteed SERP top position.

## Staffing: proposed specialist seat
Senior Medical Content Strategist / Managing Editor (US English, 5+ yrs verifiable editorial work, demonstrated AMA-style evidence appraisal, medical literacy, SERP intent, topical architecture, reader-centered copy, SEO without keyword stuffing). Require portfolio with revisions and citation audits, factual correction sample, conflicts disclosures, reproducible editorial process. This person need not be a physician; separately verify actual licensed clinician on high-risk content. Avoid using a fictional avatar as a reviewer. Candidates can be found through professional associations e.g. AMWA/EMWA or verified accredited practitioner networks; no hire is claimed.

## Important existing defect found during code audit
src/endpoints/aiWriting.ts prompt currently says AI is "a board-certified physician and medical writer with 15+ years". This is misleading. Fix wording in an independently reviewed small PR or this isolated research branch, without touching production content. Existing AiWriting and AiSeo use DEEPSEEK_API_KEY (may incur costs), so default research engine must be deterministic/offline, provider access opt-in, with no unverified claim of zero dollar cost for model calls.

## Status of indexing
CMS PR #34 is separate, draft/unmerged; last checked head 47fda2ab... with CI success 40696756451. Production launch / actual key proof not yet confirmed. Do not block safe research prototype, but no merge/deploy or new production operations until owner approves.

Sources
https://developers.google.com/webmaster-tools/v1/searchanalytics/query
https://support.google.com/google-ads/answer/6325025
https://trends.google.com/trends/
https://developers.google.com/search/docs/fundamentals/creating-helpful-content
https://developers.google.com/search/docs/essentials/spam-policies
