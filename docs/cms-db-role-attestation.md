# CMS DB role identity attestation — operator runbook

**Scope:** `cms.healthylifesstyles.com` on Hostinger, Payload/Postgres. This diagnostic is **disabled by default** and must not be enabled in production without an approved maintenance/deployment change window. It does not perform schema migrations, SELECT application rows, change roles, or alter credentials.

## Why it exists

The saved Hostinger `DATABASE_URI` was verified to target Neon production using the configured `neondb_owner` principal. That is not proof of the effective DB principal in a *running* CMS instance. Production currently has 157 public tables with RLS enabled, but the owner role has `BYPASSRLS`. An RLS flag on its own does not constrain an owner/BYPASS role. This check emits one sanitized line about **the effective SQL session obtained through Payload's existing Drizzle database adapter**.

## Controlled activation (separate explicit approval needed)

1. Review the exact proposed commit and keep this PR in draft until CI, security review, and maintenance authorization.
2. On a reviewed build of the CMS, an authorized operator may set `CMS_DB_IDENTITY_AUDIT=1` for **one start-up only**. Do not set/print/copy `DATABASE_URI` in a ticket, chat, CI log or debug output. Any saving of Hostinger environment variables or restart is a deployment/configuration change needing a separate approval and rollback plan.
3. Examine the private Hostinger runtime log for one line of the form `CMS_DB_IDENTITY_ATTESTATION=CODE`. No database name, role name, hostname, password, SQL row or full URI is logged by this module.
4. Remove the temporary flag after capturing the sanitized result, using the provider's approved change procedure. Do not infer that a role change or data migration happened.

## Result interpretation

- `RLS_ACTIVE_FOR_ROLE`: the audited SELECT used a matching non-superuser, non-BYPASSRLS role and PostgreSQL reported RLS active for that role on every ordinary/partitioned public table. **This does not prove policies allow only intended actions or that other pooled sessions use the same role.**
- `RLS_NOT_ACTIVE_FOR_ROLE`: the role flags were non-bypass, but one or more public tables had no effective RLS for the actual role, or there were no public tables. Release HOLD; investigate ownership/FORCE RLS and table settings.
- `RLS_BYPASS`: URI-matching active login has SUPERUSER or BYPASSRLS; RLS cannot be relied on to restrict that role. Security review required.
- `IDENTITY_MISMATCH`: SQL session identity or database differs from URI authority/path. Release HOLD; do not copy identifying values into logs.
- `CONFIG_INVALID`, `EVIDENCE_INVALID`, `QUERY_FAILED`: no positive attestation. Release HOLD; investigate with a private, authorized operator. Driver exceptions are deliberately not logged.
- `DISABLED`: no query was attempted.

**Limits:** Attests one SQL execution from the actual Payload adapter at start-up. It is not evidence of all pool connections, application ACLs, correctness of RLS policy expressions, backup restoration, effective external URL availability or a security sign-off. It does not cure the currently failing Vercel preview: the preview's `DATABASE_URI` is structurally invalid and Preview/Production secret scoping has not been independently isolated. Never reuse production Neon credentials for a preview.

## Safety checklist

- Neither this PR nor PR #71 is a production release authorization.
- No `DATABASE_URI` value is accepted by a publicly callable endpoint; no routes are added.
- No new credentials, DB role, database, schema, RLS policies or SQL write operations.
- No live Hostinger, Neon or Vercel changes were performed to implement this check.
