#!/usr/bin/env bash
set -euo pipefail

# Global roles + database backup/restore across two independent throwaway PG clusters.
# Only GitHub Actions' exact mock service is a valid source; no provider credentials.
hold() { printf '%s\n' "GLOBAL_ROLES_RESTORE_HOLD: $1" >&2; exit 1; }
[[ "${GITHUB_ACTIONS:-}" == 'true' && "${CI:-}" == 'true' && "${RUN_DATABASE_TESTS:-}" == '1' ]] || hold 'CI_ONLY'
[[ "${GITHUB_REPOSITORY:-}" == 'futurerotech/healthylifestyles-cms' ]] || hold 'REPOSITORY_MISMATCH'
[[ "${DATABASE_URI:-}" == 'postgres://mock:mock@localhost:5432/mock' ]] || hold 'DATABASE_NOT_MOCK'
[[ "${POSTGRES_CONTAINER:-}" =~ ^[0-9a-f]{64}$ ]] || hold 'SOURCE_CONTAINER_ID_INVALID'
[[ -n "${RUNNER_TEMP:-}" && -d "$RUNNER_TEMP" ]] || hold 'NO_RUNNER_TEMP'
[[ -z "${DOCKER_HOST:-}" && -z "${DOCKER_CONTEXT:-}" ]] || hold 'REMOTE_DOCKER_FORBIDDEN'
command -v docker >/dev/null || hold 'DOCKER_UNAVAILABLE'

IMAGE="$(docker inspect --format '{{.Config.Image}}' "$POSTGRES_CONTAINER")" || hold 'SOURCE_NOT_RUNNING'
case "$IMAGE" in
  postgres:16-alpine|postgres:18-alpine) ;;
  *) hold 'SOURCE_IMAGE_NOT_APPROVED' ;;
esac

identity="$(docker exec "$POSTGRES_CONTAINER" psql -XqAt -v ON_ERROR_STOP=1 -U mock -d mock -c "SELECT CASE WHEN current_database()='mock' AND session_user='mock' AND (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) AND (SELECT count(*) FROM pg_catalog.pg_class WHERE relname='hls_ci_owner_acl_probe')=1 AND NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname='hls_ci_global_group') THEN 'MOCK_PASS' ELSE 'HOLD' END")" || hold 'SOURCE_IDENTITY_QUERY_FAILED'
[[ "$identity" == 'MOCK_PASS' ]] || hold 'SOURCE_IDENTITY_FAILED'

umask 077
work="$(mktemp -d "$RUNNER_TEMP/hls-cluster-globals-XXXXXXXX")" || hold 'TEMP_DIRECTORY_FAILED'
target="hls-ci-globals-restore-${GITHUB_RUN_ID:-0}-${RANDOM}"
cleanup() {
  docker rm -f "$target" >/dev/null 2>&1 || true
  rm -rf -- "$work"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

docker exec -i "$POSTGRES_CONTAINER" psql -Xq -v ON_ERROR_STOP=1 -U mock -d mock <<'SQL' >/dev/null
CREATE ROLE hls_ci_global_group NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT hls_ci_global_group TO hls_ci_restore_reader;
SQL

# Never print or upload the global-role dump; it includes only mock-role secrets.
docker exec "$POSTGRES_CONTAINER" pg_dumpall --globals-only -U mock > "$work/globals.sql"
docker exec "$POSTGRES_CONTAINER" pg_dump -Fc -U mock -d mock > "$work/database.dump"
[[ -s "$work/globals.sql" && -s "$work/database.dump" ]] || hold 'DUMP_EMPTY'

# Fresh PostgreSQL cluster, same major/image, no network or forwarded ports.
docker run --pull=never --rm -d --network none --name "$target" \
  -e POSTGRES_USER=hls_ci_bootstrap \
  -e POSTGRES_PASSWORD=synthetic-ci-only \
  -e POSTGRES_DB=hls_ci_bootstrap "$IMAGE" >/dev/null || hold 'NEW_CLUSTER_FAILED'
ready=0
for _ in $(seq 1 45); do
  if [[ "$(docker exec "$target" psql -XqAt -v ON_ERROR_STOP=1 -U hls_ci_bootstrap -d hls_ci_bootstrap -c 'SELECT 1' 2>/dev/null || true)" == '1' ]]; then
    ready=1; break
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || hold 'NEW_CLUSTER_NOT_READY'

preexisting="$(docker exec "$target" psql -XqAt -v ON_ERROR_STOP=1 -U hls_ci_bootstrap -d hls_ci_bootstrap -c "SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('mock','hls_ci_restore_owner','hls_ci_restore_reader','hls_ci_global_group')")" || hold 'NEW_CLUSTER_IDENTITY_QUERY_FAILED'
[[ "$preexisting" == 0 ]] || hold 'NEW_CLUSTER_NOT_ISOLATED'

# pg_dumpall emits role definitions plus membership GRANT ... GRANTED BY the
# original mock superuser. The bootstrap superuser cannot always act as that
# named grantor (PG16). Split only these exact *mock* role GRANT statements,
# then apply those unmodified statements as the restored mock role.
grants="$(grep -cE '^[[:space:]]*GRANT[[:space:]]' "$work/globals.sql" || true)"
[[ "$grants" == 1 ]] || hold 'UNEXPECTED_GLOBAL_GRANT_SHAPE'
grep -Eq '^GRANT .*hls_ci_global_group.* TO .*hls_ci_restore_reader' "$work/globals.sql" || hold 'EXPECTED_MOCK_MEMBERSHIP_MISSING'
awk -v defs="$work/global-definitions.sql" -v members="$work/global-memberships.sql" \
  '/^[[:space:]]*GRANT[[:space:]]/ {print >> members; next} {print >> defs}' "$work/globals.sql"
[[ -s "$work/global-definitions.sql" && -s "$work/global-memberships.sql" ]] || hold 'SPLIT_GLOBALS_EMPTY'
docker exec -i "$target" psql -Xq -v ON_ERROR_STOP=1 -U hls_ci_bootstrap -d hls_ci_bootstrap < "$work/global-definitions.sql" >/dev/null || hold 'GLOBAL_ROLE_DEFINITIONS_RESTORE_FAILED'
mock_admin="$(docker exec "$target" psql -XqAt -v ON_ERROR_STOP=1 -U hls_ci_bootstrap -d hls_ci_bootstrap -c "SELECT CASE WHEN rolsuper AND rolcanlogin THEN 'MOCK_SUPERUSER_PASS' ELSE 'HOLD' END FROM pg_catalog.pg_roles WHERE rolname='mock'")" || hold 'RESTORED_MOCK_ROLE_QUERY_FAILED'
[[ "$mock_admin" == 'MOCK_SUPERUSER_PASS' ]] || hold 'RESTORED_MOCK_ROLE_INVALID'
# pg_dumpall specifies GRANTED BY mock. PostgreSQL may reject that
# explicit grantor on a newly initialized cluster without ADMIN membership.
# Reissue the sole checked grant AS the original restored mock superuser;
# this preserves the effective grantor, verified from pg_auth_members below.
grep -Eq 'GRANTED BY' "$work/global-memberships.sql" || hold 'EXPECTED_GRANTOR_MISSING'
sed -E 's/ GRANTED BY "?mock"?;$/;/' "$work/global-memberships.sql" > "$work/global-memberships-replay.sql"
if cmp -s "$work/global-memberships.sql" "$work/global-memberships-replay.sql"; then hold 'MEMBERSHIP_REWRITE_NOT_APPLIED'; fi
if grep -q 'GRANTED BY' "$work/global-memberships-replay.sql"; then hold 'UNEXPECTED_REPLAY_GRANTOR'; fi
docker exec -i "$target" psql -Xq -v ON_ERROR_STOP=1 -U mock -d postgres < "$work/global-memberships-replay.sql" >/dev/null || hold 'GLOBAL_ROLE_MEMBERSHIPS_RESTORE_FAILED'
docker exec "$target" createdb -U hls_ci_bootstrap -O mock mock || hold 'NEW_DATABASE_FAILED'
# Intentionally preserves owner and ACL (no --no-owner / --no-acl).
docker exec -i "$target" pg_restore -U hls_ci_bootstrap -d mock --exit-on-error < "$work/database.dump" >/dev/null || hold 'DATABASE_RESTORE_FAILED'

# Compare global role flags, memberships, all public relation owners/ACL/RLS
# states and policies, public schema grants, and synthetic data fingerprints.
snapshot() {
  docker exec -i "$1" psql -XqAt -v ON_ERROR_STOP=1 -U mock -d mock <<'SQL'
WITH roles AS (
 SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
        rolcanlogin, rolreplication, rolbypassrls, rolconnlimit
 FROM pg_catalog.pg_roles
 WHERE rolname IN ('mock','hls_ci_restore_owner','hls_ci_restore_reader','hls_ci_global_group')
), memberships AS (
 SELECT member.rolname AS member_name, granted.rolname AS role_name,
        pg_catalog.pg_get_userbyid(m.grantor) AS grantor_name,
        m.admin_option, m.inherit_option, m.set_option
 FROM pg_catalog.pg_auth_members m
 JOIN pg_catalog.pg_roles member ON member.oid=m.member
 JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
 WHERE member.rolname IN ('hls_ci_restore_owner','hls_ci_restore_reader','hls_ci_global_group')
), relations AS (
 SELECT c.relname AS name, c.relkind AS kind,
        pg_catalog.pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl,
        c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
), policies AS (
 SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
 FROM pg_catalog.pg_policies WHERE schemaname='public'
)
SELECT jsonb_build_object(
 'roles', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.rolname) FROM roles r),
 'memberships', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.member_name,m.role_name) FROM memberships m),
 'relations', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.name,t.kind) FROM relations t),
 'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname) FROM policies p),
 'public_schema_acl', (SELECT nspacl::text FROM pg_catalog.pg_namespace WHERE nspname='public'),
 'fixture_rows', (SELECT jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(id::text||':'||marker,'|' ORDER BY id),'')))
                  FROM public.hls_ci_owner_acl_probe)
)::text;
SQL
}
snapshot "$POSTGRES_CONTAINER" > "$work/source.snapshot" || hold 'SOURCE_SNAPSHOT_FAILED'
snapshot "$target" > "$work/target.snapshot" || hold 'TARGET_SNAPSHOT_FAILED'
[[ -s "$work/source.snapshot" && -s "$work/target.snapshot" ]] || hold 'SNAPSHOT_EMPTY'
if ! cmp -s "$work/source.snapshot" "$work/target.snapshot"; then
  node - "$work/source.snapshot" "$work/target.snapshot" <<'NODE'
const fs = require('node:fs')
const [a,b] = process.argv.slice(2).map(p => JSON.parse(fs.readFileSync(p,'utf8')))
for (const key of Object.keys(a)) {
  if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
    console.error('GLOBAL_RESTORE_DIFF_SECTION=' + key)
    if (Array.isArray(a[key]) && Array.isArray(b[key])) {
      console.error('GLOBAL_RESTORE_DIFF_COUNTS=' + key + ':' + a[key].length + ':' + b[key].length)
      for (let i = 0; i < Math.max(a[key].length,b[key].length); i++) {
        if (JSON.stringify(a[key][i]) !== JSON.stringify(b[key][i])) {
          console.error('GLOBAL_RESTORE_FIRST_DIFFERENCE=' + key + ':' + (a[key][i]?.name || a[key][i]?.tablename || i))
          break
        }
      }
    }
  }
}
NODE
  hold 'GLOBAL_OR_DATABASE_METADATA_MISMATCH'
fi

# Actual non-bypass role can still see exactly the single policy-permitted row.
for container in "$POSTGRES_CONTAINER" "$target"; do
  visible="$(docker exec -i "$container" psql -XqAt -v ON_ERROR_STOP=1 -U mock -d mock <<'SQL'
BEGIN READ ONLY;
SET LOCAL ROLE hls_ci_restore_reader;
SELECT CASE WHEN current_user='hls_ci_restore_reader'
 AND pg_catalog.row_security_active('public.hls_ci_owner_acl_probe'::regclass)
 AND has_schema_privilege(current_user,'public','USAGE')
 AND has_table_privilege(current_user,'public.hls_ci_owner_acl_probe','SELECT')
 AND NOT has_table_privilege(current_user,'public.hls_ci_owner_acl_probe','INSERT')
 AND (SELECT count(*) FROM public.hls_ci_owner_acl_probe)=1
 AND (SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user)
 AND pg_has_role('hls_ci_restore_reader','hls_ci_global_group','MEMBER')
 THEN 'RESTRICTED_ROLE_PASS' ELSE 'HOLD' END;
ROLLBACK;
SQL
)" || hold 'RESTRICTED_ROLE_QUERY_FAILED'
  [[ "$visible" == 'RESTRICTED_ROLE_PASS' ]] || hold 'RESTRICTED_ROLE_ACCESS_CHANGED'
done

echo 'GLOBAL_ROLES_FRESH_CLUSTER_RESTORE_PASS: pg_dumpall globals and database restored to network-disabled independent PostgreSQL cluster'
echo 'GLOBAL_ROLES_RLS_ACL_RESTORE_PASS: role membership, ownership, grants, policies, and restricted-row visibility preserved'
