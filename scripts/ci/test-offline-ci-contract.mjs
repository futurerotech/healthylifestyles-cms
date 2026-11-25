import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');
const host = read('scripts/ci/run-offline-postgres.sh');
const child = read('scripts/ci/offline-postgres-entrypoint.sh');
const dockerfile = read('scripts/ci/offline-postgres.Dockerfile');
const workflow = read('.github/workflows/promote.yml');
const diagnostic = read('.github/workflows/indexnow-isolated-diagnostics.yml');
const route = read('src/app/api/seo/reconcile-indexnow/route.ts');
const scanner = read('scripts/ci/offline-build-artifact-scan.sh');

test('both workflows enter fail-closed offline PostgreSQL harness', () => {
  assert.match(workflow, /bash scripts\/ci\/run-offline-postgres\.sh full/);
  assert.match(diagnostic, /bash scripts\/ci\/run-offline-postgres\.sh diagnostic/);
  assert.doesNotMatch(workflow, /npx payload migrate/);
  assert.doesNotMatch(workflow, /npx vitest run/);
  assert.doesNotMatch(diagnostic, /npx payload migrate/);
  assert.doesNotMatch(diagnostic, /npx vitest run/);
});

test('Docker runner denies all outbound networks and host-gateway attachment', () => {
  assert.match(host, /docker run --rm --network none/);
  assert.doesNotMatch(host, /--network host|--network bridge|--add-host host\.docker\.internal|\/var\/run\/docker\.sock/);
  assert.match(child, /networkInterfaces\(\)/);
  assert.match(child, /Object\.keys\(interfaces\)\.sort\(\), \['lo'\]/);
  assert.match(child, /\/proc\/net\/route/);
  assert.match(child, /\/proc\/net\/if_inet6/);
  assert.match(child, /external TCP unexpectedly reachable/);
});

test('Docker-only runtime preserves real PostgreSQL 16 on loopback', () => {
  assert.match(dockerfile, /FROM postgres:16-bookworm/);
  assert.match(dockerfile, /FROM node:22-bookworm/);
  assert.match(child, /listen_addresses=127\.0\.0\.1/);
  assert.match(child, /--auth-host=scram-sha-256/);
  assert.match(child, /DATABASE_URI='postgres:\/\/mock:mock@localhost:5432\/mock'/);
  assert.match(child, /INDEXNOW_DISABLE=true INDEXNOW_LIVE_ENABLED=false RUN_DATABASE_TESTS=1/);
  assert.match(child, /payload migrate --force-accept-warning/);
  assert.match(child, /vitest run --config vitest\.integration\.config\.ts/);
});

test('host container has no provider credentials or Docker socket', () => {
  assert.match(host, /Explicit -e allowlist/);
  assert.match(child, /S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY/);
  assert.match(child, /GITHUB_TOKEN GH_TOKEN/);
  assert.doesNotMatch(host, /--privileged|--net=host|--network=host/);
});

test('live manifest cannot be fetched from actual CI-only route', () => {
  const guard = route.indexOf("process.env.HLS_CI_OFFLINE_CONTAINER === '1'");
  const fetch = route.indexOf("fetchPublic('/content-manifest.json')");
  assert.ok(guard >= 0 && fetch > guard, 'CI guard must precede public proof fetch');
  assert.match(route.slice(guard, fetch), /status: 503/);
});


test('PostgreSQL socket accepts existing local psql clients', () => {
  assert.match(child, /unix_socket_directories=\/var\/run\/postgresql/);
  assert.match(child, /--dns-result-order=ipv4first/);
});

test('actual offline Next build artifacts are scanned, not absent host artifacts', () => {
  assert.doesNotMatch(workflow, /grep -rPznI/);
  const build = child.indexOf('npm run build:ci');
  const scan = child.indexOf('bash scripts/ci/offline-build-artifact-scan.sh');
  const smoke = child.indexOf('node scripts/ci/isolated-staging-runtime-smoke.mjs');
  assert.ok(build >= 0 && scan > build && smoke > scan,
    'Build artifact scanner must run in the same offline container after build, before smoke');
  assert.match(scanner, /\[\[ -d \.next \]\]/);
  assert.match(scanner, /grep -rPzIq/);
  assert.match(scanner, /NO-GO: build artifact credential scan failed/);
});

test('local and GitHub execution are labeled separately', () => {
  assert.match(child, /HLS_CI_EXECUTION_CONTEXT/);
  assert.match(host, /HLS_CI_EXECUTION_CONTEXT=github/);
});


test('legacy IndexNow unit behavior is enabled ONLY in a scoped child process', () => {
  const unit = child.match(/^INDEXNOW_DISABLE=false npm test$/gm) || [];
  assert.equal(unit.length, 1, 'Unit override must occur exactly once');
  assert.match(child, /export INDEXNOW_DISABLE=true INDEXNOW_LIVE_ENABLED=false RUN_DATABASE_TESTS=1/);
  assert.match(child, /\[\[ "\$INDEXNOW_DISABLE" == true && "\$INDEXNOW_LIVE_ENABLED" == false \]\]/);
  assert.doesNotMatch(child, /^export INDEXNOW_DISABLE=false$/m);
  assert.ok(child.indexOf(unit[0]) > child.indexOf('external test-net IPv4 unreachable'));
  assert.ok(child.indexOf(unit[0]) < child.indexOf('export NODE_ENV=production'));
  assert.match(host, /docker run --rm --network none/);
});
