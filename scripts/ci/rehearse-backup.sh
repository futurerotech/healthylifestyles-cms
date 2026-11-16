#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == 'true' && "${CI:-}" == 'true' && "${RUN_DATABASE_TESTS:-}" == '1' ]] || exit 1
[[ "${DATABASE_URI:-}" == 'postgres://mock:mock@localhost:5432/mock' ]] || exit 1
[[ "${RUN_DATABASE_RESTORE_PROFILE:-full-integration}" == 'full-integration' || "${RUN_DATABASE_RESTORE_PROFILE:-}" == 'rls-pg18' ]] || exit 1
[[ "${POSTGRES_CONTAINER:-}" =~ ^[a-f0-9]{64}$ ]] || exit 1
[[ "$(docker exec "$POSTGRES_CONTAINER" psql -U mock -d mock -Atc 'SELECT current_database()')" == 'mock' ]] || exit 1
# Synthetic table, rows and nonempty RLS policy exercise actual policy restoration.
# This runs only inside a disposable GitHub Actions Postgres container.
docker exec -i "$POSTGRES_CONTAINER" psql -U mock -d mock -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.hls_ci_restore_rls_probe (id integer PRIMARY KEY, marker text NOT NULL);
INSERT INTO public.hls_ci_restore_rls_probe (id, marker) VALUES (1, 'ci-allow'), (2, 'ci-deny');
CREATE POLICY hls_ci_restore_select ON public.hls_ci_restore_rls_probe
  FOR SELECT TO PUBLIC USING (marker = 'ci-allow');
ALTER TABLE public.hls_ci_restore_rls_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hls_ci_restore_rls_probe FORCE ROW LEVEL SECURITY;
SQL
# Every byte is synthetic CI data. Never invoke this against a provider endpoint.
docker exec "$POSTGRES_CONTAINER" pg_dump -U mock -d mock -Fc --no-owner --no-acl > "$RUNNER_TEMP/hls-mock-backup.dump"
docker exec "$POSTGRES_CONTAINER" createdb -U mock mock_restore
docker exec -i "$POSTGRES_CONTAINER" pg_restore -U mock -d mock_restore --exit-on-error --no-owner --no-acl < "$RUNNER_TEMP/hls-mock-backup.dump"
node scripts/ci/verify-restored-database.mjs
