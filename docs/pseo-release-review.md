# Minimal pSEO release candidate

Base: GitHub `main` at `b508b0dc3e751c276155468ebf55225522d84bbd`.
The owner confirmed this exact deployed Hostinger revision (last successful
deployment October 8, 2026). It matches this candidate's base.

The functional patch exposes only `status=published` rendered pSEO pages.
Anonymous users and editors cannot read drafts, templates, datasets, raw CSV
variables or keywords, or perform writes/generation. Published SEO image
relationships remain readable. No database columns or migrations change.
Startup outreach seeding requires explicit nonproduction opt-in and is always
disabled in production. Existing article/tool data is untouched.

Security dependencies and the verified metadata-only cloud-storage repair are
included because the unmodified base has known vulnerabilities. The audit is
mandatory before the normal build. See `vendor/README.md` for provenance,
maintenance. This branch excludes the broad repair branch's new content queue
and new migrations. GitHub Actions verifies only, never promotes branches.

Neon project `healthylifestyles-db`, branch `production`, is the confirmed database.
Remote pg connections now verify certificates and hostnames with Node's public
CA roots (including Neon's ISRG Root X1), require TLS 1.2 or later and prefer SCRAM
channel binding. No custom CA is needed for standard Neon. `DATABASE_CA_CERT`
is optional for explicitly trusted private/test CAs; invalid chains or hostnames
fail without an insecure retry. URI SSL parameters cannot replace the verified
driver settings. Conflicting query-host/credential parameters are rejected.
Only literal loopback connections without a custom CA use plaintext for local CI.
Automatic schema push is disabled in production even if its dev opt-in is set.

Cloudflare R2 bucket `healthylifestyles-media`, prefix `media/`, is confirmed.
The storage implementation, bucket selection, object keys, CDN URLs, credentials
and database schema are unchanged. The actual S3 SDK/adapter is tested against a
loopback R2 contract (auto region, SigV4, path-style routing, no ACLs), including
all responsive uploads, reads, ranges and deletion. This is not a claim that an
isolated Cloudflare bucket was used or that a production media backup exists.

CI additionally configures TLS on its disposable PostgreSQL service and checks
real verified queries, SCRAM-SHA-256-PLUS, downgrade resistance, untrusted CA
rejection and hostname mismatch rejection. Generated CI private keys stay in the
runner's temporary directory and are never committed or uploaded. It rehearses
`pg_dump`/`pg_restore` using synthetic data and compares every table's rows,
fingerprints, IDs, sequences and indexes after restoration to a second mock DB.

Local and CI tests use synthetic files and the disposable loopback PostgreSQL
`mock` database. No production secrets or database writes are required.
REST tests exercise published pagination, draft IDs/query attempts, selected
private fields, depth-10 relationships, editor/admin access and denied writes.

This is a review candidate, not deployment authorization. Hostinger auto-deploys
`main`; merging needs separate owner approval. Before an approved release,
verify a restorable Neon recovery point covering the release and an independent
R2 media backup; neither is verified as of the owner's latest confirmation.
Do not migrate, seed or import the production database.
Rollback must restore the previous application revision and dependency lock,
without restoring or altering the live database. A data restore would require
separate approval and a proven need; this patch changes no content schema.

Production release is blocked until those provider recovery checks and explicit
owner approval are complete. A successful disposable restore rehearsal does not
prove that `healthylifestyles-db` has PITR enabled or that R2 has a backup. Keep
the previous Hostinger release/artifact and environment settings available; the
confirmed rollback code target is `b508b0dc3e751c276155468ebf55225522d84bbd`.

References: [Neon secure connections](https://neon.com/docs/connect/connect-securely),
[pg TLS precedence/channel binding](https://node-postgres.com/features/ssl),
[Neon backup strategies](https://neon.com/docs/manage/backups),
[Cloudflare R2 S3 contract](https://developers.cloudflare.com/r2/api/s3/api/).

After an approved CMS-only release, anonymously enumerate every published pSEO
page by ID/slug and verify drafts/private fields remain inaccessible. Then run
the full Astro real-CMS build and preservation gate for 39 articles, 68 tool
routes, 39 hero images, 56 FAQs and the verified pSEO inventory. Reconcile all
routes/images/metadata/links/canonicals/sitemaps. Approve Vercel separately only
after those checks succeed. Until then production pSEO count stays unknown,
and a 403 must fail the Astro release build without local fallback.
