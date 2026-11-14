# Newsletter suppression and consent evidence (2026-11-15)

**Status:** review branch `codex/newsletter-suppression-20261115`. Not merged or deployed. The migration has run only on the disposable CI database. No subscriber records were read or changed.

## What this adds

| Piece | Behavior |
|---|---|
| `src/lib/newsletter-suppression.ts` | HMAC-SHA256 signed tokens: `v1.<payload>.<sig>`. The payload holds the subscriber ID, the expiry (default 90 days) and a random nonce, and **no email address**. Verification is constant-time and generic for every failure. Also exports `isSendable` and `SENDABLE_WHERE` (`unsubscribedAt` is not set). |
| `POST /api/subscriber-unsubscribe` | Public. The token is the only credential. It accepts JSON `{token}`, a form field `t`, or `?t=` for RFC 8058 one-click, and there is deliberately no GET, so link prefetchers cannot unsubscribe anyone. It is idempotent and keeps the original opt-out date. Fresh, already-unsubscribed and deleted subscribers get the same response, which never contains an email address. |
| `POST /api/subscriber-send-check` | Server-to-server, requiring `x-sync-secret`. It is the **pre-send suppression check** for any provider. Suppressed and unknown addresses both get `sendable: false`. A sendable address gets a fresh page link and a one-click link. If either secret is missing, it returns 503. |
| `subscriberSync` | Forwards a new record to n8n only when `isSendable(created)` is true. |
| `Subscribers` | Adds `consentAt` and `consentNoticeVersion`. Both are server-stamped, for web-form signups only. Client values are ignored, imports get none, and the values are frozen on update. Read, update and delete stay admin-only. |
| Migration `20261115_120000_subscriber_consent_fields` | Additive: 2 nullable columns. The down migration intentionally keeps them, so the consent record is never destroyed. |

## Irreducible dependency

Actual email delivery needs a sending provider, which is an owner decision. Before any newsletter email is sent:

1. Set `UNSUBSCRIBE_TOKEN_SECRET` (random, at least 32 characters) and `SYNC_SHARED_SECRET`.
2. The sender calls `subscriber-send-check` for **every** recipient, immediately before every send, and skips anyone with `sendable: false`.
3. Each email body contains `unsubscribeUrl`. The headers must include:
   - `List-Unsubscribe: <oneClickUrl>`
   - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
4. Ship the frontend `/unsubscribe` page (PR #56) together with this branch.

## Known limits

- The frontend `/api/lead` webhook forward to n8n carries no unsubscribe link. The n8n flow must call `subscriber-send-check` before emailing.
- Existing subscribers have no consent record. Whether to email them is an owner and legal decision.
- Double opt-in is not implemented (owner decision).

## Stacking and paths

- This branch is stacked on CMS #65, which is on #64, then #34. It merges after that chain.
- #65 found that the collection route `/api/subscribers/:id` can shadow `/api/subscribers/<name>` custom paths. That is why it added `/api/subscriber-sync`. These endpoints use collision-free paths for the same reason: `/api/subscriber-unsubscribe` and `/api/subscriber-send-check`.
