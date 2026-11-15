# Staging import and rehearsal runbook (prepared 2026-11-15, NOT executed)

This runbook is prepared, not executed. No step here has run against a real system.
Every step that writes to a system needs the owner authorization quoted in §2.
Production stays NO-GO throughout.

## 0. Evidence already gathered (read-only, 2026-11-15)

| Item | Result | Kind |
|---|---|---|
| Staging Neon `small-hall-15225012`, DB `neondb`, PG 18.7 | reachable; articles 0, tools 0, subscribers / push subscriptions / leads 0; journal table absent | real, read-only |
| Staging and production column schemas | identical (md5 `4d256b4c…`, 1471 columns, 157 tables) | real, read-only (metadata only) |
| Staging migration ledger | 17 rows; missing only `20261115_120000_subscriber_consent_fields`. #67 adds `20261115_170000_enable_rls_missing_public_tables` | real, read-only |
| RLS | production: 0 public tables without RLS. Staging: 13 tables without RLS (fixed by the new migration). No non-owner role has grants on them, so nothing is exposed today | real, read-only |
| Importer tables and `id` sequences (9 collections) | all present | real, read-only |
| Staging runtime role `neondb_owner` | can create in `public`, bypasses RLS; no event triggers | real, read-only |
| Push, n8n and webhook settings in `audience` / `lead_gen` globals | 0 rows, so nothing is configured | real, read-only |
| R2 buckets | `healthylifestyles-media`, `healthylifestyles-staging-media` exist. **Token scopes are not visible to the available tool** | real bucket list only |
| `https://cms-qa.healthylifesstyles.com` | not verified reachable (see PR #67 comment 6897225154) | external |
| Live export dry run (frontend #56) | 0 sensitive findings, articles 60, tools 70 | real, read-only |
| Pre-release lock for the 16 release articles, against live production | `errors: []` (Verify 43684565019) | real, read-only |

## 1. Owner actions needed BEFORE authorization (smallest form)

**A. Hostinger QA application.** In hPanel → Websites, send the hosting plan name and the
domain list for this account. That shows whether a QA site already exists. If one exists,
also send:
- the hostname;
- the Git deployment page (repository, branch, last deployed commit);
- the Node.js app page (environment variable **names** only, never values).

If no QA site exists, the owner adds the subdomain `cms-qa.healthylifesstyles.com` as a
**new** Node.js app on the same plan. Do not touch the production site. Settings:
- repository `futurerotech/healthylifestyles-cms`;
- branch `codex/staging-mirror-import-20261115`;
- build `npm ci && npm run build`;
- start `npm start`.

DNS for the QA hostname is the record hPanel shows for that subdomain, usually a `CNAME` or
`A` record on `cms-qa`. It is added only with the owner's approval.

**B. Runtime evidence.** In the QA app's terminal or SSH session, the owner runs:

```
HLS_STAGING_READ_ONLY_APPROVED=yes node scripts/ci/hostinger-staging-runtime-evidence.mjs --read-only
```

The owner then pastes the single JSON line it prints. It contains no secrets. All of these
must be `true`:
- `stagingRuntimeEnvironmentScreened`
- `stagingSecretsDistinctFromProductionFingerprints`
- `postgresSessionVerified`
- `readOnlySessionVerified`
- `databaseOutboundSettingsEmpty`
- `databasePrivateAudienceEmpty`

Before running it, the owner sets `HLS_PRODUCTION_SECRET_SHA256` to the SHA-256 of the
production `PAYLOAD_SECRET` (`printf %s "$VALUE" | sha256sum` on the production host). A
fingerprint is not a secret.

**C. R2 boundary.** In Cloudflare → R2 → Manage API tokens, the owner opens the token used
by the QA app and sends a screenshot of its **Permissions** and **Bucket scope**. Required:
- permission "Object Read & Write";
- scope "Apply to specific buckets only" = `healthylifestyles-staging-media`.

Any token scoped to "All buckets", or to `healthylifestyles-media`, is NO-GO.

A safe denial test, run from the QA runtime with the staging token, touches no production
object:

```
aws s3api list-objects-v2 --bucket healthylifestyles-media --max-keys 1 --endpoint-url "$S3_ENDPOINT"   # must return AccessDenied
aws s3api put-object --bucket healthylifestyles-staging-media --key qa-probe/$(date +%s).txt --body /dev/null --endpoint-url "$S3_ENDPOINT"   # must succeed (staging only)
```

**D. Vercel team scope (only for deployment-setting evidence).** This session's Vercel
connection returns 403 for team `healthy-lifestyles` (team ID `team_DuQjbVToWiyUCDUl2CUYK9qx`).
The fix is one consent click on a link Claude generates on request. It is valid for 10
minutes. No reconnection is needed.

## 2. Exact authorization to request (after A–C pass)

> I authorize, for staging only:
> 1. deploying CMS commit `<exact #67 head SHA at authorization time; CI-verified 3009a4c or a later verified head>` to the Hostinger QA app `cms-qa.healthylifesstyles.com`;
> 2. running `npm run migrate` there, which applies only the additive
>    `20261115_120000_subscriber_consent_fields` and `20261115_170000_enable_rls_missing_public_tables`;
> 3. creating Neon branch `pre-import-20261115` in project `small-hall-15225012` as a restore point;
> 4. running `scripts/staging/import-bundle.ts --import` with a bundle produced by the
>    frontend export (`--out`), containing sanitized published public content only;
> 5. running the staging-only rehearsal in §4, including its cleanup and restore steps.
>
> This writes only to Neon project `small-hall-15225012` and R2 bucket
> `healthylifestyles-staging-media`. It does not authorize production, indexing, email,
> push, Vercel production, DNS for the production domain, or publishing.

## 3. Execution (only after §2)

1. **Restore point:** create a Neon branch `pre-import-20261115` from `br-wandering-poetry-bcxj8s3v`. Record its ID and LSN.
2. **Deploy and migrate:** deploy #67 to QA and run `npm run migrate`. Read-only checks afterwards:
   - 19 ledger rows;
   - 0 public tables without RLS.
3. **Re-run §1 B.** Every flag must still be `true`.
4. **Export:** from any machine, run
   `node scripts/content/staging-bootstrap-export.mjs --out bundle.json` (frontend #56). It must report 0 findings. Then copy `bundle.json` to the QA host.
5. **Import:** run `npx payload run scripts/staging/import-bundle.ts -- --import bundle.json`.
   - The bundle is refused unless all 16 release articles are present.
   - Record the `importId`.
   - If the result is `committed: true` with an error, run `--cleanup <importId>`.
6. **Verify:** run `--verify bundle.json`. Then `--list` from a **new** process; this checks that the journal survives a reconnect.

**Restore (any failure):**
- Preferred: `--cleanup <importId>`. It runs in one transaction, refuses if any record changed, and deletes only journaled records.
- Last resort: reset the staging branch to `pre-import-20261115` with Neon's "Reset from parent" or "Restore", at the recorded LSN. This removes **every** staging change since the restore point.

## 4. Rehearsal (results are recorded only when they really exist)

| # | Step | Pass criterion |
|---|---|---|
| 1 | Import approved public content | `created` = bundle record count; `--verify` → `verified: true` |
| 2 | IDs, slugs, relations, media references | `--verify` 0 problems; spot-check articles 5 and 32 in admin |
| 3 | Journal after reconnect | `--list` from a new process shows `committed` |
| 4 | 16 article digests | frontend release-candidate workflow against the QA origin: lock `errors: []` |
| 5 | Staging editor sign-in | admin login on QA with a staging-only account |
| 6 | Draft save with no side effects | QA logs show no IndexNow, Google, push or deploy call (`HLS_ISOLATED_STAGING` disables them) |
| 7 | Draft isolation | anonymous `GET /api/articles/<id>?draft=true` returns the published version only |
| 8 | Publish reviewed revisions | staging only; lock in `release` mode passes |
| 9 | Release-candidate build | `release-candidate.yml` against the QA mirror: PASS |
| 10 | Partial publication recovery | publish 9 of 16: lock fails closed; then complete or revert |
| 11 | Restore earlier Payload versions | admin "Restore version" on one article; digest returns to pre-release |
| 12 | Journal cleanup | `--cleanup <importId>` deletes exactly `created`; second run → `previouslyCompleted` |
| 13 | No unrelated deletions | a record created by an editor after import survives cleanup |
| 14 | Zero outbound side effects | Hostinger access logs and provider dashboards show no IndexNow, Google, n8n, push, email or Vercel hook calls in the window |
