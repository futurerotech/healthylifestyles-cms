# Hostinger staging runtime identity — read-only evidence procedure (2026-11-14)

Scope: the isolated Hostinger QA CMS that must exist before any real staging
verification of the post-deploy IndexNow flow (#34 + #64). This document does
not authorize running anything against a provider. **Production: NO-GO.**

## 1. Checker

`scripts/ci/hostinger-staging-runtime-evidence.mjs`, ported from #62 onto #64
(the rest of the #36–#62 stack is not merged; it diverges from #64 by
131 ahead / 102 behind across 90 files).

What it does, and does not do:

| Mode | Network | Writes | What it proves |
|---|---|---|---|
| `screenHostingerStagingRuntime(env)` (pure) | none | none | the calling process's environment names the staging DB host, staging R2 bucket and QA origin, has every disable flag set, and holds no search-engine or deploy credential |
| `--read-only` CLI, with `HLS_STAGING_READ_ONLY_APPROVED=yes` | one TLS-verified PostgreSQL session to the staging host | none (`default_transaction_read_only=on`, one `SELECT`) | that session's database, role, PostgreSQL 18 and read-only mode |

It never deploys, migrates, uploads, touches R2 objects, contacts a search
engine or prints credentials. It requires no schema change. It does **not**
prove that it runs on Hostinger, or anything about Cloudflare IAM.

### Defects fixed while porting (review of #62)

1. **Bucket names.** #62 expected `healthylifesstyles-staging-media` and
   `healthylifesstyles-media` (the domain's three-s spelling). The real R2
   buckets, and the `payload.config.ts` default, are `healthylifestyles-…`.
   A correctly configured staging runtime would always have failed.
2. **Unscreened indexing credentials.** #62 screened `INDEXNOW_KEY` (legacy
   hook) but not `INDEXNOW_API_KEY`, the key #34's live post-deploy
   reconciliation actually uses, nor `GOOGLE_INDEXING_CREDENTIALS`. A runtime
   holding a live IndexNow key could have passed. All are now in
   `FORBIDDEN_STAGING_CREDENTIALS`, and a drift test fails if `src/` ever
   reads an indexing or deploy credential that list does not contain.

## 2. Checks completed now (read-only provider metadata, 2026-11-14)

| Item | Source | Result |
|---|---|---|
| Staging DB host `ep-plain-forest-bca0vqud.c-16…` | Neon API | exists; project `small-hall-15225012` (healthylifestyles-staging), branch `br-wandering-poetry-bcxj8s3v` |
| Production DB host `ep-lucky-voice-ad5egz8d.c-2…` | Neon API | exists; project `holy-sea-80468476` (healthylifestyles-db) — a different project |
| Staging DB name / role | Neon API | `neondb` / `neondb_owner` (matches checker) |
| Staging DB contents | read-only SQL | Payload schema present; 0 tool rows |
| R2 buckets | Cloudflare API | `healthylifestyles-media`, `healthylifestyles-staging-media` exist separately |

## 3. Gates that need separately authorized runtime access — NOT VERIFIED

| Gate | Needs | Status |
|---|---|---|
| A QA app exists at `https://cms-qa.healthylifesstyles.com`, on Hostinger, running the reviewed SHA | Hostinger panel access | UNVERIFIED |
| That app's process environment passes the screen | run the checker inside that app (owner-approved) | UNVERIFIED |
| That process's `DATABASE_URI` reaches the staging DB read-only | `--read-only` run inside that app | UNVERIFIED |
| R2 token is limited to the staging bucket; production bucket denied | Cloudflare token-scope inspection (owner-approved) | UNVERIFIED |
| Credentials are not shared with production (`INTERNAL_API_KEY`, `PAYLOAD_SECRET`, `SYNC_SHARED_SECRET`, S3 keys) | owner comparison in Hostinger; the checker cannot see production values | UNVERIFIED |
| Authenticated smoke, rollback tied to the release candidate, preview/canonical/noindex proof | the above, then owner release acceptance | UNVERIFIED |

## 4. Known limitations to resolve before relying on the result

- **Owner role.** The staging DB has only `neondb_owner`. Read-only is
  enforced by the session setting, which an owner role can override. A
  dedicated read-only role would make the check stronger; creating it is a
  provider change and needs owner approval.
- **Exact host match.** A pooled host (`…-pooler…`) or a different staging
  branch endpoint is rejected (fail-closed). Configure the direct host.
- **`pg` import.** The CLI imports `pg`, which is installed only transitively
  (via `@payloadcms/db-postgres`).
- **Cost exposure, not isolation.** AI provider keys (`ANTHROPIC_API_KEY`,
  `OPENAI_API_KEY`, etc.) are not screened; a staging runtime holding them can
  spend money but cannot touch production content or search engines.

## 5. Procedure when access is authorized

1. Owner confirms the QA app identity and deployed SHA in the Hostinger panel.
2. Inside that app only: `HLS_STAGING_READ_ONLY_APPROVED=yes node scripts/ci/hostinger-staging-runtime-evidence.mjs --read-only`.
3. Record the JSON result (it contains no secrets) with the SHA and time.
4. Owner inspects the R2 token scope in Cloudflare.
5. Only then: IndexNow dry-run reconciliation on staging (`INDEXNOW_DRY_RUN=true`), never a live submission.
