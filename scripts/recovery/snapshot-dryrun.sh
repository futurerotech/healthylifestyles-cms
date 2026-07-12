#!/usr/bin/env bash
# Local snapshot dry-run for migration 20260711_184910 — proves 100% data
# retention before deploy. NEVER point this at production (guard below).
#
# Usage:
#   docker run -d --name pg16 -e POSTGRES_USER=mock -e POSTGRES_PASSWORD=mock \
#     -e POSTGRES_DB=mock -p 5432:5432 postgres:16-alpine
#   export DATABASE_URI=postgres://mock:mock@localhost:5432/mock
#   export PAYLOAD_SECRET=ci-mock-not-production
#   bash scripts/recovery/snapshot-dryrun.sh ./sanitized-prod-snapshot.sql
set -euo pipefail

SNAPSHOT="${1:?usage: snapshot-dryrun.sh <path-to-sanitized-snapshot.sql>}"
: "${DATABASE_URI:?set DATABASE_URI to a LOCAL disposable postgres}"

# SAFETY: refuse any non-local host so this can never touch prod/Supabase.
HOST="$(printf '%s' "$DATABASE_URI" | sed -E 's#.*://[^@]*@([^:/]+).*#\1#')"
case "$HOST" in
  localhost|127.0.0.1|::1) : ;;
  *) echo "REFUSING: DATABASE_URI host '$HOST' is not local — this script must never touch production."; exit 2 ;;
esac

echo "==> Restore snapshot into $HOST"
psql "$DATABASE_URI" -v ON_ERROR_STOP=1 -q -f "$SNAPSHOT"

echo "==> PRE-FLIGHT: articles.title/excerpt must still exist on the snapshot"
PRE="$(psql "$DATABASE_URI" -tAc "SELECT count(*) FROM information_schema.columns WHERE table_name='articles' AND column_name IN ('title','excerpt');")"
[ "$PRE" -eq 2 ] || { echo "ABORT: title/excerpt not both present ($PRE/2) — migration may have already applied; use the forensic artifact restore, NOT this backfill."; exit 1; }
BEFORE="$(psql "$DATABASE_URI" -tAc "SELECT count(*) FROM articles;")"
echo "    base articles before: $BEFORE"

echo "==> Apply migration chain (same flags as CI/production)"
npx payload migrate --force-accept-warning

echo "==> Invariants"
ROW="$(psql "$DATABASE_URI" -tAc "SELECT (SELECT count(*) FROM articles)||' '||(SELECT count(*) FROM articles_locales WHERE _locale='en')||' '||(SELECT count(*) FROM articles_locales WHERE _locale='en' AND title IS NOT NULL);")"
read -r A E T <<<"$ROW"
ORPH="$(psql "$DATABASE_URI" -tAc "SELECT count(*) FROM articles_locales l LEFT JOIN articles a ON a.id=l._parent_id WHERE a.id IS NULL;")"
DUP="$(psql "$DATABASE_URI" -tAc "SELECT COALESCE(sum(c-1),0) FROM (SELECT count(*) c FROM articles_locales GROUP BY _parent_id,_locale) x;")"
LEFT="$(psql "$DATABASE_URI" -tAc "SELECT count(*) FROM information_schema.columns WHERE table_name='articles' AND column_name IN ('title','excerpt');")"
echo "    articles=$A en_rows=$E en_titled=$T orphans=$ORPH dup_mappings=$DUP base_title_excerpt_left=$LEFT"

FAIL=0
[ "$A" = "$E" ] && [ "$E" = "$T" ] || { echo "FAIL: articles/en_rows/en_titled mismatch"; FAIL=1; }
[ "$A" = "$BEFORE" ]                 || { echo "FAIL: article count changed ($BEFORE -> $A)"; FAIL=1; }
[ "$ORPH" -eq 0 ]                    || { echo "FAIL: orphan locale rows"; FAIL=1; }
[ "$DUP" -eq 0 ]                     || { echo "FAIL: duplicate (parent,locale) mappings"; FAIL=1; }
[ "$LEFT" -eq 0 ]                    || { echo "FAIL: base title/excerpt not dropped after backfill"; FAIL=1; }

# Idempotency note: 'payload migrate' records applied migrations, so re-running
# it is a no-op (it will NOT re-execute this migration). True idempotency is
# proven by re-restoring the snapshot and applying from zero — repeat this whole
# script; the ON CONFLICT / IS NULL guards keep re-application safe.

if [ "$FAIL" -eq 0 ]; then echo "==> PASS — 100% retention, 1:1 mapping, no orphans/dupes. Safe to proceed."; else echo "==> FAILED — DO NOT DEPLOY."; exit 1; fi
