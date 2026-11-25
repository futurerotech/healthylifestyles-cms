#!/usr/bin/env bash
# Called ONLY inside docker run --network none. No provider credentials are passed.
set -Eeuo pipefail
[[ "${HLS_CI_OFFLINE_CONTAINER:-}" == '1' && "${GITHUB_ACTIONS:-}" == true &&
   "${GITHUB_REPOSITORY:-}" == 'futurerotech/healthylifestyles-cms' ]] || {
  echo 'NO-GO: restricted to the offline GitHub Actions container' >&2; exit 1;
}
[[ "${HLS_CI_OFFLINE_SCOPE:-}" == full || "${HLS_CI_OFFLINE_SCOPE:-}" == diagnostic ]] || exit 1
# Fail closed: no non-loopback interfaces (no host gateway, NAT, DNS or IPv6 egress).
node --input-type=module <<'JS'
import os from 'node:os';
import assert from 'node:assert/strict';
const interfaces = os.networkInterfaces();
assert.deepEqual(Object.keys(interfaces).sort(), ['lo'], 'NO-GO: network interface other than loopback');
for (const iface of interfaces.lo || []) {
  assert.equal(iface.internal, true, 'NO-GO: non-internal loopback address');
}
console.log('PASS: offline test container exposes loopback only; no host gateway interface');
JS
# Extra kernel routing check; fail if any non-loopback route exists.
if awk 'NR>1 && $1!="lo" { exit 1 }' /proc/net/route; then :; else
  echo 'NO-GO: unexpected non-loopback IPv4 route' >&2; exit 1
fi
if [[ -r /proc/net/if_inet6 ]] && awk '$6!="lo" { exit 1 }' /proc/net/if_inet6; then :; else
  echo 'NO-GO: unexpected IPv6 interface' >&2; exit 1
fi
for forbidden in VERCEL_DEPLOY_HOOK_URL CHATGPT_DRAFT_BRIDGE_TOKEN INDEXNOW_API_KEY \
  S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_ENDPOINT HLS_PRODUCTION_DATABASE_HOST \
  DATABASE_CA_CERT GITHUB_TOKEN GH_TOKEN; do
  [[ -z "${!forbidden:-}" ]] || { echo "NO-GO: unexpected provider credential/config: $forbidden" >&2; exit 1; }
done
export RUNNER_TEMP=/tmp/hls-ci-runner
mkdir -p "$RUNNER_TEMP"
export DATABASE_URI='postgres://mock:mock@localhost:5432/mock'
export PAYLOAD_SECRET='ci-mock-payload-secret-not-production'
export INDEXNOW_DISABLE=true INDEXNOW_LIVE_ENABLED=false RUN_DATABASE_TESTS=1
export NODE_OPTIONS='--dns-result-order=ipv4first'
# The real PostgreSQL server remains inside the loopback-only namespace.
# GITHUB_ACTIONS=true is required by legacy integration guards even for local Docker tests.
# A local run is NOT a GitHub Actions CI result; it is explicitly labeled below.
case "${HLS_CI_EXECUTION_CONTEXT:-}" in
  local) echo 'NOTICE: LOCAL Docker offline rehearsal only; NOT a GitHub Actions result.' ;;
  github) echo 'NOTICE: GitHub Actions offline PostgreSQL test container.' ;;
  *) echo 'NO-GO: execution context not explicit' >&2; exit 1 ;;
esac
# A synthetic 64-hex identifier is used solely by the historical rehearsal guard.
# The rehearsal script selects inline local PostgreSQL; Docker is unavailable here.
export POSTGRES_CONTAINER='0000000000000000000000000000000000000000000000000000000000000000'
install -d -m 700 -o postgres -g postgres /tmp/hls-ci-pgdata
cleanup() {
  gosu postgres pg_ctl -D /tmp/hls-ci-pgdata -m immediate stop >/dev/null 2>&1 || true
}
trap cleanup EXIT
# Loopback-only PostgreSQL 16, same isolated network namespace as the app/tests.
# Match the former Actions postgres:16 service's password-based TCP auth.
# Only Unix-domain sockets use trust, and those never leave this namespace.
printf 'mock\n' > /tmp/hls-ci-pg-pass
chown postgres:postgres /tmp/hls-ci-pg-pass
chmod 600 /tmp/hls-ci-pg-pass
export PGPASSWORD=mock
gosu postgres initdb -D /tmp/hls-ci-pgdata --username=mock \
  --auth-local=trust --auth-host=scram-sha-256 --pwfile=/tmp/hls-ci-pg-pass >/dev/null
gosu postgres pg_ctl -D /tmp/hls-ci-pgdata -l /tmp/hls-ci-pg.log \
  -o '-c listen_addresses=127.0.0.1 -c port=5432 -c unix_socket_directories=/var/run/postgresql' -w start >/dev/null
gosu postgres createdb -h 127.0.0.1 -U mock mock
[[ "$(gosu postgres psql -X -U mock -d mock -Atc 'SELECT current_database()')" == mock ]] || exit 1
# Inside network=none every TCP destination other than loopback is unroutable.
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import net from 'node:net';
await new Promise((resolve, reject) => {
  const s = net.connect({ host: '198.51.100.10', port: 443, timeout: 1500 });
  s.once('connect', () => { s.destroy(); reject(Error('NO-GO: external TCP unexpectedly reachable')); });
  s.once('error', (error) => {
    if (!['ENETUNREACH', 'EHOSTUNREACH', 'EACCES', 'EPERM'].includes(error.code)) {
      reject(Error('NO-GO: unexpected external egress probe result ' + error.code));
    } else { resolve(); }
  });
  s.once('timeout', () => { s.destroy(); reject(Error('NO-GO: external route not conclusively absent')); });
});
console.log('PASS: external test-net IPv4 unreachable; local PostgreSQL responsive');
JS

# The default INDEXNOW_DISABLE=true is mandatory for migrations, integration,
# built runtime, and real providers. Only the legacy IndexNow UNIT suite needs
# to exercise in-memory queuing, dry-run output, and a failure at 127.0.0.1:9.
# Enable that test-only behavior in a CHILD PROCESS for the whole unit suite.
# Parent shell stays disabled; --network none has already been proven above.
# No real key is passed, and the only chaos connection is to loopback.
INDEXNOW_DISABLE=false npm test
[[ "$INDEXNOW_DISABLE" == true && "$INDEXNOW_LIVE_ENABLED" == false ]] || {
  echo 'NO-GO: indexing disable variables changed outside unit test scope' >&2; exit 1;
}
export NODE_ENV=production
npx --no-install payload migrate --force-accept-warning
node scripts/ci/check-auth-schema.mjs
if [[ "$HLS_CI_OFFLINE_SCOPE" == diagnostic ]]; then
  npx --no-install vitest run --config vitest.integration.config.ts \
    tests/integration/indexnow-queue-ack.test.ts \
    tests/integration/indexnow-attempts-authorization.test.ts
  node scripts/ci/offline-postgres-rls.mjs
  echo 'PASS: offline diagnostic; no deployment or indexing occurred.'
  exit 0
fi
# The main integration suite includes real PostgreSQL TLS verification.
source scripts/ci/offline-postgres-tls.sh
export ALLOW_DB_PUSH=true
npx --no-install vitest run --config vitest.integration.config.ts
unset ALLOW_DB_PUSH
bash scripts/ci/offline-postgres-backup.sh
export CI_MIGRATION_DRIFT_REHEARSAL=1
bash scripts/ci/rehearse-migration-ledger-drift.sh
unset CI_MIGRATION_DRIFT_REHEARSAL
node scripts/ci/offline-postgres-rls.mjs
# Same command body as npm run build, without prebuild's npm audit HTTP dependency.
# Security audit was already run on the networked host BEFORE entering this namespace.
npm run build:ci
# Scan the ACTUAL artifacts inside the container that built them.
# A host-side .next scan would silently miss container-only build output.
bash scripts/ci/offline-build-artifact-scan.sh
export CI_STAGING_ROLE_INTEGRATION=1
export HLS_ISOLATED_STAGING=true
export HLS_STAGING_CMS_ORIGIN=https://cms-qa.healthylifesstyles.com
export SERVER_URL=https://cms-qa.healthylifesstyles.com
npx --no-install vitest run --config vitest.integration.config.ts \
  tests/integration/isolated-staging-roles.test.ts
unset CI_STAGING_ROLE_INTEGRATION
export CI_ISOLATED_STAGING_RUNTIME_SMOKE=1
export HLS_CI_BLOCK_PUBLIC_MANIFEST=1
node scripts/ci/isolated-staging-runtime-smoke.mjs
unset CI_ISOLATED_STAGING_RUNTIME_SMOKE
printf 'PASS: offline DB migration, TLS integration, backup/restore, drift, RLS, build, and staging smoke.\n'
