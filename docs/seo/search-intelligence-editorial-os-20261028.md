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

## 2026-10-29 declared export comparability gate
- Added pure offline `src/lib/gscExportIntegrity.ts`, requiring two adjacent 28-day inclusive PT periods, exact query/page dimension order, finalized web-search data and identical property, aggregation, country, device and declared additional-filter fingerprints before growth screening.
- This validation checks **caller-declared metadata only**; it does not authenticate Google Search Console ownership, prove request provenance or confirm complete query coverage. The existing scorer remains available for low-level testing, while production GSC ingestion must require the stricter envelope.
- No GSC account connection, paid API call, production write, publishing or deployment.

## 2026-10-29 bounded raw request gate
- Added `src/lib/gscRawRequestGate.ts` for offline inspection of one Search Analytics request and response from each period. Only first-page, non-full (rows < rowLimit) finalized web/query+page batches with no dimension filters are eligible for the existing 28-day scope comparison. Reject offset pagination, full pages that might be truncated, unexpected aggregation and unaudited filter groups.
- This is **not** a complete Search Console ingestion pipeline. Even a short page does not guarantee exhaustive GSC data; authenticated provenance and top-row selection limitations remain. No API calls or production writes occur.

## 2026-10-29 offline report implementation
- `src/lib/gscOfflineReport.ts` converts previously validated captured request/response pages into a deterministic human-review report. Default output excludes search query text and per-page URLs; the caller must explicitly pass `includeQueries: true` to reveal detailed opportunities. Score distribution, duplicate counts, medical review flags and caveats remain visible.
- This is a library-only implementation, NOT a production Google Search Console connection, CLI or authenticated data ingest. No paid API, CMS write, automated publication or live external request.

## 2026-10-29 zero-row GSC export correctness
- A completed, otherwise valid Search Analytics response can omit `rows` when no data matched. The offline request and pagination gates now treat that exact omission as an empty result, including an empty terminal page; explicit null, strings and other malformed `rows` remain rejected. Added targeted regressions. This does not imply complete Google query coverage or live API authorization.

## 2026-10-29 existing-page review grouping
- Offline GSC report supports deterministic grouping by exact canonical existing page, with up to three representative screened queries per page. Counts and click/impression sums represent only accepted query/page sample rows, not total page traffic; no semantic intent clustering is claimed. The group flags high-risk keyword rows for independent editorial review.
- The grouped URLs and search queries appear only when a caller explicitly sets `includeQueries:true`; default serialized reports remain redacted. `top` bounds displayed page groups and individual rows independently. No live GSC access, paid API, CMS publication, or production data changes.

## 2026-10-29 multi-page query review
- Added pure `src/lib/gscCrossPageOverlap.ts` to identify the exact normalized query observed on two or more different canonical pages in already screened data. Reports affected page counts and medical review flags, with sampled metrics only. This is not proof of cannibalization, intent overlap or lost traffic; human SERP, on-page and CMS validation remain required.
- Query and page details appear only with `includeQueries:true`; redacted default contains aggregate counts. Tests cover duplicate exclusion, medical flagging and privacy. No network, live CMS access, publication or provider submission.

## 2026-10-30 offline editorial review queue
- Added `src/lib/gscEditorialReviewQueue.ts` and focused tests. The pure library requires structurally validated 28-day GSC request/response pairs and a caller-declared bounded CMS reference snapshot. It emits page-level human-only review actions: verify current record/canonical, resolve missing/ambiguous snapshot, inspect indexability, compare observed multi-page queries, verify sensitive medical evidence, and review existing content/tool experience.
- Publication/indexability are NOT independently verified; ambiguous or missing records are not interpreted as live 404s. The module never calls Google, CMS, AI services, IndexNow or paid APIs, does not propose CMS mutations, and hides page/query details unless `includeDetails:true` is explicitly set. All decisions remain manual; no automated editing, draft creation, merging or publication.
- Exact-head CI and production/preview deployment are separate gates; passing offline tests does not authenticate search exports or CMS status.

## 2026-10-30 tool enablement review gate
- Editorial Review Queue now treats an existing tool as merely declared indexable only if the caller-declared record says published, noIndex:false AND enabled:true. Missing, null or false enabled values are explicitly human-review conditions, never assumed enabled. Articles are unaffected because they do not use that tool-specific enablement rule. This remains offline metadata, not proof of public reachability or actual CMS status. Targeted tests cover true, false, unknown and malformed enabled data.

## 2026-10-30 read-only Payload projection adapter and canonical override gate
- Verified existing `src/collections/Tools.ts`, `src/collections/Articles.ts` and `src/fields/seo.ts` on main: publication state uses `_status`, indexability override `seo.noIndex`, canonical `seo.canonical`, and tools carry `enabled`. Added `gscPayloadSnapshotAdapter.ts` to normalize only caller-provided bounded CMS projections. Absent fields remain unknown, never implicitly published/indexable. The editorial queue flags mismatched explicit canonical overrides for human review, retains valid declared record IDs, and never attempts a CMS lookup/write. Tests cover canonical redirects and malformed projections. No online verification of a given record is claimed.

## 2026-10-30 bounded, access-controlled Payload local reader
- Added `src/lib/gscPayloadReadOnlyCollector.ts` requiring a real authenticated administrator/editor `PayloadRequest`, using Payload Local API `find` with `overrideAccess:false`, `draft:false`, `depth:0`, minimal selected fields, stable ID ordering, bounded pagination (100 per page) and maximum 25,000 combined records. Rejects missing IDs, duplicate paginated IDs, inconsistent metadata and malformed projections. Explicitly does not offer an HTTP endpoint or write to CMS. This is request-scoped and not a transactionally frozen snapshot; a caller must still validate live canonicals and Search Console provenance. No actual production read has been executed.
