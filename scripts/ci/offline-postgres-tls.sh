#!/usr/bin/env bash
# Source this file from the offline entrypoint to preserve exported TLS fixture vars.
set -Eeuo pipefail
[[ "${HLS_CI_OFFLINE_CONTAINER:-}" == 1 && "${RUN_DATABASE_TESTS:-}" == 1 ]] || exit 1
TLS_DIR="$RUNNER_TEMP/hls-postgres-tls"
mkdir -p "$TLS_DIR"
chmod 700 "$TLS_DIR"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -sha256 \
  -subj '/CN=HealthyLifeStyles disposable CI CA' \
  -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  -keyout "$TLS_DIR/ca.key" -out "$TLS_DIR/ca.crt" 2>/dev/null
openssl req -newkey rsa:2048 -nodes -sha256 -subj '/CN=neon-ci.example.invalid' \
  -keyout "$TLS_DIR/server.key" -out "$TLS_DIR/server.csr" 2>/dev/null
printf '%s\n' 'basicConstraints=critical,CA:FALSE' 'extendedKeyUsage=serverAuth' \
  'subjectAltName=DNS:neon-ci.example.invalid,DNS:localhost,IP:127.0.0.1' > "$TLS_DIR/server.ext"
openssl x509 -req -in "$TLS_DIR/server.csr" -CA "$TLS_DIR/ca.crt" -CAkey "$TLS_DIR/ca.key" \
  -CAcreateserial -days 2 -sha256 -extfile "$TLS_DIR/server.ext" -out "$TLS_DIR/server.crt" 2>/dev/null
cp "$TLS_DIR/server.key" /tmp/hls-ci-server.key
cp "$TLS_DIR/server.crt" /tmp/hls-ci-server.crt
chown postgres:postgres /tmp/hls-ci-server.key /tmp/hls-ci-server.crt
chmod 600 /tmp/hls-ci-server.key
# PostgreSQL accepts ALTER SYSTEM only outside a SQL transaction.
for setting in "ssl_cert_file = '/tmp/hls-ci-server.crt'" "ssl_key_file = '/tmp/hls-ci-server.key'" 'ssl = on'; do
  gosu postgres psql -X -v ON_ERROR_STOP=1 -U mock -d mock -c "ALTER SYSTEM SET $setting" >/dev/null
done
gosu postgres psql -X -v ON_ERROR_STOP=1 -U mock -d mock -c 'SELECT pg_reload_conf()' >/dev/null
# No public DNS queries: a test-only TLS hostname resolves strictly to local loopback.
printf '127.0.0.1 neon-ci.example.invalid mismatched-ci.example.invalid\n' >> /etc/hosts
export CI_POSTGRES_CA_FILE="$TLS_DIR/ca.crt" CI_POSTGRES_TLS_READY=1
export DATABASE_CA_CERT="$(cat "$TLS_DIR/ca.crt")"
echo 'PASS: disposable local TLS fixture active (certificate and key stay outside repo)'
