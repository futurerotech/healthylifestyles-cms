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

## 2026-10-29 data integrity review
- The offline screener now accepts only one-segment, lower-case, canonical `/tools/{slug}` and `/wellness-hub/{slug}` URLs on the canonical origin. It refuses nested/tag/pSEO targets, encoded paths and trailing slash variations rather than proposing review of an unrelated page. This does not prove a given slug currently exists: live CMS verification remains a separate gate.
- Duplicate previous-period query/page keys are explicitly flagged and the affected impression-change percentage is unknown rather than based on whichever duplicate appeared first. `duplicateBaselineKeys` exposes the condition for source-data correction; neither row is automatically added to the other.
- No network, AI service, GSC connector, production database or publishing operation is added by this change.

## 2026-10-29 current-period deduplication gate
- Any normalized current-period query/page identity appearing more than once is excluded in full rather than selecting the first GSC export row; this prevents export-order-dependent editorial scoring. `duplicateCurrentKeys` reports distinct affected identities, with a corrective caveat.
- Section roots `/tools/pseo` and `/wellness-hub/tag` are excluded from review-as-detail-page recommendations. Canonical URL validation does not substitute for a real CMS lookup.
- This read-only change does not access live Search Console, publish content or modify production data.

## 2026-10-29 metric-consistency gate
- Read-only GSC row validation now requires whole-number safe click/impression counts and an average position >=1, and checks that CTR matches clicks/impressions within a 0.000001 rounding tolerance; zero-impression rows must have zero CTR. Contradictory or transformed rows are rejected, not used for editorial prioritization.
- This is a structural check of already exported data, not proof of source provenance or a connection to live Search Console.

## 2026-10-29 medical-risk triage review
- Expanded conservative keyword triggers for postpartum/prenatal, insulin/glucose, chest pain/stroke, anxiety/self-harm and children/newborn concerns. This is a triage hint only; a false flag does NOT mean medical content is safe or can bypass an appropriate qualified review.
- No article creation, medical review claims, automatic publishing, live GSC query or production changes.
