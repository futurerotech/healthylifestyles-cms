#!/usr/bin/env bash
# Exact synthetic backup/restore rehearsal, using the same local postgres instance.
set -Eeuo pipefail
[[ "${HLS_CI_OFFLINE_CONTAINER:-}" == 1 && "${RUN_DATABASE_TESTS:-}" == 1 ]] || exit 1
[[ "${DATABASE_URI:-}" == 'postgres://mock:mock@localhost:5432/mock' ]] || exit 1
[[ "${GITHUB_ACTIONS:-}" == true && -d "${RUNNER_TEMP:-/nonexistent}" ]] || exit 1
[[ "$(gosu postgres psql -X -U mock -d mock -Atc 'SELECT current_database()')" == mock ]] || exit 1
DUMP="$RUNNER_TEMP/hls-mock-backup.dump"
gosu postgres pg_dump -U mock -d mock -Fc --no-owner --no-acl > "$DUMP"
[[ -s "$DUMP" ]] || exit 1
gosu postgres createdb -U mock mock_restore
gosu postgres pg_restore -U mock -d mock_restore --exit-on-error --no-owner --no-acl < "$DUMP"
node scripts/ci/verify-restored-database.mjs
