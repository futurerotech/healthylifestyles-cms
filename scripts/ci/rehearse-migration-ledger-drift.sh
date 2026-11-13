#!/usr/bin/env bash
set -euo pipefail
# Always operate on the Actions-owned disposable PostgreSQL service, never Neon.
[[ "${GITHUB_ACTIONS:-}" == 'true' && "${GITHUB_REPOSITORY:-}" == 'futurerotech/healthylifestyles-cms' ]] || exit 1
[[ "${RUN_DATABASE_TESTS:-}" == '1' && "${CI_MIGRATION_DRIFT_REHEARSAL:-}" == '1' ]] || exit 1
[[ "${DATABASE_URI:-}" == 'postgres://mock:mock@localhost:5432/mock' ]] || exit 1
[[ "${PAYLOAD_SECRET:-}" == 'ci-mock-payload-secret-not-production' ]] || exit 1
[[ "${INDEXNOW_DISABLE:-}" == 'true' ]] || exit 1
[[ -z "${VERCEL_DEPLOY_HOOK_URL:-}" && -z "${CHATGPT_DRAFT_BRIDGE_TOKEN:-}" ]] || exit 1
[[ "${POSTGRES_CONTAINER:-}" =~ ^[a-f0-9]{64}$ && -d "${RUNNER_TEMP:-/nonexistent}" ]] || exit 1

DB=mock_migration_drift
ROLLBACK=mock_migration_drift_rollback
SNAPSHOT="$RUNNER_TEMP/hls-migration-ledger-pre-rehearsal.dump"
query() {
  docker exec "$POSTGRES_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U mock -d "$1" -Atc "$2" | tr -d '\r'
}
[[ "$(query mock 'SELECT current_database()')" == mock ]] || exit 1
[[ "$(query mock_restore 'SELECT current_database()')" == mock_restore ]] || exit 1
docker exec "$POSTGRES_CONTAINER" createdb -U mock -T mock_restore "$DB"

AUTH=20261008_190423_add_reset_password_requested_at
MEDIA=20261008_225200_add_media_object_key
# The Payload CLI scans migrationDir and also discovers seo-audit-fix.ts,
# whose inert up/down exports make it a registered no-op on the empty mock DB.
[[ "$(query "$DB" 'SELECT COUNT(*) FROM payload_migrations')" == 17 ]] ||
  { echo 'NO-GO: expected 16 indexed migrations plus inert seo-audit-fix'; exit 1; }
[[ "$(query "$DB" "SELECT COUNT(*) FROM payload_migrations WHERE name='seo-audit-fix'")" == 1 ]] ||
  { echo 'NO-GO: expected the inert manual script to be recorded on fresh mock'; exit 1; }
[[ "$(query "$DB" "SELECT COUNT(*) FROM payload_migrations WHERE name IN ('$AUTH','$MEDIA')")" == 2 ]] ||
  { echo 'NO-GO: mock database has no two October migrations'; exit 1; }
[[ "$(query "$DB" "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND ((table_name='users' AND column_name='reset_password_requested_at') OR (table_name='media' AND column_name='_objectkey'))")" == 2 ]] ||
  { echo 'NO-GO: mock schema missing expected columns'; exit 1; }

# Mimic the *migration names* seen in production, using ONLY the synthetic DB.
docker exec -i "$POSTGRES_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U mock -d "$DB" <<'SQL'
BEGIN;
DELETE FROM payload_migrations
WHERE name IN ('20261008_190423_add_reset_password_requested_at',
               '20261008_225200_add_media_object_key');
COMMIT;
SQL
[[ "$(query "$DB" 'SELECT COUNT(*) FROM payload_migrations')" == 15 ]] || exit 1
[[ "$(query "$DB" "SELECT COUNT(*) FROM payload_migrations WHERE name='seo-audit-fix'")" == 1 ]] || exit 1
BEFORE_PSEO="$(query "$DB" 'SELECT COUNT(*) FROM pseo_pages')"
[[ "$BEFORE_PSEO" == 3 ]] || { echo 'NO-GO: expected synthetic pSEO data'; exit 1; }

schema_fingerprint() {
  # A stable fingerprint of relevant PostgreSQL DDL, excluding pg_dump output
  # formatting and mutable migration-ledger/sequence values.
  docker exec -i "$POSTGRES_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U mock -d "$1" -At <<'SQL' | tr -d '\r'
WITH columns AS (
  SELECT md5(coalesce(string_agg(table_name||'.'||column_name||':'||ordinal_position||':'||data_type||':'||is_nullable||':'||coalesce(column_default,''),
    E'\n' ORDER BY table_name,ordinal_position),'')) AS hash
  FROM information_schema.columns WHERE table_schema='public'
), indexes AS (
  SELECT md5(coalesce(string_agg(tablename||'.'||indexname||':'||indexdef,
    E'\n' ORDER BY tablename,indexname),'')) AS hash
  FROM pg_indexes WHERE schemaname='public'
), constraints AS (
  SELECT md5(coalesce(string_agg(c.conname||':'||pg_get_constraintdef(c.oid,true),
    E'\n' ORDER BY n.nspname,t.relname,c.conname),'')) AS hash
  FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public'
), sequences AS (
  SELECT md5(coalesce(string_agg(sequencename||':'||data_type||':'||increment_by||':'||start_value,
    E'\n' ORDER BY sequencename),'')) AS hash
  FROM pg_sequences WHERE schemaname='public'
)
SELECT md5(columns.hash||indexes.hash||constraints.hash||sequences.hash)
FROM columns,indexes,constraints,sequences;
SQL
}


# This checksum excludes only the intentionally changing migration ledger and
# its ID sequence. It covers the contents of EVERY other public table and the
# current values of all other public sequences. No raw row data is logged.
data_fingerprint() {
  docker exec -i "$POSTGRES_CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U mock -d "$1" -At <<'SQL' | tr -d '\r'
CREATE TEMP TABLE ci_data_fingerprint (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  row_digest text NOT NULL
);
DO $body$
DECLARE item record; n bigint; digest text;
BEGIN
  FOR item IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'payload_migrations'
    ORDER BY tablename
  LOOP
    EXECUTE format($stmt$
      SELECT count(*)::bigint,
             md5(coalesce(string_agg(value, chr(10) ORDER BY value), ''))
      FROM (
        SELECT row_to_json(t)::text AS value FROM public.%I t
      ) AS all_rows
    $stmt$, item.tablename)
      INTO n, digest;
    INSERT INTO ci_data_fingerprint VALUES (item.tablename, n, digest);
  END LOOP;
END $body$;
WITH rows AS (
  SELECT md5(coalesce(string_agg(
    table_name || ':' || row_count::text || ':' || row_digest,
    chr(10) ORDER BY table_name), '')) AS digest
  FROM ci_data_fingerprint
), sequences AS (
  SELECT md5(coalesce(string_agg(
    sequencename || ':' || coalesce(last_value::text, 'null'),
    chr(10) ORDER BY sequencename), '')) AS digest
  FROM pg_sequences
  WHERE schemaname = 'public'
    AND sequencename <> 'payload_migrations_id_seq'
)
SELECT md5(rows.digest || sequences.digest) FROM rows, sequences;
SQL
}

# Capture the exact pre-migration synthetic clone for rollback rehearsal.
docker exec "$POSTGRES_CONTAINER" pg_dump -U mock -d "$DB" -Fc --no-owner --no-acl > "$SNAPSHOT"
[[ -s "$SNAPSHOT" ]] || exit 1
BEFORE_SCHEMA="$(schema_fingerprint "$DB")"
BEFORE_DATA="$(data_fingerprint "$DB")"
[[ "$BEFORE_DATA" =~ ^[a-f0-9]{32}$ ]] ||
  { echo 'NO-GO: invalid baseline synthetic data fingerprint'; exit 1; }

# Exercise the actual Payload migration runner only against this mock clone.
DATABASE_URI="postgres://mock:mock@localhost:5432/$DB" \
PAYLOAD_SECRET=ci-mock-payload-secret-not-production \
INDEXNOW_DISABLE=true NODE_ENV=production \
  npx payload migrate --force-accept-warning

[[ "$(query "$DB" 'SELECT COUNT(*) FROM payload_migrations')" == 17 ]] ||
  { echo 'NO-GO: migration ledger did not reach 17 entries'; exit 1; }
[[ "$(query "$DB" "SELECT COUNT(*) FROM payload_migrations WHERE name IN ('$AUTH','$MEDIA')")" == 2 ]] ||
  { echo 'NO-GO: October migrations were not recorded'; exit 1; }
[[ "$(query "$DB" "SELECT COUNT(*) FROM payload_migrations WHERE name='seo-audit-fix'")" == 1 ]] ||
  { echo 'NO-GO: historical ledger entry disappeared'; exit 1; }
AFTER_SCHEMA="$(schema_fingerprint "$DB")"
AFTER_DATA="$(data_fingerprint "$DB")"
[[ "$BEFORE_DATA" == "$AFTER_DATA" ]] ||
  { echo 'NO-GO: synthetic non-migration table rows or sequences changed'; exit 1; }
[[ "$BEFORE_SCHEMA" == "$AFTER_SCHEMA" ]] ||
  { echo 'NO-GO: October migrations altered existing schema'; exit 1; }
[[ "$(query "$DB" 'SELECT COUNT(*) FROM pseo_pages')" == "$BEFORE_PSEO" ]] ||
  { echo 'NO-GO: synthetic pSEO data changed'; exit 1; }

# Restore the pre-migration dump into a third disposable DB and verify recovery.
docker exec "$POSTGRES_CONTAINER" createdb -U mock "$ROLLBACK"
docker exec -i "$POSTGRES_CONTAINER" pg_restore -U mock -d "$ROLLBACK" \
  --exit-on-error --no-owner --no-acl < "$SNAPSHOT"
[[ "$(query "$ROLLBACK" 'SELECT COUNT(*) FROM payload_migrations')" == 15 ]] || exit 1
[[ "$(query "$ROLLBACK" "SELECT COUNT(*) FROM payload_migrations WHERE name IN ('$AUTH','$MEDIA')")" == 0 ]] || exit 1
[[ "$(query "$ROLLBACK" "SELECT COUNT(*) FROM payload_migrations WHERE name='seo-audit-fix'")" == 1 ]] || exit 1
[[ "$(query "$ROLLBACK" 'SELECT COUNT(*) FROM pseo_pages')" == "$BEFORE_PSEO" ]] || exit 1
ROLLBACK_SCHEMA="$(schema_fingerprint "$ROLLBACK")"
ROLLBACK_DATA="$(data_fingerprint "$ROLLBACK")"
[[ "$ROLLBACK_DATA" == "$BEFORE_DATA" ]] ||
  { echo 'NO-GO: synthetic data rows or sequences were not restored'; exit 1; }
[[ "$ROLLBACK_SCHEMA" == "$BEFORE_SCHEMA" ]] || exit 1
echo 'PASS: synthetic production-like ledger (15 -> 17) rehearsed on mock clone.'
echo 'PASS: October migrations idempotent; schema and synthetic pSEO stable.'
echo 'PASS: synthetic pre-migration backup restored original 15-name ledger.'
echo 'PASS: full synthetic non-migration data/sequence fingerprints were preserved and restored.'
echo 'NO CLAIM: this is NOT a Hostinger staging deployment or Neon restore.'
