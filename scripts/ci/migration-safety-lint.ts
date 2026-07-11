/**
 * CI guard — blocks the exact footgun behind the Phase-15 title/excerpt loss:
 * a migration that LOCALIZES a field (creates a `*_locales` table AND drops the
 * base column) WITHOUT first copying the data (INSERT INTO <t>_locales … SELECT).
 * Such a migration silently destroys the pre-localization values.
 *
 * Static (no DB). Fails CI on any NEW offender; the already-deployed incident
 * migration is allowlisted (it cannot be un-run and was remediated via forensic
 * recovery) so the gate protects the future without breaking existing history.
 *
 * Usage: node scripts/ci/migration-safety-lint.ts   (exit 0 pass, 1 fail)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(process.cwd(), 'src/migrations');

/** Known, already-applied incident migration (20260711_184910) — remediated. */
const ALLOWLIST = new Set<string>(['20260711_184910.ts']);

function offends(sqlText: string): boolean {
  const createsLocales = /CREATE TABLE "[a-z0-9_]+_locales"/i.test(sqlText);
  const dropsBaseColumn = /ALTER TABLE "[a-z0-9_]+"\s+DROP COLUMN/i.test(sqlText);
  const copiesData = /INSERT INTO "[a-z0-9_]+_locales"[\s\S]*?SELECT/i.test(sqlText);
  return createsLocales && dropsBaseColumn && !copiesData;
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
const offenders = files.filter((f) => !ALLOWLIST.has(f) && offends(readFileSync(resolve(DIR, f), 'utf8')));

if (offenders.length) {
  console.error('migration-safety-lint: FAIL — localization migration(s) drop base columns without backfilling _locales (data-loss risk):');
  for (const f of offenders) {
    console.error(`  ✗ ${f} — copy data first: INSERT INTO <table>_locales (_locale,_parent_id,<cols>) SELECT 'en', id, <cols> FROM <table>; THEN drop.`);
  }
  process.exit(1);
}
console.log(`migration-safety-lint: PASS — ${files.length} migrations scanned, no un-backfilled localization drop (${ALLOWLIST.size} allowlisted).`);
