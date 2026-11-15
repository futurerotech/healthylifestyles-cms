# Newsletter suppression and consent evidence (2026-11-15)

**Status:** review branch `codex/newsletter-suppression-20261115`. Not merged or deployed. The migration has run only on the disposable CI database. No subscriber records were read or changed.

## What this adds

| Piece | Behavior |
|---|---|
| `src/lib/newsletter-suppression.ts` | HMAC-SHA256 signed tokens: `v1.<payload>.<sig>`. The payload holds the subscriber ID, the expiry (default 90 days) and a random nonce, and **no email address**. Verification is constant-time and generic for every failure. Also exports `isSendable` and `SENDABLE_WHERE` (`unsubscribedAt` is not set). |
| `POST /api/subscriber-unsubscribe` | Public. The token is the only credential. It accepts JSON `{token}`, a form field `t`, or `?t=` for RFC 8058 one-click, and there is deliberately no GET, so link prefetchers cannot unsubscribe anyone. It is idempotent and keeps the original opt-out date. Fresh, already-unsubscribed and deleted subscribers get the same response, which never contains an email address. |
| `POST /api/subscriber-send-check` | Server-to-server, requiring `x-sync-secret`. It is the **pre-send eligibility check** for any provider. It returns `sendable: true` only when the record is not suppressed AND has complete consent evidence from an accepted method (`isEligibleForMarketing`). Unknown, suppressed, legacy and imported addresses all get the same `sendable: false`. An eligible address gets a fresh page link and a one-click link. If either secret is missing, it returns 503. |
| `subscriberSync` | Forwards a new record to n8n only when `isEligibleForMarketing(created)` is true. Sync imports never carry consent, so they are never forwarded (fail-closed). |
| `Subscribers` | Adds `consentAt`, `consentNoticeVersion` and `consentMethod`. They are recorded only when the create comes from the trusted signup proxy, which presents `INTERNAL_API_KEY` and `x-consent-capture: newsletter-form-v1`. A client-controlled `source` or any body field never counts. Imports and legacy records get none. Evidence is frozen on update, and `unsubscribedAt` is one-way. Read, update and delete stay admin-only. |
| Migration `20261115_120000_subscriber_consent_fields` | Additive: 3 nullable columns (`consent_at`, `consent_notice_version`, `consent_method`), added with `IF NOT EXISTS`. The down migration intentionally keeps them, so the consent record is never destroyed. |

## Irreducible dependency

Actual email delivery needs a sending provider, which is an owner decision. Before any newsletter email is sent:

1. Set `UNSUBSCRIBE_TOKEN_SECRET` (random, at least 32 characters) and `SYNC_SHARED_SECRET`.
2. The sender calls `subscriber-send-check` for **every** recipient, immediately before every send, and skips anyone with `sendable: false`.
3. Each email body contains `unsubscribeUrl`. The headers must include:
   - `List-Unsubscribe: <oneClickUrl>`
   - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
4. Ship the frontend `/unsubscribe` page (PR #56) together with this branch.

## Suppression is not eligibility (review comment 6886950310)

- `isSuppressed`: the record is unsubscribed.
- `isEligibleForMarketing`: the record is not suppressed AND has `consentAt`, `consentNoticeVersion` and an accepted `consentMethod`.
- "Not unsubscribed" alone is never eligible. Missing or unknown consent is a release blocker, not a default.
- `form-single-opt-in` records a form submission behind the trusted proxy. It is **not** verified mailbox ownership: there is no double opt-in. Whether single opt-in is acceptable, and what happens to legacy records, are owner and legal decisions. Until they are made, `ELIGIBLE_CONSENT_METHODS` must not be widened.

## Known limits

- The frontend `/api/lead` webhook forward to n8n carries no unsubscribe link. The n8n flow must call `subscriber-send-check` before emailing.
- Existing subscribers have no consent record, so they are ineligible. Re-consenting them would need a separate, owner-approved confirmation flow. A resubmitted signup is a rejected duplicate create and does not add consent.
- Double opt-in is not implemented (owner decision).
- Lead-offer signups (`/api/lead`) do not send the consent-capture header, so those records are ineligible for newsletter email. Only the newsletter form captures consent.

## Stacking and paths

- This branch is stacked on CMS #65, which is on #64, then #34. It merges after that chain.
- #65 found that the collection route `/api/subscribers/:id` can shadow `/api/subscribers/<name>` custom paths. That is why it added `/api/subscriber-sync`. These endpoints use collision-free paths for the same reason: `/api/subscriber-unsubscribe` and `/api/subscriber-send-check`.

## Integration sequence (prepared, not executed)

Dependency order: `main` ← #34 ← #64 ← #65 ← #66. Each PR's base is the previous PR's branch.

1. Merge #34 into `main`, then retarget #64 to `main`. Re-run CI and confirm the exact head is green.
2. Do the same for #64, then #65.
3. Retarget #66 to `main`. It must show only its own commits, with no conflicts. Run CI, which includes the October ledger rehearsal, now expecting 18 and 16 entries.
4. Frontend #56 deploys only after #66 is live, because `/api/unsubscribe` needs `/api/subscriber-unsubscribe`, and the signup proxy's consent header needs the #66 hook.
5. Run the migration only in an authorized release, on isolated staging first. It is additive and `down` keeps the data.
6. **Newsletter delivery stays NO-GO** until all of the following hold:
   - an email provider is chosen;
   - the legal policy for single opt-in and for legacy records is set;
   - the independent security and privacy approval is given;
   - staging proves that the sender calls `subscriber-send-check` immediately before every send. The staging cases must cover unknown consent, unsubscribed, duplicate, expired token, and an address suppressed after it was forwarded.
