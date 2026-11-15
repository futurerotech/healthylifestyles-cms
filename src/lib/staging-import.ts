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
 * - returns a signed creation journal. cleanupImport, independently guarded, deletes only
 *   journaled records that are unchanged. It is resumable, and it never touches skipped or
 *   pre-existing records.
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
 * Signed creation journal, scoped to one import invocation. It lists ONLY records this import
 * created, each with the checksum of the record as stored by this import. It is written
 * through ImportOptions.writeJournal BEFORE commit, so it survives a crash after commit.
 */
export interface ImportJournal { version: 1; importId: string; targetHost: string; startedAt: string; finishedAt: string; created: JournalEntry[]; signature: string }
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
  /** Durable, owner-reviewable receipt sink (for example a file). Required; called before commit. */
  writeJournal?: (journal: ImportJournal) => Promise<void> | void;
  /** Test hooks: inject a failure at "<collection>:<id>", "sequences" or "after-commit". */
  failAt?: string;
}
export class ImportCommittedError extends Error {
  constructor(message: string, public report: ImportReport) { super(message); }
}

/**
 * Import the bundle. Order of guarantees:
 *   1. Target and bundle are fully validated BEFORE any database access (zero writes if denied).
 *   2. Content inserts AND sequence reconciliation run inside ONE transaction. setval() is
 *      non-transactional in PostgreSQL; if the transaction rolls back, only an advanced
 *      sequence value remains (an ID gap). That is harmless and never reuses an ID.
 *   3. After commit, the import is verified. If verification fails, the committed content
 *      is NOT silently kept: ImportCommittedError carries the exact report, and
 *      cleanupImport(report) removes precisely those records (tested). A re-run is
 *      idempotent.
 *   4. allowIDOnCreate is restored in every path, including a failing beginTransaction.
 */
export async function importBundle(payload: PayloadLike, bundle: Bundle, opts: ImportOptions = {}): Promise<ImportReport> {
  const env = opts.env ?? process.env;
  assertImportTarget(payload, env);
  const key = journalKey(env);
  if (typeof opts.writeJournal !== 'function') throw new Error('Refusing: a durable writeJournal receipt sink is required.');
  validateBundle(bundle, { requiredArticleIds: opts.requiredArticleIds });
  const report: ImportReport = { created: [], skipped: [], checksums: {} };
  const journalEntries: JournalEntry[] = [];
  const startedAt = new Date().toISOString();
  const importId = randomUUID();
  const db = payload.db;
  const previousAllow = db.allowIDOnCreate;
  try {
    db.allowIDOnCreate = true; // this process only; never in the shared config
    const transactionID = await db.beginTransaction();
    if (!transactionID) throw new Error('Refusing: the database adapter did not open a transaction.');
    const req = { transactionID, context: { reseedVersions: true, stagingImport: true } } as any;
    try {
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
          journalEntries.push({ collection, id: doc.id, checksum: checksum(comparable(stored)) });
          report.created.push({ collection, id: doc.id });
          report.checksums[`${collection}:${doc.id}`] = want;
        }
      }
      if (opts.failAt === 'sequences') throw new Error('injected failure at sequences');
      await reconcileSequences(payload, transactionID);
      const unsigned = { version: 1 as const, importId, targetHost: connectedHost(payload), startedAt, finishedAt: new Date().toISOString(), created: journalEntries };
      report.journal = { ...unsigned, signature: signJournal(unsigned, key) };
      // Durable receipt BEFORE commit: if the process dies after commit, cleanup still has it.
      await opts.writeJournal(report.journal);
      await db.commitTransaction(transactionID);
    } catch (e) {
      await db.rollbackTransaction(transactionID);
      throw e;
    }
  } finally {
    db.allowIDOnCreate = previousAllow;
  }
  const problems = opts.failAt === 'after-commit' ? ['injected post-commit verification failure'] : await verifyImport(payload, bundle);
  if (problems.length) throw new ImportCommittedError(`Import committed but failed verification (${problems.length}); run cleanupImport(payload, error.report.journal).`, report);
  return report;
}

/** Move each imported table's serial sequence past its highest ID, inside the import transaction. */
export async function reconcileSequences(payload: PayloadLike, transactionID: string | number): Promise<void> {
  const session = payload.db.sessions?.[transactionID as any];
  const exec = session?.db;
  if (!exec?.execute) throw new Error('Refusing: no transaction session for sequence reconciliation.');
  for (const collection of IMPORT_ORDER) {
    const table = collection.replace(/-/g, '_');
    if (!/^[a-z_]+$/.test(table)) throw new Error('bad table name');
    await exec.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${table}"), 1), (SELECT COUNT(*) > 0 FROM "${table}"))`));
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
export interface CleanupReceipt { importId: string; deleted: string[]; alreadyAbsent: string[] }

/**
 * COMPENSATING cleanup after a COMMITTED import. A failure before commit needs no cleanup:
 * the transaction rollback already removed everything. Cleanup is guarded independently:
 *   1. same runtime and connected-database gate as import, before any DB access;
 *   2. the journal must be well-formed, signed with the staging journal key, recorded for
 *      this exact connected host, and list only allowlisted collections with unique IDs;
 *   3. pre-check pass: each record must be absent (already cleaned) or byte-identical to the
 *      state this import stored. If ANY record changed, nothing is deleted (manual review);
 *   4. delete in reverse dependency order. It is resumable and idempotent: absent records
 *      are reported, never an error. Skipped or pre-existing records are never journaled,
 *      so they are never deleted.
 */
export async function cleanupImport(payload: PayloadLike, journal: ImportJournal, { env = process.env }: { env?: NodeJS.ProcessEnv } = {}): Promise<CleanupReceipt> {
  assertImportTarget(payload, env);
  const key = journalKey(env);
  if (!journal || journal.version !== 1 || typeof journal.importId !== 'string' || !Array.isArray(journal.created) || typeof journal.signature !== 'string') throw new CleanupRefusedError('Refusing: malformed cleanup journal.');
  const { signature, ...unsigned } = journal;
  const expected = Buffer.from(signJournal(unsigned, key), 'hex');
  const given = Buffer.from(signature, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new CleanupRefusedError('Refusing: cleanup journal signature is invalid (forged, edited or from another key).');
  if (journal.targetHost !== connectedHost(payload)) throw new CleanupRefusedError('Refusing: cleanup journal was recorded for a different database.');
  const keys = new Set<string>();
  for (const e of journal.created) {
    if (!ALLOWED.has(e.collection) || e.id === undefined || e.id === null || !/^[0-9a-f]{64}$/.test(String(e.checksum))) throw new CleanupRefusedError(`Refusing: invalid journal entry ${e.collection}:${e.id}`);
    const k = `${e.collection}:${e.id}`;
    if (keys.has(k)) throw new CleanupRefusedError(`Refusing: duplicate journal entry ${k}`);
    keys.add(k);
  }
  const absent: string[] = [], changed: string[] = [];
  for (const e of journal.created) {
    const current = await payload.findByID({ collection: e.collection, id: e.id, depth: 0, overrideAccess: true, disableErrors: true });
    if (!current) absent.push(`${e.collection}:${e.id}`);
    else if (checksum(comparable(current)) !== e.checksum) changed.push(`${e.collection}:${e.id}`);
  }
  if (changed.length) throw new CleanupRefusedError(`Refusing: ${changed.length} record(s) changed since import; nothing deleted. Review manually.`, changed);
  const deleted: string[] = [];
  for (const e of [...journal.created].reverse()) {
    const k = `${e.collection}:${e.id}`;
    if (absent.includes(k)) continue;
    // Re-verify immediately before deleting, so an edit made during cleanup is never lost.
    const now = await payload.findByID({ collection: e.collection, id: e.id, depth: 0, overrideAccess: true, disableErrors: true });
    if (!now) { absent.push(k); continue; }
    if (checksum(comparable(now)) !== e.checksum) throw new CleanupRefusedError(`Refusing: ${k} changed during cleanup; stopped. Re-run after review; already deleted: ${deleted.join(', ') || 'none'}.`, [k]);
    await payload.delete({ collection: e.collection, id: e.id, overrideAccess: true, context: { reseedVersions: true, stagingImport: true } });
    deleted.push(k);
  }
  return { importId: journal.importId, deleted, alreadyAbsent: absent };
}
