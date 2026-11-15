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
 * - runs in ONE database transaction. Any failure rolls back everything, so a partial
 *   import cannot persist;
 * - is idempotent: an existing record with the same ID and the same content is skipped,
 *   and an existing record with different content is a conflict that aborts the import;
 * - moves each serial sequence past the highest imported ID;
 * - returns before and after checksums for independent verification, and supports cleanup
 *   of exactly what it created.
 * Hooks see context { reseedVersions, stagingImport }. The existing maintenance flag
 * already disables the publish gate and indexing hooks, and isolated-staging mode disables
 * the queue and push.
 */
import { createHash } from 'node:crypto';
import { sql } from '@payloadcms/db-postgres';

export const IMPORT_ORDER = ['categories', 'authors', 'tags', 'media', 'tools', 'articles', 'pages', 'pseo-pages', 'redirects'] as const;
export type ImportCollection = (typeof IMPORT_ORDER)[number];
const ALLOWED = new Set<string>(IMPORT_ORDER);
/** Generated or server-owned fields that must not be copied. */
const DROP_TOP = new Set(['createdAt', 'updatedAt', '_status', 'url', 'thumbnailURL', 'sizes', 'prefix']);
export const PRODUCTION_DB_HOST_FRAGMENT = 'ep-lucky-voice-ad5egz8d';

export interface Bundle { version: number; sourceOrigin: string; collections: Record<string, any[]>; globals?: Record<string, unknown>; checksums?: Record<string, string> }
export interface ImportReport { created: { collection: string; id: string | number }[]; skipped: { collection: string; id: string | number }[]; checksums: Record<string, string> }

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

/** Validate a bundle before touching the database. */
export function validateBundle(bundle: Bundle): void {
  if (!bundle || bundle.version !== 1 || typeof bundle.collections !== 'object') throw new Error('Invalid bundle.');
  for (const c of Object.keys(bundle.collections)) if (!ALLOWED.has(c)) throw new Error(`Collection not allowed: ${c}`);
  for (const [c, docs] of Object.entries(bundle.collections)) {
    const ids = new Set<string>();
    for (const d of docs) {
      if (d?.id === undefined || d.id === null) throw new Error(`${c}: record without id`);
      if (ids.has(String(d.id))) throw new Error(`${c}: duplicate id ${d.id}`);
      ids.add(String(d.id));
      if (bundle.checksums?.[`${c}:${d.id}`] === undefined) throw new Error(`${c}:${d.id} has no export checksum`);
    }
  }
}

type PayloadLike = any;

/** Import the bundle in one transaction. `failAt` is a test hook to prove rollback. */
export async function importBundle(payload: PayloadLike, bundle: Bundle, { failAt }: { failAt?: string } = {}): Promise<ImportReport> {
  validateBundle(bundle);
  const report: ImportReport = { created: [], skipped: [], checksums: {} };
  const db = payload.db;
  const previousAllow = db.allowIDOnCreate;
  db.allowIDOnCreate = true; // this process only; never in the shared config
  const transactionID = await db.beginTransaction();
  const req = { transactionID, context: { reseedVersions: true, stagingImport: true } } as any;
  try {
    for (const collection of IMPORT_ORDER) {
      for (const doc of bundle.collections[collection] || []) {
        if (failAt === `${collection}:${doc.id}`) throw new Error(`injected failure at ${failAt}`);
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
        report.created.push({ collection, id: doc.id });
        report.checksums[`${collection}:${doc.id}`] = want;
      }
    }
    await db.commitTransaction(transactionID);
    await reconcileSequences(payload);
    return report;
  } catch (e) {
    await db.rollbackTransaction(transactionID);
    throw e;
  } finally {
    db.allowIDOnCreate = previousAllow;
  }
}

/** Move each imported table's serial sequence past its highest ID. */
export async function reconcileSequences(payload: PayloadLike): Promise<void> {
  for (const collection of IMPORT_ORDER) {
    const table = collection.replace(/-/g, '_');
    if (!/^[a-z_]+$/.test(table)) throw new Error('bad table name');
    // Idempotent: safe to re-run after a crash between commit and this step.
    await payload.db.drizzle.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${table}"), 1), (SELECT COUNT(*) > 0 FROM "${table}"))`));
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

/** Remove exactly what a report created, in reverse dependency order. */
export async function cleanupImport(payload: PayloadLike, report: ImportReport): Promise<void> {
  for (const { collection, id } of [...report.created].reverse()) {
    await payload.delete({ collection, id, overrideAccess: true, context: { reseedVersions: true, stagingImport: true } });
  }
}
