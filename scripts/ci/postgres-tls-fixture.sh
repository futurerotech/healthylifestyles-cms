#!/usr/bin/env bash
set -euo pipefail
# Only the Actions-owned disposable postgres service may be reconfigured.
[[ "${GITHUB_ACTIONS:-}" == 'true' && "${RUN_DATABASE_TESTS:-}" == '1' ]] || exit 1
[[ "${POSTGRES_CONTAINER:-}" =~ ^[a-f0-9]{64}$ ]] || exit 1
[[ "$(docker exec "$POSTGRES_CONTAINER" psql -U mock -d mock -Atc 'SELECT current_database()')" == 'mock' ]] || exit 1
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
docker cp "$TLS_DIR/server.key" "$POSTGRES_CONTAINER:/tmp/hls-ci-server.key"
docker cp "$TLS_DIR/server.crt" "$POSTGRES_CONTAINER:/tmp/hls-ci-server.crt"
docker exec "$POSTGRES_CONTAINER" chown postgres:postgres /tmp/hls-ci-server.key /tmp/hls-ci-server.crt
docker exec "$POSTGRES_CONTAINER" chmod 600 /tmp/hls-ci-server.key
for setting in "ssl_cert_file = '/tmp/hls-ci-server.crt'" "ssl_key_file = '/tmp/hls-ci-server.key'" 'ssl = on'; do
  docker exec "$POSTGRES_CONTAINER" psql -v ON_ERROR_STOP=1 -U mock -d mock -c "ALTER SYSTEM SET $setting"
done
docker exec "$POSTGRES_CONTAINER" psql -v ON_ERROR_STOP=1 -U mock -d mock -c 'SELECT pg_reload_conf()'
# Reserved, nonexistent domains resolve ONLY inside this ephemeral CI runner.
# This exercises actual pg hostname verification without contacting Neon.
printf '127.0.0.1 neon-ci.example.invalid mismatched-ci.example.invalid\n' | sudo tee -a /etc/hosts >/dev/null
echo "CI_POSTGRES_CA_FILE=$TLS_DIR/ca.crt" >> "$GITHUB_ENV"
echo 'CI_POSTGRES_TLS_READY=1' >> "$GITHUB_ENV"
echo 'Disposable PostgreSQL TLS fixture configured; generated private keys stay outside the repository.'
