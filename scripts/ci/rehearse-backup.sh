#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == 'true' && "${RUN_DATABASE_TESTS:-}" == '1' ]] || exit 1
[[ "${POSTGRES_CONTAINER:-}" =~ ^[a-f0-9]{64}$ ]] || exit 1
[[ "$(docker exec "$POSTGRES_CONTAINER" psql -U mock -d mock -Atc 'SELECT current_database()')" == 'mock' ]] || exit 1
# Every byte is synthetic CI data. Never invoke this against a provider endpoint.
docker exec "$POSTGRES_CONTAINER" pg_dump -U mock -d mock -Fc --no-owner --no-acl > "$RUNNER_TEMP/hls-mock-backup.dump"
docker exec "$POSTGRES_CONTAINER" createdb -U mock mock_restore
docker exec -i "$POSTGRES_CONTAINER" pg_restore -U mock -d mock_restore --exit-on-error --no-owner --no-acl < "$RUNNER_TEMP/hls-mock-backup.dump"
node scripts/ci/verify-restored-database.mjs
