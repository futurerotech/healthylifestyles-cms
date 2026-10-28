# IndexNow post-deployment acceptance checklist

Status: REVIEW ONLY. PR #34 does not enable production delivery until explicitly approved. The public Astro site and Payload CMS are independently deployed; the key proof is generated at the Astro build and cannot be assumed to match the CMS value.

## Non-destructive validation
1. Confirm the GitHub Actions run for the **exact** PR head commit passed unit, TypeScript, security and Next.js build gates. A previous green run on an older head is insufficient.
2. Admin opens the existing **Deploy** sidebar. If there is a pending CMS publish, the deploy trigger requests a Vercel build; accepting the hook does not prove successful publication. Wait until the Vercel production deployment is confirmed Ready by the operator.
3. Admin clicks **Preview IndexNow**. This authenticated request sends `confirm:false` to `/api/seo/reconcile-indexnow` and MUST NOT call the IndexNow provider or delete queued items. It checks the public `/content-manifest.json`, build timestamp, published content version, canonical and robots and reports ready and deferred URLs.
4. Verify only published, publicly reachable, indexable, self-canonical URLs are ready. Every deferred item should have a reason. A legitimate unpublished, moved or noindex URL must remain unsent.
5. Production operator checks **without revealing secret values in logs** that CMS `INDEXNOW_API_KEY` is valid 32-character hex and Astro build includes a matching `/<key>.txt` ownership file on the **same canonical hostname**. Do not copy the actual key into GitHub, chats, analytics or this document.
6. Submitting requires an independent confirmation prompt and passes the reviewed exact URL list, queued change timestamps and public build identifier. Any divergence requires another preview and returns 409. No automatic retry of ambiguous results.
7. On successful IndexNow HTTP 200, verify the queue is acknowledged only after provider acceptance. HTTP 202, 4xx, network errors or missing key proof preserve pending entries. HTTP 200 means URL notification accepted, **not** that a page was crawled, indexed or ranked.
8. Independently verify Google Search Console URL Inspection stays read-only for health articles, and Google sitemap remains reachable. Google Indexing API submissions are not made for ineligible health URLs.
9. Confirm no regressions in frontend redirects, ads, CSP headers, the Astro generated manifest, article drafts or the normal CMS publishing workflow.

## Known limits and follow-up
- This stage is **manual** post-deployment review, not a signed Vercel Ready webhook.
- The first batch examines up to 20 oldest pending entries and subsequent previews process the rest. Requires operator-driven requests.
- Pending deletions, slug changes and redirects are not yet modeled as separate IndexNow URL_DELETED/redirect events. Do not describe this as a complete change-data capture solution.
- A generic CMS `updatedAt` may advance on a metadata-only edit; manifest and canonical checks remain essential. The sender should remain conservative.
- Real production origin, service credentials and host keys cannot be validated from a GitHub CI run alone.
- Do not merge, deploy or send live notifications without owner permission.

## Rollback
Revert/disable this branch's feature safely through a reviewed follow-up PR; `INDEXNOW_DISABLE=true` disables real submissions while preserving the normal CMS content flow. Preserve the pending change queue and all existing Google Search Console, sitemap and SEO data.
