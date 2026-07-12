# Fix: data-safe localization migration `20260711_184910`

**Branch:** `fix/recover-en-title-excerpt` → **base `dev`** · open as **Draft**, merge only after the snapshot dry-run passes.

## Problem
The original migration (`b5a8fa8`) added `NOT NULL "_locale"` to already-populated child tables (deploy failed with a constraint violation) and dropped `articles.title` / `articles.excerpt` (and the `_articles_v` version columns) with **no backfill**. Because the whole `up()` runs in a single transaction, it failed atomically at the first `_locale` add — so the `DROP COLUMN` statements **never executed** and the base data is intact.

## Fix (`7be3880`)
- **`_locale` NOT NULL → two-step** (28 tables): `ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;` then `ALTER COLUMN "_locale" DROP DEFAULT;`. Uses the real enum type `"_locales"` (not `varchar`) to match Payload's generated Drizzle schema. New/empty tables keep a plain `NOT NULL`.
- **Backfill before drops:** `INSERT … SELECT` copies `title`/`excerpt` into `articles_locales` and `version_title`/`version_excerpt` into `_articles_v_locales` under `'en'` (idempotent via the `(_locale,_parent_id)` unique index); `articles_texts` / `_articles_v_texts` `locale` set to `'en'`. Only then are the base columns dropped.
- **Symmetric `down()`:** re-adds the base columns and restores their values **from** the `en` locale rows before dropping the locale tables, so rollback is also non-destructive.

## Guards added
- `scripts/ci/migration-safety-lint.ts` (+ CI step): fails any future localization migration that drops a base column without backfilling its `_locales` table (the incident migration is allowlisted; it's now safe anyway).
- `scripts/recovery/snapshot-dryrun.sh`: turnkey local dry-run + invariant checks.
- Frontend `getArticles` (separate branch): a reachable-but-empty CMS no longer masks the outage with `LOCAL_ARTICLES`.

## Mandatory pre-merge dry-run (production-shaped snapshot, local only)
```bash
docker run -d --name pg16 -e POSTGRES_USER=mock -e POSTGRES_PASSWORD=mock \
  -e POSTGRES_DB=mock -p 5432:5432 postgres:16-alpine
export DATABASE_URI=postgres://mock:mock@localhost:5432/mock PAYLOAD_SECRET=ci-mock
bash scripts/recovery/snapshot-dryrun.sh ./sanitized-prod-snapshot.sql
```
Prints `PASS` only if all invariants hold:
```sql
-- 1:1 retention — articles == en_rows == en_titled
SELECT (SELECT count(*) FROM articles)                                                  AS articles,
       (SELECT count(*) FROM articles_locales WHERE _locale='en')                       AS en_rows,
       (SELECT count(*) FROM articles_locales WHERE _locale='en' AND title IS NOT NULL) AS en_titled;
-- orphans (must be 0)
SELECT count(*) FROM articles_locales l LEFT JOIN articles a ON a.id=l._parent_id WHERE a.id IS NULL;
-- base columns gone AFTER backfill (must be 0 rows)
SELECT column_name FROM information_schema.columns
 WHERE table_name='articles' AND column_name IN ('title','excerpt');
```
Idempotency: re-restore the snapshot and re-run the script (a bare second `payload migrate` is a no-op — Payload skips applied migrations).

## Pre-flight abort condition
If the snapshot shows `articles.title`/`excerpt` **already missing**, STOP — the migration applied at some point and the backfill has no source. Use the forensic-artifact restore path instead and report back.

## Finalize
On `PASS`: approve → merge to `dev` → deploy via CI (`payload migrate --force-accept-warning`).
