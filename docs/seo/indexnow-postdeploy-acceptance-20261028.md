# IndexNow post-deployment acceptance checklist

Status: REVIEW ONLY. PR #34 does not enable production delivery until explicitly approved. The public Astro site and Payload CMS are independently deployed; the key proof is generated at the Astro build and cannot be assumed to match the CMS value.

## Non-destructive validation
1. Confirm the GitHub Actions run for the **exact** PR head commit passed unit, TypeScript, security and Next.js build gates. A previous green run on an older head is insufficient.
2. Admin opens the existing **Deploy** sidebar. If there is a pending CMS publish, the deploy trigger requests a Vercel build; accepting the hook does not prove successful publication. Wait until the Vercel production deployment is confirmed Ready by the operator.
3. Admin clicks **Preview IndexNow**. This authenticated request sends `confirm:false` to `/api/seo/reconcile-indexnow` and MUST NOT call the IndexNow provider or delete queued items. It checks the public `/content-manifest.json`, requires a direct nonredirected response with version 1, `source: cms`, `buildKind: cms` and the pinned canonical CMS origin, then checks build timestamp, published content version, canonical and robots and reports ready and deferred URLs.
4. Verify only published, publicly reachable, indexable, self-canonical URLs are ready. Every deferred item should have a reason. A legitimate unpublished, moved or noindex URL must remain unsent.
5. Production operator checks **without revealing secret values in logs** that CMS `INDEXNOW_API_KEY` is valid 32-character hex and Astro build includes a matching `/<key>.txt` ownership file on the **same canonical hostname**. The verifier requires a direct HTTP 200 at the exact key-file URL; it does not follow redirects to another path or host. Do not copy the actual key into GitHub, chats, analytics or this document.
6. Submitting requires an independent confirmation prompt and the literal JSON boolean `confirm: true` (never a truthy string or number), together with the reviewed exact URL list, queued change timestamps and public build identifier. Any divergence requires another preview and returns 409. No automatic retry of ambiguous results.
7. On successful IndexNow HTTP 200, acknowledge only the exact row ID + queued `changed_at` revision with a single atomic PostgreSQL DELETE ... RETURNING. A concurrent newer edit must not be cleared. HTTP 202, 4xx, network errors or missing key proof preserve pending entries. HTTP 200 means URL notification accepted, **not** that a page was crawled, indexed or ranked.
8. Independently verify Google Search Console URL Inspection stays read-only for health articles, and Google sitemap remains reachable. Google Indexing API submissions are not made for ineligible health URLs.
9. Confirm no regressions in frontend redirects, ads, CSP headers, the Astro generated manifest, article drafts or the normal CMS publishing workflow.

## Known limits and follow-up
- This stage is **manual** post-deployment review, not a signed Vercel Ready webhook.
- Each queue preview checks at most 20 entries with no more than 4 concurrent page checks, returning the original queue order despite differing network latency. Requires operator-driven requests; multiple slow/unreachable pages can still delay or defer a batch.
- Pending deletions, slug changes and redirects are not yet modeled as separate IndexNow URL_DELETED/redirect events. Do not describe this as a complete change-data capture solution.
- A generic CMS `updatedAt` may advance on a metadata-only edit; manifest and canonical checks remain essential. The sender should remain conservative.
- The queue publisher handles a 404 on updating an existing pending row by re-creating the pending event (a concurrent acknowledgement may have deleted the row). This is a narrow safety fallback, not a guarantee of exactly-once delivery. Distinct simultaneous creates still require an independent database uniqueness/idempotency review.
- The disposable PostgreSQL integration suite includes real revision mismatch and row-lock interleaving tests; CI results for the exact new head must pass before acceptance. This does not prove the production environment is configured correctly.
- Real production origin, service credentials and host keys cannot be validated from a GitHub CI run alone.
- Do not merge, deploy or send live notifications without owner permission.

## Rollback
Revert/disable this branch's feature safely through a reviewed follow-up PR; `INDEXNOW_DISABLE=true` disables real submissions while preserving the normal CMS content flow. Preserve the pending change queue and all existing Google Search Console, sitemap and SEO data.

- New publishes are serialized per document using PostgreSQL transaction advisory locks, avoiding simultaneous first-insert duplicates without a schema migration. Historical duplicate rows are untouched; their count and cleanup require a separate approved audit. The disposable PostgreSQL integration test sends eight concurrent publishes to one document and asserts one queued row and the newest timestamp.

- Publish queue recording now participates in the active Payload transaction where present. This prevents a queue entry from committing when its parent content publication rolls back; a new disposable-PostgreSQL integration test checks rollback. No production migrations or data cleanup.

- Live submission is fail-closed: `INDEXNOW_LIVE_ENABLED=true` must be deliberately configured by the owner in addition to admin preview/confirmation; `INDEXNOW_DISABLE=true` remains an emergency stop. Missing live-enable setting never sends provider requests. Do not activate either setting or change production secrets during draft review.

- Before accepting each queued identity, the reconciliation preview now counts matching (collectionSlug, docId) entries across the full queue, not just the selected page. Historical duplicates are deferred for manual audit and are never automatically removed. This check cannot replace an operator's read-only legacy duplicate audit.

- The admin pending deploy count is fail-closed: failed CMS queue reads return HTTP 503, not count zero. The UI displays an error and disables the deploy button until the count can be verified; never treat a database outage as site up-to-date.

- POST /api/deploy now fails closed if either the five-minute deploy-log debounce query or pending queue count cannot be verified. No Vercel hook is called after a failed or malformed count. Shared count validator has unit regression tests. Operators should resolve database availability rather than bypass this gate.

- Manual Vercel deploy triggers now use a transaction-scoped PostgreSQL advisory lock and insert an attempt reservation in deploy_log BEFORE calling the hook; competing admin requests cannot both pass the five-minute debounce. Failed or ambiguous hook calls keep the reservation and require manual review after cooldown. A reserved attempt does NOT prove Vercel Ready. Isolated PostgreSQL integration tests cover concurrent requests.

- Legacy in-memory IndexNow sender (currently not attached to article/tool hooks) now also requires INDEXNOW_LIVE_ENABLED=true for any real HTTP request, and emergency INDEXNOW_DISABLE is rechecked at flush time. Dedicated unit regressions cover these fail-closed controls. This is defense-in-depth, not permission to enable live sends.

- Native Node ESM and CommonJS GraphQL scalar smoke tests now run in mandatory CI and isolated diagnostics (`scripts/ci/graphql-scalars-compat.mjs`), independent of Vitest module realms. They validate the patched DateTime/EmailAddress types and introspection; they do NOT verify the hosted Payload HTTP GraphQL endpoint. PostgreSQL transaction/concurrency tests remain separate.

- PendingDeploys is machine-owned: API read requires admin, and API create/update/delete are denied for all roles. Reviewed server-side SQL exact-revision acknowledgement is the only normal deletion mechanism. A unit access regression protects this boundary.

- A failed published-content queue write now propagates from the afterChange hook rather than silently reporting success; the active Payload transaction is expected to roll back. Unit regression covers draft exclusion, queue error propagation, and successful recording. Verify exact-head CI before treating this as accepted; this is not proof that all external callers use transactions.

- Articles afterChange now runs trackPendingChange BEFORE afterPublishPushHook; Payload v3.91.0 executes these sequentially before committing the parent transaction. Queue failure therefore prevents an external push from being attempted by this hook. Full exactly-once/post-commit push delivery is NOT implemented and must be reviewed separately; a later push failure can still roll back publishing after partial external sends.

- Deployment security review: in production POST /api/deploy now accepts only the CMS browser Origin, not the broader frontend CORS allowlist; the server validates the exact HTTPS Vercel deploy-hook host/path before reserving an attempt, rejects redirects, applies a 15-second timeout, and returns generic errors that never expose the secret-bearing hook URL. Unit tests check the validation and origin policy. This does not authorize deploying or changing environment variables.

- 2026-10-29 direct-proof network guard: reconciliation fetches the public CMS-backed content manifest and candidate HTML only with `redirect: 'manual'`, and refuses a redirect or response URL mismatch before parsing it. This prevents redirect-following to off-site/private destinations during proof checks. Added unit tests for direct 200, redirect response and unsafe URL paths. PR-only; verify exact-head CI before acceptance.

- 2026-10-29 public response size guard: streaming uncompressed manifest JSON is capped at 2 MiB, checked HTML at 4 MiB, and IndexNow .txt ownership proof at 256 bytes. Actual bytes are counted even without Content-Length or when transfer encoding is chunked; malformed UTF-8 and invalid advertised lengths fail closed. Added regression tests; this remains DRAFT/NOT DEPLOYED and exact-head CI must be verified.

- 2026-10-29 hardening: deployed HTML canonical and meta-robots evidence is accepted only inside a unique actual document <head>, not from comments, scripts or body content; synthetic regressions added. Actual IndexNow provider POST now uses redirect:'error' to avoid forwarding key-bearing submission payload to a redirect destination. No external submission/deploy was performed. Exact-head CI required.

- 2026-10-29 robots safety: IndexNow preview now rejects `none` (equivalent to noindex,nofollow) in X-Robots-Tag and robots/bot meta, and recognizes in-body robot meta directives while ignoring inert comments/scripts. Avoid treating `noimageindex` or `nosnippet` as a `noindex` directive. Tests added; pending exact-head CI. No live IndexNow notification.

- 2026-10-29 metadata parsing hardening: HTML permits unquoted `rel`, `name`, and `content` attributes and numeric HTML references in metadata; IndexNow proof now checks these forms rather than overlooking `noindex`/`none`. Added focused regressions for unquoted `canonical`, unquoted robots `noindex`/`none`, and numeric references. No production changes; validate exact-head CI before acceptance.
