import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 65536;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function checkedNames(values, label) {
  if (!Array.isArray(values) || values.length > 1000) {
    throw new TypeError(label + ' must be an array of at most 1000 migration names');
  }
  const names = values.map((item) => {
    const value = typeof item === 'string' ? item :
      item && typeof item === 'object' && !Array.isArray(item) &&
      Object.keys(item).length === 1 && typeof item.name === 'string' ? item.name : null;
    if (!value || !NAME.test(value)) throw new TypeError(label + ' has invalid migration names');
    return value;
  });
  if (new Set(names).size !== names.length) {
    throw new TypeError(label + ' includes duplicate migration names');
  }
  return names;
}

/** Read only the migration index. Never import or execute migrations. */
export function migrationNamesFromIndex(source) {
  if (typeof source !== 'string' || source.length > 131072) {
    throw new TypeError('Expected bounded migration index source');
  }
  const re = /\bname:\s*['"]([A-Za-z0-9_-]+)['"]/g;
  const values = [...source.matchAll(re)].map((m) => m[1]);
  if (values.length === 0) throw new Error('No registered Payload migrations found');
  return checkedNames(values, 'registered');
}

/** Pure comparison. A pending migration is NEVER classified safe automatically. */
export function auditMigrationLedger(registered, applied) {
  const expected = checkedNames(registered, 'registered');
  const recorded = checkedNames(applied, 'applied');
  const a = new Set(expected), b = new Set(recorded);
  const unrecorded = expected.filter((name) => !b.has(name));
  const notRegistered = recorded.filter((name) => !a.has(name));
  return {
    kind: 'read-only-payload-migration-ledger-audit',
    status: unrecorded.length || notRegistered.length ? 'REVIEW_REQUIRED' : 'MATCH',
    registeredCount: expected.length,
    appliedCount: recorded.length,
    registeredButNotApplied: unrecorded,
    appliedButNotRegistered: notRegistered,
    migrationExecutionAuthorized: false,
    note: 'A ledger match does not prove schema/data equivalence or successful restore; this utility performs no database operations.',
  };
}
export function parseAppliedLedger(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_BYTES) {
    throw new TypeError('Ledger JSON must be bounded to 64 KiB');
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('Malformed ledger JSON'); }
  if (parsed && !Array.isArray(parsed) && typeof parsed === 'object' &&
      Object.keys(parsed).length === 1 && Array.isArray(parsed.appliedMigrations)) {
    parsed = parsed.appliedMigrations;
  }
  return checkedNames(parsed, 'applied');
}
function readBounded(path, limit) {
  const data = readFileSync(path);
  if (data.byteLength > limit) throw new Error('Input exceeds limit');
  return data.toString('utf8');
}
function main(argv) {
  if (argv.length !== 4 || argv[2] !== '--applied-file') {
    throw new Error('Usage: node scripts/ci/migration-ledger-audit.mjs --applied-file /path/to/names.json');
  }
  const registered = migrationNamesFromIndex(readBounded(
    resolve('src/migrations/index.ts'), 131072));
  const applied = parseAppliedLedger(readBounded(resolve(argv[3]), MAX_BYTES));
  const result = auditMigrationLedger(registered, applied);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.status !== 'MATCH') process.exitCode = 2;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv); }
  catch (error) { console.error('LEDGER AUDIT NO-GO: ' + error.message); process.exitCode = 1; }
}
