#!/usr/bin/env bash
# Host-side preparation. Executes NO project code with network access after npm ci.
set -Eeuo pipefail
scope="${1:-full}"
[[ "$scope" == full || "$scope" == diagnostic ]] || { echo 'NO-GO: invalid offline test scope' >&2; exit 1; }
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_REPOSITORY:-}" == futurerotech/healthylifestyles-cms ]] || {
  echo 'NO-GO: this CI harness is restricted to the original GitHub Actions repository' >&2; exit 1;
}
command -v docker >/dev/null || { echo 'NO-GO: Docker is required for offline CI' >&2; exit 1; }
[[ -f package-lock.json && -d node_modules && -f scripts/ci/offline-postgres.Dockerfile ]] || {
  echo 'NO-GO: checkout and npm ci must complete before offline isolation' >&2; exit 1;
}
for forbidden in .env .env.local .env.production .env.production.local .env.test .env.test.local; do
  [[ ! -e "$forbidden" ]] || { echo "NO-GO: unexpected environment file: $forbidden" >&2; exit 1; }
done
# Use only a narrow build context: never include the checkout or node_modules in this image.
image="hls-postgres-offline-ci:${GITHUB_SHA:-local}"
docker build --file scripts/ci/offline-postgres.Dockerfile --tag "$image" scripts/ci
# Explicit -e allowlist: CI secrets, remote DB settings and provider tokens are NOT passed.
# No Docker socket, no network namespace sharing, and no extra network attachment.
docker run --rm --network none \
  --cap-drop NET_ADMIN --cap-drop NET_RAW --security-opt no-new-privileges:true \
  --tmpfs /tmp:rw,nosuid,nodev,size=1024m \
  --mount "type=bind,source=$PWD,target=/workspace" \
  --workdir /workspace \
  -e GITHUB_ACTIONS=true \
  -e GITHUB_REPOSITORY=futurerotech/healthylifestyles-cms \
  -e HLS_CI_OFFLINE_CONTAINER=1 \
  -e HLS_CI_OFFLINE_SCOPE="$scope" \
  -e HLS_CI_EXECUTION_CONTEXT=github \
  "$image" bash scripts/ci/offline-postgres-entrypoint.sh
