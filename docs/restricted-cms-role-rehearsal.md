# CMS restricted-role rehearsal — isolated engineering evidence

This document describes CI-only evidence for the possibility of a **future**
least-privilege PostgreSQL role for HealthyLifeStyles Payload CMS. It is NOT
a production role migration plan, production authorization, or copy/paste SQL
for any Neon/Hostinger database.

## Current verified limitation

- The production Neon catalog has **157 ordinary/partitioned public tables,
  157 RLS-enabled, 0 explicit RLS policies**.
- All 157 are owned by `neondb_owner`, which has `BYPASSRLS`. With the
  current state, simply switching Hostinger to a non-bypass role could make
  production CMS reads and writes fail due to PostgreSQL's default-deny RLS.
- This original policy-free RLS state is **deliberate**: the earlier baseline
  migration was designed to deny access to public/anonymous SQL API roles,
  while Payload connects directly through the database owner. Do not add
  blanket `TO PUBLIC` or `USING (true)` policies to “fix” it.
- The synthetic CI case tests **only one deliberately tiny fixture**, not
  Payload's full real collections or a secure multi-tenant CMS policy model.

## What the new mock-only CI gate actually proves

`scripts/ci/rehearse-restricted-cms-policy.mjs`:

1. Refuses to run unless GitHub Actions, CI, the exact original repository,
   `RUN_DATABASE_TESTS=1`, and the exact known disposable local mock DB URI
   are all confirmed.
2. Connects and attests `mock` superuser and `mock` database identity;
   checks both fixture names are unused.
3. Runs one explicit SQL transaction and creates a **NOLOGIN**, non-super,
   non-BYPASS role plus one synthetic table. No real user record or other
   Payload collection is read.
4. Shows that granting CRUD but having **zero RLS policies** results in default
   denial of synthetic SELECT and INSERT for the restricted role.
5. Creates four **transactional** tenant-scoped policies on the fixture only.
   Shows permitted synthetic SELECT/INSERT/UPDATE/DELETE work for tenant 1,
   while tenant-2 SELECT/UPDATE/DELETE and tenant-2 INSERT/tenant move are
   rejected.
6. Rolls back the entire transaction and confirms the test role and table are
   gone. An exception takes the same rollback path.

The test uses `SET LOCAL ROLE` to simulate the effective restricted principal;
that NOLOGIN role is NOT a real CMS credential or deployed session. The CI
output contains only allowlisted pass markers and no database row content.

## Required future, separately authorized acceptance gates

- Inventory every real CMS collection, global, joins/version table, role,
  granted schema/table/sequence privilege and migration ownership requirement.
- Build an intentionally designed policy model on a **restored isolated staging
  clone**, with access rules reviewed for users, media, tools, drafts,
  PSEO, subscribers, leads, audit, and admin writes. Prove both expected
  grants and cross-role forbidden operations.
- Execute a real authenticated admin/API read/write/upload/draft rehearsal
  with a test account, rollback evidence and an authorized reviewer.
- Separately verify Hostinger's **actual running** SQL `session_user` via
  reviewed, explicit opt-in attestation PR #72.
- Test independent Vercel Preview database isolation, human security approval,
  and approved deployment rollback. Production `main` is untouched.

**Never** run this CI script against Neon or Hostinger. It is explicitly
blocked from connecting to anything other than
`postgres://mock:mock@localhost:5432/mock`.
