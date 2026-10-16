# Minimal pSEO release candidate

Base: GitHub `main` at `b508b0dc3e751c276155468ebf55225522d84bbd`.
The deployed Hostinger revision is not yet independently confirmed. Verify its
SHA before approving this candidate; GitHub main is not proof of deployed code.

The functional patch exposes only `status=published` rendered pSEO pages.
Anonymous users and editors cannot read drafts, templates, datasets, raw CSV
variables or keywords, or perform writes/generation. Published SEO image
relationships remain readable. No database columns or migrations change.
Startup outreach seeding requires explicit nonproduction opt-in and is always
disabled in production. Existing article/tool data is untouched.

Security dependencies and the verified metadata-only cloud-storage repair are
included because the unmodified base has known vulnerabilities. The audit is
mandatory before the normal build. See `vendor/README.md` for provenance,
maintenance and the staging-bucket verification still needed. This branch
excludes the broad repair branch's new content queue, new migrations and TLS
connection refactor. GitHub Actions verifies only, never promotes branches.
The base's remote PostgreSQL TLS setting still disables certificate validation;
the broad repair PR corrects it. This pre-existing risk must be resolved and its
CA configuration verified in staging before production approval. A zero npm
audit does not cover deployment configuration or database certificate checks.

Local and CI tests use synthetic files and the disposable loopback PostgreSQL
`mock` database. No production secrets or database writes are required.
REST tests exercise published pagination, draft IDs/query attempts, selected
private fields, depth-10 relationships, editor/admin access and denied writes.

This is a review candidate, not deployment authorization. Hostinger auto-deploys
`main`; merging needs separate owner approval. Before an approved release,
confirm the deployed SHA/build/start settings, take and verify a provider DB
backup and media inventory, and rehearse the build and storage smoke test in an
isolated environment. Do not migrate, seed or import the production database.
Rollback must restore the previous application revision and dependency lock,
without restoring or altering the live database. A data restore would require
separate approval and a proven need; this patch changes no content schema.

After an approved CMS-only release, anonymously enumerate every published pSEO
page by ID/slug and verify drafts/private fields remain inaccessible. Then run
the full Astro real-CMS build and preservation gate for 39 articles, 68 tool
routes, 39 hero images, 56 FAQs and the verified pSEO inventory. Reconcile all
routes/images/metadata/links/canonicals/sitemaps. Approve Vercel separately only
after those checks succeed. Until then production pSEO count stays unknown,
and a 403 must fail the Astro release build without local fallback.
