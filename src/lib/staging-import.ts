/**
 * Isolated staging mirror IMPORTER (prepared; never run against a real database without
 * separate owner authorization and proven Hostinger/Neon/R2 isolation).
 *
 * Input is the bundle from the frontend's `scripts/content/staging-bootstrap-export.mjs`:
 * published public content only, with its IDs and relations. The importer:
 * - refuses to run unless the runtime is the isolated staging CMS (or the CI disposable
 *   mock database), and refuses any production database host;
 * - imports only allowlisted collections, in dependency order, keeping the original IDs.
 *   It turns on `allowIDOnCreate` for this process only;
 * - turns populated relations into IDs and keeps block rows intact;
 * - never imports globals, so no production webhook, email, push or indexing settings are
 *   copied. Staging keeps its own safe defaults;
 * - enforces its runtime guard and the full bundle validation inside importBundle itself,
 *   before any query (denied paths write nothing);
 * - runs content inserts AND sequence reconciliation in ONE transaction. A failure before
 *   commit rolls back everything. A failure after commit (verification) throws
 *   ImportCommittedError with the exact report, and cleanupImport removes exactly that;
 * - is idempotent: an existing record with the same ID and the same content is skipped,
 *   and an existing record with different content is a conflict that aborts the import;
 * - writes a signed creation journal in the same database transaction. cleanupImport(importId)
 *   is independently guarded and locked; it deletes only journaled, unchanged records, all or
 *   nothing, and never touches skipped or pre-existing records.
 * Hooks see context { reseedVersions, stagingImport }. The existing maintenance flag
 * already disables the publish gate and indexing hooks, and isolated-staging mode disables
 * the queue and push.
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { sql } from '@payloadcms/db-postgres';

export const IMPORT_ORDER = ['categories', 'authors', 'tags', 'media', 'tools', 'articles', 'pages', 'pseo-pages', 'redirects'] as const;
export type ImportCollection = (typeof IMPORT_ORDER)[number];
const ALLOWED = new Set<string>(IMPORT_ORDER);
/** Generated or server-owned fields that must not be copied. */
const DROP_TOP = new Set(['createdAt', 'updatedAt', '_status', 'url', 'thumbnailURL', 'sizes', 'prefix']);
export const PRODUCTION_DB_HOST_FRAGMENT = 'ep-lucky-voice-ad5egz8d';

export interface Bundle { version: number; sourceOrigin: string; collections: Record<string, any[]>; globals?: Record<string, unknown>; checksums?: Record<string, string> }
export interface JournalEntry { collection: string; id: string | number; checksum: string }
/**
 * Signed creation journal for one import invocation. It is stored in hls_staging_import_journal
 * in the SAME transaction as the content (see the design note above importBundle). It lists
 * only records this import created, each with the checksum of the record as stored.
 */
export interface ImportJournal { version: 1; importId: string; targetHost: string; dbIdentity?: string; databaseName?: string; startedAt: string; finishedAt: string; created: JournalEntry[]; signature: string }
export interface ImportReport { created: { collection: string; id: string | number }[]; skipped: { collection: string; id: string | number }[]; checksums: Record<string, string>; journal?: ImportJournal }

/** Canonical JSON with sorted keys, so checksums do not depend on key order. */
const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as any)[k])])) : v;
export const checksum = (v: unknown) => createHash('sha256').update(JSON.stringify(canon(v))).digest('hex');

/** A populated Payload document (relation) has an id and a createdAt; block/array rows do not. */
const isPopulatedDoc = (v: any) => v && typeof v === 'object' && !Array.isArray(v) && v.id !== undefined && typeof v.createdAt === 'string';

/** Turn populated relations into IDs, recursively. Block and array rows keep their own ids. */
export function toWritable(doc: Record<string, any>): Record<string, any> {
  const walk = (v: any): any => Array.isArray(v) ? v.map(walk)
    : isPopulatedDoc(v) ? v.id
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc)) if (!DROP_TOP.has(k)) out[k] = walk(v);
  return out;
}

/** The comparable content of a record (for idempotency and post-import verification). */
export const comparable = (doc: Record<string, any>) => { const w = toWritable(doc); delete w.id; return w; };

/**
 * True when every value in `want` (the exported record) is present and equal in `got` (the
 * stored record). The stored record may hold extra server defaults, such as null optional
 * fields or generated row ids, so the comparison is a deep subset, never a weaker check of
 * the exported values themselves.
 */
export function subsetEqual(want: unknown, got: unknown): boolean {
  if (Array.isArray(want)) return Array.isArray(got) && got.length === want.length && want.every((w, i) => subsetEqual(w, got[i]));
  if (want && typeof want === 'object') return !!got && typeof got === 'object' && Object.entries(want).every(([k, v]) => subsetEqual(v, (got as any)[k]));
  return want === got || (want === null && got === undefined);
}

export interface RuntimeIdentity { env: NodeJS.ProcessEnv }
/** Throws unless this process is the isolated staging CMS or the CI disposable mock DB. */
export function assertImportRuntime({ env }: RuntimeIdentity): void {
  const uri = env.DATABASE_URI || '';
  if (uri.includes(PRODUCTION_DB_HOST_FRAGMENT)) throw new Error('Refusing: DATABASE_URI points at the production Neon compute.');
  const ciMock = env.GITHUB_ACTIONS === 'true' && env.RUN_DATABASE_TESTS === '1' && uri === 'postgres://mock:mock@localhost:5432/mock';
  if (ciMock) return;
  if (env.HLS_ISOLATED_STAGING !== 'true') throw new Error('Refusing: HLS_ISOLATED_STAGING=true is required.');
  if (env.HLS_STAGING_IMPORT_APPROVED !== 'yes') throw new Error('Refusing: owner approval flag HLS_STAGING_IMPORT_APPROVED=yes is required.');
  const host = (() => { try { return new URL(uri).hostname; } catch { return ''; } })();
  const staging = (env.HLS_STAGING_DB_HOST || '').trim();
  if (!staging || host.replace(/-pooler(?=\.)/, '') !== staging.replace(/-pooler(?=\.)/, '')) throw new Error('Refusing: DATABASE_URI host is not the declared staging host.');
  for (const k of ['INDEXNOW_API_KEY', 'GOOGLE_INDEXING_CREDENTIALS', 'VERCEL_DEPLOY_HOOK_URL']) if (env[k]) throw new Error(`Refusing: ${k} must not be set in staging.`);
}

/** Production public CMS: the only allowed bundle source. */
export const ALLOWED_SOURCE_ORIGINS = ['https://cms.healthylifesstyles.com'];
const BUNDLE_KEYS = new Set(['version', 'sourceOrigin', 'capturedAt', 'scope', 'collections', 'globals', 'checksums', 'dropped', 'findings', 'counts']);
const SECRET_KEY = /(secret|token|password|passwd|api[-_]?key|apikey|private[-_]?key|privatekey|webhook|vapid|credentials|auth(?!or))/i;
/** The 16 coupled article records a release mirror must contain (RELEASE_PROCEDURE §6). */
export const RELEASE_ARTICLE_IDS = [5, 7, 8, 10, 21, 25, 27, 28, 29, 32, 37, 46, 56, 57, 58, 69];

/**
 * Validate a bundle completely before any database I/O. Rejected: wrong version, source or
 * scope; unknown top-level keys; non-allowlisted collections; a record whose recomputed
 * canonical checksum differs from the export (tampering); a checksum with no record, or a
 * record with no checksum; duplicate or missing IDs; secret-looking keys anywhere; unreviewed
 * sensitive-value findings; missing required articles.
 */
export function validateBundle(bundle: Bundle, { requiredArticleIds = RELEASE_ARTICLE_IDS }: { requiredArticleIds?: readonly number[] } = {}): void {
  if (!bundle || typeof bundle !== 'object' || bundle.version !== 1 || typeof bundle.collections !== 'object' || !bundle.collections) throw new Error('Invalid bundle.');
  for (const k of Object.keys(bundle)) if (!BUNDLE_KEYS.has(k)) throw new Error(`Unauthorized bundle field: ${k}`);
  if (!ALLOWED_SOURCE_ORIGINS.includes(bundle.sourceOrigin)) throw new Error('Bundle source origin is not the allowlisted production public CMS.');
  if ((bundle as any).scope !== 'published public content only') throw new Error('Bundle scope must be published public content only.');
  if (Array.isArray((bundle as any).findings) && (bundle as any).findings.length) throw new Error('Bundle has unreviewed sensitive-value findings.');
  const checksums = bundle.checksums || {};
  const seen = new Set<string>();
  for (const [c, docs] of Object.entries(bundle.collections)) {
    if (!ALLOWED.has(c)) throw new Error(`Collection not allowed: ${c}`);
    if (!Array.isArray(docs)) throw new Error(`${c}: not a list`);
    const ids = new Set<string>();
    for (const d of docs) {
      if (d?.id === undefined || d.id === null) throw new Error(`${c}: record without id`);
      if (ids.has(String(d.id))) throw new Error(`${c}: duplicate id ${d.id}`);
      ids.add(String(d.id));
      const key = `${c}:${d.id}`;
      seen.add(key);
      if (checksums[key] === undefined) throw new Error(`${key} has no export checksum`);
      if (checksums[key] !== checksum(d)) throw new Error(`${key} does not match its export checksum (tampered or re-serialized)`);
      const secret = findSecretKey(d);
      if (secret) throw new Error(`${key} contains a secret-looking field: ${secret}`);
    }
  }
  for (const key of Object.keys(checksums)) if (!key.startsWith('global:') && !seen.has(key)) throw new Error(`Checksum without a record: ${key}`);
  const articleIds = new Set((bundle.collections.articles || []).map((a) => Number(a.id)));
  const missing = requiredArticleIds.filter((id) => !articleIds.has(id));
  if (missing.length) throw new Error(`Bundle is missing required article records: ${missing.join(', ')}`);
}

function findSecretKey(v: unknown, path = ''): string | null {
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const r = findSecretKey(v[i], `${path}[${i}]`); if (r) return r; } return null; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
    const p = path ? `${path}.${k}` : k;
    if (SECRET_KEY.test(k)) return p;
    const r = findSecretKey(x, p); if (r) return r;
  }
  return null;
}

type PayloadLike = any;

/** The connection string the Payload adapter actually uses (never logged). */
function connectedUri(payload: PayloadLike): string | null {
  return payload?.db?.poolOptions?.connectionString ?? payload?.db?.pool?.options?.connectionString ?? null;
}

/** Signing key for creation journals (staging-only secret, at least 32 characters). */
function journalKey(env: NodeJS.ProcessEnv): string {
  const k = env.HLS_STAGING_IMPORT_JOURNAL_KEY?.trim();
  if (!k || k.length < 32) throw new Error('Refusing: HLS_STAGING_IMPORT_JOURNAL_KEY (at least 32 characters) is required.');
  return k;
}
export const signJournal = (j: Omit<ImportJournal, 'signature'>, key: string) => createHmac('sha256', key).update(JSON.stringify(canon(j))).digest('hex');
const connectedHost = (payload: PayloadLike) => { try { return new URL(connectedUri(payload) || '').hostname.replace(/-pooler(?=\.)/, ''); } catch { return ''; } };

/**
 * Runtime gate for the import ENTRYPOINT. It checks the environment AND the database the
 * Payload adapter is actually connected to, before any query, flag change or transaction.
 */
export function assertImportTarget(payload: PayloadLike, env: NodeJS.ProcessEnv): void {
  assertImportRuntime({ env });
  const actual = connectedUri(payload);
  if (!actual) throw new Error('Refusing: cannot determine the connected database.');
  if (actual.includes(PRODUCTION_DB_HOST_FRAGMENT)) throw new Error('Refusing: the connected database is the production Neon compute.');
  const host = (u: string) => { try { return new URL(u).hostname.replace(/-pooler(?=\.)/, ''); } catch { return ''; } };
  if (!host(actual) || host(actual) !== host(env.DATABASE_URI || '')) throw new Error('Refusing: the connected database differs from the declared DATABASE_URI.');
}

export interface ImportOptions {
  env?: NodeJS.ProcessEnv;
  requiredArticleIds?: readonly number[];
  /** Test hooks: "<collection>:<id>", "sequences", "journal", "before-commit" or "after-commit". */
  failAt?: string;
}
export class ImportCommittedError extends Error {
  constructor(message: string, public report: ImportReport) { super(message); }
}

/*
 * DURABLE JOURNAL — design (review of 2026-11-15):
 * The receipt lives IN THE SAME isolated staging PostgreSQL database as the imported content,
 * in table hls_staging_import_journal, written inside the SAME transaction as the content.
 * PostgreSQL makes them atomic together:
 *   - crash or failure before commit: neither content nor receipt exists, so no cleanup is
 *     needed and no stale receipt can authorize deletions;
 *   - after commit: both exist durably (Neon storage, not the Hostinger app filesystem, which
 *     is not persistent).
 * There is no cross-service atomicity claim: no second storage service is involved.
 * The receipt is HMAC-signed with a staging-only key, versioned, and has a unique import_id
 * (a primary key: no overwrite). It is bound to this database's own identity row
 * (hls_staging_identity, created once in staging) plus the connected host and database name.
 * It holds only collection, ID and content fingerprints: no content, secrets or personal data.
 * Lifecycle: committed -> cleaned (or failed-cleanup is impossible: cleanup is one
 * transaction). A failed import leaves a separate, unsigned audit row with status 'failed'
 * (best-effort, after rollback) and no record IDs.
 * Concurrency: import and cleanup take the same transaction-scoped advisory lock, so they
 * serialize. Cleanup locks each target row FOR UPDATE before verifying and deleting it, so a
 * concurrent editor cannot change a row between the check and the delete.
 */
const JOURNAL_DDL = [
  `CREATE TABLE IF NOT EXISTS hls_staging_identity (singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), identity uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS hls_staging_import_journal (import_id uuid PRIMARY KEY, version int NOT NULL, status text NOT NULL CHECK (status IN ('committed','cleaned','failed')), db_identity uuid, target_host text NOT NULL, database_name text NOT NULL, started_at timestamptz NOT NULL, finished_at timestamptz, entries jsonb NOT NULL, signature text, cleaned_at timestamptz, cleanup_receipt jsonb, error text)`,
];
/** Non-blocking: a concurrent import or cleanup makes this one refuse instead of waiting. */
// Same row-level-security posture as every other public table (owners are unaffected).
JOURNAL_DDL.push('ALTER TABLE hls_staging_identity ENABLE ROW LEVEL SECURITY', 'ALTER TABLE hls_staging_import_journal ENABLE ROW LEVEL SECURITY');
const LOCK_SQL = `SELECT pg_try_advisory_xact_lock(hashtext('hls-staging-import')) AS locked`;
const takeLock = async (q: (s: string) => Promise<any[]>) => { const [r] = await q(LOCK_SQL); if (r?.locked !== true) throw new Error('Refusing: another staging import or cleanup is in progress.'); };

const txExec = (payload: PayloadLike, transactionID: any) => {
  const exec = payload.db.sessions?.[transactionID]?.db;
  if (!exec?.execute) throw new Error('Refusing: no transaction session.');
  return async (q: string, ...params: unknown[]) => {
    // "$$" marks a bound parameter; values are never interpolated into SQL text.
    const parts = q.split('$$');
    if (parts.length !== params.length + 1) throw new Error('Internal: SQL parameter count mismatch.');
    const chunks = parts.flatMap((p, i) => (i < params.length ? [sql.raw(p), sql`${params[i]}`] : [sql.raw(p)]));
    const query = sql.join(chunks, sql.raw(''));
    const r: any = await exec.execute(query);
    return (r?.rows ?? r) as any[];
  };
};
const hex = (s: string) => /^[0-9a-f]{64}$/.test(s);

/** Ensure the journal tables and this database's identity row (staging only; runs after the guard). */
async function ensureJournal(q: ReturnType<typeof txExec>): Promise<{ identity: string; database: string }> {
  for (const ddl of JOURNAL_DDL) await q(ddl);
  await q(`INSERT INTO hls_staging_identity (singleton, identity) VALUES (true, $$) ON CONFLICT (singleton) DO NOTHING`, randomUUID());
  const [row] = await q(`SELECT identity::text AS identity, current_database() AS database FROM hls_staging_identity`);
  if (!row?.identity) throw new Error('Refusing: staging database identity unavailable.');
  return { identity: row.identity, database: row.database };
}


/**
 * Import the bundle. Order of guarantees:
 *   1. Target and bundle are fully validated BEFORE any database access (zero writes if denied).
 *   2. One transaction: advisory lock, content inserts, sequence reconciliation, then the
 *      signed journal row. The row is read back inside the transaction before commit.
 *      setval() is non-transactional in PostgreSQL; a rollback leaves only an ID gap.
 *   3. After commit, the journal row is re-read through a fresh read (not the transaction)
 *      and the content is verified. Any failure raises ImportCommittedError carrying the
 *      import_id; cleanupImport(payload, importId) is the recovery.
 *   4. allowIDOnCreate is restored in every path, including a failing beginTransaction.
 */
export async function importBundle(payload: PayloadLike, bundle: Bundle, opts: ImportOptions = {}): Promise<ImportReport> {
  const env = opts.env ?? process.env;
  assertImportTarget(payload, env);
  const key = journalKey(env);
  validateBundle(bundle, { requiredArticleIds: opts.requiredArticleIds });
  const report: ImportReport = { created: [], skipped: [], checksums: {} };
  const entries: JournalEntry[] = [];
  const startedAt = new Date().toISOString();
  const importId = randomUUID();
  const db = payload.db;
  const previousAllow = db.allowIDOnCreate;
  let committed = false;
  try {
    db.allowIDOnCreate = true; // this process only; never in the shared config
    const transactionID = await db.beginTransaction();
    if (!transactionID) throw new Error('Refusing: the database adapter did not open a transaction.');
    const req = { transactionID, context: { reseedVersions: true, stagingImport: true } } as any;
    try {
      const q = txExec(payload, transactionID);
      await takeLock(q);
      const ident = await ensureJournal(q);
      for (const collection of IMPORT_ORDER) {
        for (const doc of bundle.collections[collection] || []) {
          if (opts.failAt === `${collection}:${doc.id}`) throw new Error(`injected failure at ${opts.failAt}`);
          const existing = await payload.findByID({ collection, id: doc.id, depth: 0, overrideAccess: true, req, disableErrors: true });
          const want = checksum(comparable(doc));
          if (existing) {
            if (!subsetEqual(comparable(doc), comparable(existing))) throw new Error(`Conflict: ${collection}:${doc.id} exists with different content.`);
            report.skipped.push({ collection, id: doc.id });
            report.checksums[`${collection}:${doc.id}`] = want;
            continue;
          }
          const data = toWritable(doc);
          const created = collection === 'media'
            // Media rows are metadata only (no binary copy, no production bucket access).
            ? await db.create({ collection, data, req })
            : await payload.create({ collection, data: { ...data, ...(doc._status ? { _status: doc._status } : {}) }, overrideAccess: true, req, depth: 0 });
          if (String(created.id) !== String(doc.id)) throw new Error(`ID not preserved for ${collection}:${doc.id} (got ${created.id}).`);
          const stored = await payload.findByID({ collection, id: doc.id, depth: 0, overrideAccess: true, req, disableErrors: true });
          if (!stored) throw new Error(`${collection}:${doc.id} not readable after create.`);
          entries.push({ collection, id: doc.id, checksum: checksum(comparable(stored)) });
          report.created.push({ collection, id: doc.id });
          report.checksums[`${collection}:${doc.id}`] = want;
        }
      }
      if (opts.failAt === 'sequences') throw new Error('injected failure at sequences');
      await reconcileSequences(payload, transactionID);
      const unsigned = ({ version: 1 as const, importId, targetHost: connectedHost(payload), dbIdentity: ident.identity, databaseName: ident.database, startedAt, finishedAt: new Date().toISOString(), created: entries });
      const signature = signJournal(unsigned as any, key);
      if (opts.failAt === 'journal') throw new Error('injected failure at journal write');
      await q(`INSERT INTO hls_staging_import_journal (import_id, version, status, db_identity, target_host, database_name, started_at, finished_at, entries, signature) VALUES ($$::uuid, 1, 'committed', $$::uuid, $$, $$, $$::timestamptz, $$::timestamptz, $$::jsonb, $$)`,
        importId, ident.identity, unsigned.targetHost, ident.database, startedAt, unsigned.finishedAt, JSON.stringify(entries), signature);
      const [back] = await q(`SELECT signature FROM hls_staging_import_journal WHERE import_id = $$::uuid`, importId);
      if (back?.signature !== signature) throw new Error('Journal write could not be verified before commit.');
      if (opts.failAt === 'before-commit') throw new Error('injected crash before commit');
      report.journal = { ...(unsigned as any), signature };
      await db.commitTransaction(transactionID);
      committed = true;
    } catch (e) {
      if (!committed) await db.rollbackTransaction(transactionID);
      throw e;
    }
  } catch (e) {
    if (!committed) await recordFailure(payload, importId, startedAt, e).catch(() => {});
    throw e;
  } finally {
    db.allowIDOnCreate = previousAllow;
  }
  const problems: string[] = [];
  if (opts.failAt === 'after-commit') problems.push('injected post-commit failure');
  else {
    const durable = await loadJournal(payload, importId).catch(() => null);
    if (!durable || durable.signature !== report.journal!.signature) problems.push('journal not durable after commit');
    problems.push(...await verifyImport(payload, bundle));
  }
  if (problems.length) throw new ImportCommittedError(`Import ${importId} committed but failed verification (${problems.join('; ')}); recover with cleanupImport(payload, '${importId}').`, report);
  return report;
}

/** Best-effort audit row for a failed import (no record IDs: nothing was committed). */
async function recordFailure(payload: PayloadLike, importId: string, startedAt: string, e: unknown): Promise<void> {
  const transactionID = await payload.db.beginTransaction();
  if (!transactionID) return;
  try {
    const q = txExec(payload, transactionID);
    await ensureJournal(q);
    await q(`INSERT INTO hls_staging_import_journal (import_id, version, status, target_host, database_name, started_at, entries, error) VALUES ($$::uuid, 1, 'failed', $$, current_database(), $$::timestamptz, '[]'::jsonb, $$)`,
      importId, connectedHost(payload), startedAt, String((e as Error)?.message ?? e).slice(0, 500));
    await payload.db.commitTransaction(transactionID);
  } catch { await payload.db.rollbackTransaction(transactionID); }
}

/** Read one journal row (fresh transaction, read-only use). */
export async function loadJournal(payload: PayloadLike, importId: string): Promise<(ImportJournal & { status: string; dbIdentity: string; databaseName: string }) | null> {
  const transactionID = await payload.db.beginTransaction();
  if (!transactionID) throw new Error('Refusing: no transaction for journal read.');
  try {
    const q = txExec(payload, transactionID);
    const [row] = await q(`SELECT import_id::text AS id, version, status, db_identity::text AS db_identity, target_host, database_name, to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at, to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS finished_at, entries, signature FROM hls_staging_import_journal WHERE import_id = $$::uuid`, importId);
    await payload.db.commitTransaction(transactionID);
    if (!row) return null;
    return { version: row.version, importId: row.id, status: row.status, dbIdentity: row.db_identity, databaseName: row.database_name, targetHost: row.target_host, startedAt: row.started_at, finishedAt: row.finished_at, created: row.entries, signature: row.signature };
  } catch (e) { await payload.db.rollbackTransaction(transactionID); throw e; }
}

/** Move each imported table's serial sequence past its highest ID, inside the import transaction. */
export async function reconcileSequences(payload: PayloadLike, transactionID: string | number): Promise<void> {
  const q = txExec(payload, transactionID);
  for (const collection of IMPORT_ORDER) {
    const table = collection.replace(/-/g, '_');
    if (!/^[a-z_]+$/.test(table)) throw new Error('bad table name');
    await q(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${table}"), 1), (SELECT COUNT(*) > 0 FROM "${table}"))`);
  }
}

/** Post-import verification: every bundle record exists with the same comparable content. */
export async function verifyImport(payload: PayloadLike, bundle: Bundle): Promise<string[]> {
  const errors: string[] = [];
  for (const collection of IMPORT_ORDER) for (const doc of bundle.collections[collection] || []) {
    const got = await payload.findByID({ collection, id: doc.id, depth: 0, overrideAccess: true, disableErrors: true });
    if (!got) errors.push(`${collection}:${doc.id} missing`);
    else if (!subsetEqual(comparable(doc), comparable(got))) errors.push(`${collection}:${doc.id} differs`);
  }
  return errors;
}

export class CleanupRefusedError extends Error {
  constructor(message: string, public records: string[] = []) { super(message); }
}
export interface CleanupReceipt { importId: string; deleted: string[]; alreadyAbsent: string[]; previouslyCompleted: boolean }

/**
 * COMPENSATING cleanup of one COMMITTED import, identified by import_id. A failure before
 * commit needs no cleanup: the rollback removed content and journal together.
 *   1. Same runtime and connected-database gate as import, before any DB access.
 *   2. ONE transaction holding the same advisory lock as import. The journal row is read
 *      FOR UPDATE, and its signature, version, status, database identity, host and database
 *      name are verified against THIS database. Entries must be allowlisted and unique.
 *   3. Each target row is locked FOR UPDATE, then re-read and compared with the journaled
 *      fingerprint. A changed row aborts the whole transaction: zero deletions.
 *   4. Delete, set status 'cleaned' with a receipt, commit. Any failure rolls back
 *      everything, so a re-run starts clean. A 'cleaned' journal returns previouslyCompleted.
 *      Skipped or pre-existing records are never journaled, so they are never deleted.
 */
export async function cleanupImport(payload: PayloadLike, importId: string, { env = process.env, failAfterDeletes }: { env?: NodeJS.ProcessEnv; failAfterDeletes?: number } = {}): Promise<CleanupReceipt> {
  assertImportTarget(payload, env);
  const key = journalKey(env);
  if (typeof importId !== 'string' || !/^[0-9a-f-]{36}$/.test(importId)) throw new CleanupRefusedError('Refusing: invalid import id.');
  const transactionID = await payload.db.beginTransaction();
  if (!transactionID) throw new CleanupRefusedError('Refusing: the database adapter did not open a transaction.');
  const req = { transactionID, context: { reseedVersions: true, stagingImport: true } } as any;
  try {
    const q = txExec(payload, transactionID);
    await takeLock(q);
    const ident = await ensureJournal(q);
    const [row] = await q(`SELECT import_id::text AS id, version, status, db_identity::text AS db_identity, target_host, database_name, to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at, to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS finished_at, entries, signature, cleanup_receipt FROM hls_staging_import_journal WHERE import_id = $$::uuid FOR UPDATE`, importId);
    if (!row) throw new CleanupRefusedError('Refusing: no journal for this import in this database.');
    if (row.status === 'cleaned') { await payload.db.commitTransaction(transactionID); return { ...(row.cleanup_receipt as CleanupReceipt), previouslyCompleted: true }; }
    if (row.status !== 'committed' || row.version !== 1 || typeof row.signature !== 'string' || !hex(row.signature)) throw new CleanupRefusedError(`Refusing: journal status ${row.status} cannot be cleaned.`);
    const unsigned = { version: 1, importId: row.id, targetHost: row.target_host, dbIdentity: row.db_identity, databaseName: row.database_name, startedAt: row.started_at, finishedAt: row.finished_at, created: row.entries };
    const expected = Buffer.from(signJournal(unsigned as any, key), 'hex'), given = Buffer.from(row.signature, 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new CleanupRefusedError('Refusing: journal signature is invalid (altered, forged or another key).');
    if (row.db_identity !== ident.identity || row.database_name !== ident.database || row.target_host !== connectedHost(payload)) throw new CleanupRefusedError('Refusing: journal belongs to a different database.');
    const seen = new Set<string>();
    for (const e of row.entries as JournalEntry[]) {
      const k = `${e.collection}:${e.id}`;
      if (!ALLOWED.has(e.collection) || !hex(String(e.checksum)) || seen.has(k)) throw new CleanupRefusedError(`Refusing: invalid journal entry ${k}`);
      seen.add(k);
    }
    const deleted: string[] = [], absent: string[] = [], changed: string[] = [];
    const targets = [...(row.entries as JournalEntry[])].reverse();
    for (const e of targets) {
      const table = e.collection.replace(/-/g, '_');
      const locked = await q(`SELECT id FROM "${table}" WHERE id = $$ FOR UPDATE`, Number(e.id));
      if (!locked.length) { absent.push(`${e.collection}:${e.id}`); continue; }
      const current = await payload.findByID({ collection: e.collection, id: e.id, depth: 0, overrideAccess: true, req, disableErrors: true });
      if (!current || checksum(comparable(current)) !== e.checksum) changed.push(`${e.collection}:${e.id}`);
    }
    if (changed.length) throw new CleanupRefusedError(`Refusing: ${changed.length} record(s) changed since import; nothing deleted. Review manually.`, changed);
    for (const e of targets) {
      const k = `${e.collection}:${e.id}`;
      if (absent.includes(k)) continue;
      if (failAfterDeletes !== undefined && deleted.length === failAfterDeletes) throw new Error('injected failure during cleanup');
      await payload.delete({ collection: e.collection, id: e.id, overrideAccess: true, req, context: { reseedVersions: true, stagingImport: true } });
      deleted.push(k);
    }
    const receipt: CleanupReceipt = { importId, deleted, alreadyAbsent: absent, previouslyCompleted: false };
    await q(`UPDATE hls_staging_import_journal SET status = 'cleaned', cleaned_at = now(), cleanup_receipt = $$::jsonb WHERE import_id = $$::uuid AND status = 'committed'`, JSON.stringify(receipt), importId);
    await payload.db.commitTransaction(transactionID);
    return receipt;
  } catch (e) {
    await payload.db.rollbackTransaction(transactionID);
    throw e;
  }
}
