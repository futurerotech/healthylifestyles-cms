#!/usr/bin/env bash
set -euo pipefail
# Separate real owner/ACL restore check, strictly synthetic GitHub CI.
[[ "${GITHUB_ACTIONS:-}" == 'true' && "${CI:-}" == 'true' && "${RUN_DATABASE_TESTS:-}" == '1' ]] || exit 1
[[ "${DATABASE_URI:-}" == 'postgres://mock:mock@localhost:5432/mock' ]] || exit 1
[[ "${POSTGRES_CONTAINER:-}" =~ ^[a-f0-9]{64}$ ]] || exit 1
[[ -d "${RUNNER_TEMP:-}" ]] || exit 1
IDENTITY_CHECK="$(docker exec "$POSTGRES_CONTAINER" psql -U mock -d mock -Atc "SELECT CASE WHEN current_database()='mock' AND current_user='mock' AND (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN 'HLS_MOCK_SUPERUSER_PASS' ELSE 'HLS_MOCK_IDENTITY_FAIL' END")"
[[ "$IDENTITY_CHECK" == 'HLS_MOCK_SUPERUSER_PASS' ]] || { echo OWNER_ACL_DB_IDENTITY_HOLD; exit 1; }
echo OWNER_ACL_DB_IDENTITY_PASS

# pg_dump does NOT carry global CREATE ROLE: fixture provisions roles first.
docker exec -i "$POSTGRES_CONTAINER" psql -U mock -d mock -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE hls_ci_restore_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE hls_ci_restore_reader NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE TABLE public.hls_ci_owner_acl_probe (id integer PRIMARY KEY, marker text NOT NULL);
INSERT INTO public.hls_ci_owner_acl_probe (id, marker) VALUES (1, 'visible'), (2, 'hidden');
ALTER TABLE public.hls_ci_owner_acl_probe OWNER TO hls_ci_restore_owner;
GRANT USAGE ON SCHEMA public TO hls_ci_restore_reader;
GRANT SELECT ON public.hls_ci_owner_acl_probe TO hls_ci_restore_reader;
CREATE POLICY hls_ci_restore_reader_select
  ON public.hls_ci_owner_acl_probe FOR SELECT TO hls_ci_restore_reader
  USING (marker = 'visible');
ALTER TABLE public.hls_ci_owner_acl_probe ENABLE ROW LEVEL SECURITY;
SQL
# Intentionally restore BOTH ownership and ACLs (no --no-owner/--no-acl).
docker exec "$POSTGRES_CONTAINER" pg_dump -U mock -d mock -Fc > "$RUNNER_TEMP/hls-mock-owner-acl.dump"
docker exec "$POSTGRES_CONTAINER" createdb -U mock mock_owner_acl_restore
docker exec -i "$POSTGRES_CONTAINER" pg_restore -U mock -d mock_owner_acl_restore --exit-on-error < "$RUNNER_TEMP/hls-mock-owner-acl.dump"
node --test tests/ci-owner-acl-restore.node-tests.mjs
node scripts/ci/verify-owner-acl-restore.mjs
