#!/usr/bin/env bash
# Scan actual Next.js build output inside the offline test container.
set -Eeuo pipefail
[[ "${HLS_CI_OFFLINE_CONTAINER:-}" == '1' && "${INDEXNOW_DISABLE:-}" == 'true' ]] || {
  echo 'NO-GO: artifact scan requires offline test runtime' >&2; exit 1;
}
[[ -d .next ]] || { echo 'NO-GO: .next build output absent inside test container' >&2; exit 1; }
# Do not echo matched content: actual credentials must never enter CI logs.
# Maintain provider-host-aware checks so legitimate placeholder examples do
# not block unrelated bundled vendor code.
PATTERNS='postgres(ql)?://[^[:space:]"]+@[a-zA-Z0-9.-]*(supabase\.co|neon\.tech|rds\.amazonaws\.com|azure|render\.com|railway|digitalocean)|AKIA(?!IOSFODNN7EXAMPLE)[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----(\\n|\n|\r|[A-Za-z0-9+/=]){40,}'
set +e
grep -rPzIq --include='*.js' --include='*.json' --include='*.map' -e "$PATTERNS" .next
result=$?
set -e
case "$result" in
  1) echo 'PASS: inspected Next build artifacts inside offline container; no matching provider credentials' ;;
  0) echo 'NO-GO: credential fingerprint detected in actual Next build output (details suppressed)' >&2; exit 1 ;;
  *) echo 'NO-GO: build artifact credential scan failed or could not read output' >&2; exit 1 ;;
esac
