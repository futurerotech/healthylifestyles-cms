import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

// Runs only in the isolated-staging CI step (real staging-mode config on the disposable
// loopback database); the general integration suite skips it, as it skips the role tests.
const enabled = process.env.CI_STAGING_ROLE_INTEGRATION === '1';
if (enabled && (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUN_DATABASE_TESTS !== '1' ||
    process.env.DATABASE_URI !== 'postgres://mock:mock@localhost:5432/mock' || process.env.HLS_ISOLATED_STAGING !== 'true')) {
  throw new Error('Staging-import integration tests require the disposable GitHub Actions loopback mock database in isolated-staging mode.');
}

/**
 * SYNTHETIC evidence on a disposable PostgreSQL. It proves the importer, the in-database
 * journal and the cleanup against the real Payload config and schema. A separate raw pg
 * connection stands in for "another process" and "after restart". It is NOT evidence of a
 * real Hostinger restart or of the real Neon staging database.
 */
describe.skipIf(!enabled)('staging mirror importer, durable journal and guarded cleanup (disposable DB, synthetic)', () => {
  let payload: any;
  let lib: typeof import('../../src/lib/staging-import');
  let raw: Client; // independent connection
  const base = 900000;
  const ids = { category: base + 1, author: base + 2, tool: base + 3, article: base + 4, article2: base + 5 };
  const now = '2026-11-15T00:00:00.000Z';
  const LOCK = `hashtext('hls-staging-import')`;
  const rel = (id: number, slug: string) => ({ id, slug, createdAt: now, updatedAt: now });
  const env = { ...process.env, HLS_STAGING_IMPORT_JOURNAL_KEY: 'test-only-journal-key-0123456789abcdef' } as NodeJS.ProcessEnv;
  const bundle = () => {
    const collections: Record<string, any[]> = {
      categories: [{ id: ids.category, name: 'Synthetic category', slug: `syn-cat-${base}`, createdAt: now, updatedAt: now }],
      authors: [{ id: ids.author, name: 'Synthetic author', slug: `syn-author-${base}`, createdAt: now, updatedAt: now }],
      tools: [{ id: ids.tool, name: 'Synthetic tool', slug: `syn-tool-${base}`, toolType: 'formula', category: rel(ids.category, `syn-cat-${base}`), _status: 'published', createdAt: now, updatedAt: now }],
      articles: [
        { id: ids.article, title: 'Synthetic article', slug: `syn-article-${base}`, _status: 'published', author: rel(ids.author, `syn-author-${base}`),
          primaryTool: rel(ids.tool, `syn-tool-${base}`), layout: [{ blockType: 'toolEmbed', tool: rel(ids.tool, `syn-tool-${base}`) }], createdAt: now, updatedAt: now },
        { id: ids.article2, title: 'Synthetic article 2', slug: `syn-article2-${base}`, _status: 'published', createdAt: now, updatedAt: now },
      ],
    };
    const checksums: Record<string, string> = {};
    for (const [c, docs] of Object.entries(collections)) for (const d of docs) checksums[`${c}:${d.id}`] = lib.checksum(d);
    return { version: 1, sourceOrigin: 'https://cms.healthylifesstyles.com', scope: 'published public content only', collections, checksums } as any;
  };
  const opts = (extra: Record<string, unknown> = {}) => ({ env, requiredArticleIds: [ids.article, ids.article2], ...extra });
  const pairs = () => [['categories', ids.category], ['authors', ids.author], ['tools', ids.tool], ['articles', ids.article], ['articles', ids.article2]] as const;
  const countAll = async () => {
    let n = 0;
    for (const [collection, id] of pairs()) if (await payload.findByID({ collection, id, depth: 0, overrideAccess: true, disableErrors: true })) n++;
    return n;
  };
  const journalRows = async (status?: string): Promise<any[]> => {
    const exists = (await raw.query(`SELECT to_regclass('public.hls_staging_import_journal') AS t`)).rows[0].t;
    if (!exists) return [];
    return (await raw.query(`SELECT import_id::text AS id, status, entries, signature FROM hls_staging_import_journal ${status ? 'WHERE status = $1' : ''} ORDER BY started_at`, status ? [status] : [])).rows;
  };
  const statusOf = async (id: string) => (await raw.query(`SELECT status FROM hls_staging_import_journal WHERE import_id = $1`, [id])).rows[0]?.status;

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const config = (await import('../../payload.config')).default;
    payload = await getPayload({ config });
    lib = await import('../../src/lib/staging-import');
    raw = new Client({ connectionString: process.env.DATABASE_URI });
    await raw.connect();
  });
  afterAll(async () => { await raw?.end(); });

  it('denied import paths write nothing (content or journal)', async () => {
    const prod = 'postgres://u:p@ep-lucky-voice-ad5egz8d.c-2.us-east-1.aws.neon.tech/neondb';
    const staging = { HLS_ISOLATED_STAGING: 'true', HLS_STAGING_IMPORT_APPROVED: 'yes', HLS_STAGING_DB_HOST: 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech',
      DATABASE_URI: 'postgres://u:p@ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech/neondb', HLS_STAGING_IMPORT_JOURNAL_KEY: 'test-only-journal-key-0123456789abcdef' } as NodeJS.ProcessEnv;
    const before = payload.db.allowIDOnCreate;
    for (const denied of [
      { ...staging, DATABASE_URI: prod }, staging, { ...staging, HLS_STAGING_IMPORT_APPROVED: undefined },
      { ...staging, HLS_ISOLATED_STAGING: undefined }, { ...staging, INDEXNOW_API_KEY: 'x' }, { ...env, HLS_STAGING_IMPORT_JOURNAL_KEY: 'short' },
    ]) await expect(lib.importBundle(payload, bundle(), opts({ env: denied }))).rejects.toThrow(/Refusing/);
    expect(await countAll()).toBe(0);
    expect(await journalRows()).toEqual([]);
    expect(payload.db.allowIDOnCreate).toBe(before);
  });

  it('a failing transaction start restores allowIDOnCreate and writes nothing', async () => {
    const original = payload.db.beginTransaction;
    const before = payload.db.allowIDOnCreate;
    payload.db.beginTransaction = async () => { throw new Error('begin failed (injected)'); };
    try { await expect(lib.importBundle(payload, bundle(), opts())).rejects.toThrow(/begin failed/); }
    finally { payload.db.beginTransaction = original; }
    expect(payload.db.allowIDOnCreate).toBe(before);
    expect(await countAll()).toBe(0);
    expect(await journalRows('committed')).toEqual([]);
  });

  for (const failAt of [`articles:${base + 5}`, 'sequences', 'journal', 'before-commit']) {
    it(`failure or crash before commit (${failAt}) leaves no content and no committed receipt`, async () => {
      await expect(lib.importBundle(payload, bundle(), opts({ failAt }))).rejects.toThrow(/injected/);
      expect(await countAll()).toBe(0);
      expect(await journalRows('committed')).toEqual([]);
      // A separate, unsigned 'failed' audit row is kept for owner review (no record IDs).
      const failed = await journalRows('failed');
      expect(failed.length).toBeGreaterThan(0);
      expect(failed.every((r) => r.signature === null && r.entries.length === 0)).toBe(true);
    });
  }

  it('a concurrent import or cleanup makes the second attempt refuse, writing nothing', async () => {
    await raw.query(`SELECT pg_advisory_lock(${LOCK})`);
    try {
      await expect(lib.importBundle(payload, bundle(), opts())).rejects.toThrow(/in progress/);
      await expect(lib.cleanupImport(payload, '11111111-2222-4333-8444-555555555555', { env })).rejects.toThrow(/in progress/);
    } finally { await raw.query(`SELECT pg_advisory_unlock(${LOCK})`); }
    expect(await countAll()).toBe(0);
    expect(await journalRows('committed')).toEqual([]);
  });

  let importId: string;
  it('crash after commit but before response: the receipt is durable (independent connection) and drives recovery', async () => {
    let err: any;
    try { await lib.importBundle(payload, bundle(), opts({ failAt: 'after-commit' })); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(lib.ImportCommittedError);
    importId = err.report.journal.importId;
    expect(await countAll()).toBe(5);
    // "Restart": read the receipt through a separate connection, not the importer's memory.
    const [row] = (await raw.query(`SELECT status, entries, signature FROM hls_staging_import_journal WHERE import_id = $1`, [importId])).rows;
    expect(row.status).toBe('committed');
    expect(row.entries.map((e: any) => e.id)).toEqual([ids.category, ids.author, ids.tool, ids.article, ids.article2]);
    expect(row.signature).toBe(err.report.journal.signature);
    expect(JSON.stringify(row.entries)).not.toMatch(/Synthetic|@/); // fingerprints only, no content
    const durable = await lib.loadJournal(payload, importId);
    expect(durable?.signature).toBe(row.signature);
    // The same import_id cannot be written twice (no overwrite).
    await expect(raw.query(`INSERT INTO hls_staging_import_journal (import_id, version, status, target_host, database_name, started_at, entries) VALUES ($1, 1, 'committed', 'x', 'x', now(), '[]')`, [importId])).rejects.toThrow(/duplicate key/);
  });

  it('cleanup refuses altered, forged, wrong-identity, stale and missing journals, and an unavailable DB, deleting nothing', async () => {
    // Altered entries: the signature no longer matches.
    await raw.query(`UPDATE hls_staging_import_journal SET entries = entries || '[{"collection":"articles","id":1,"checksum":"${'a'.repeat(64)}"}]'::jsonb WHERE import_id = $1`, [importId]);
    await expect(lib.cleanupImport(payload, importId, { env })).rejects.toThrow(/signature/);
    await raw.query(`UPDATE hls_staging_import_journal SET entries = entries - (jsonb_array_length(entries) - 1) WHERE import_id = $1`, [importId]);
    // Wrong signing key, as for a forged receipt.
    await expect(lib.cleanupImport(payload, importId, { env: { ...env, HLS_STAGING_IMPORT_JOURNAL_KEY: 'another-key-0123456789abcdef-0123456789' } })).rejects.toThrow(/signature/);
    // Wrong staging database identity.
    const [{ identity }] = (await raw.query(`SELECT identity::text AS identity FROM hls_staging_identity`)).rows;
    await raw.query(`UPDATE hls_staging_identity SET identity = gen_random_uuid()`);
    await expect(lib.cleanupImport(payload, importId, { env })).rejects.toThrow(/different database/);
    await raw.query(`UPDATE hls_staging_identity SET identity = $1::uuid`, [identity]);
    // Stale or replaced status.
    await raw.query(`UPDATE hls_staging_import_journal SET status = 'failed' WHERE import_id = $1`, [importId]);
    await expect(lib.cleanupImport(payload, importId, { env })).rejects.toThrow(/cannot be cleaned/);
    await raw.query(`UPDATE hls_staging_import_journal SET status = 'committed' WHERE import_id = $1`, [importId]);
    // Missing journal.
    await expect(lib.cleanupImport(payload, '11111111-2222-4333-8444-555555555555', { env })).rejects.toThrow(/no journal/);
    // Storage unavailable during recovery.
    const original = payload.db.beginTransaction;
    payload.db.beginTransaction = async () => { throw new Error('database unavailable (injected)'); };
    try { await expect(lib.cleanupImport(payload, importId, { env })).rejects.toThrow(/unavailable/); }
    finally { payload.db.beginTransaction = original; }
    expect(await countAll()).toBe(5);
    expect(await statusOf(importId)).toBe('committed');
  });

  it('an editor change blocks cleanup; a failure mid-cleanup rolls back every delete', async () => {
    await payload.update({ collection: 'categories', id: ids.category, data: { name: 'Edited after import' }, overrideAccess: true });
    await expect(lib.cleanupImport(payload, importId, { env })).rejects.toMatchObject({ records: [`categories:${ids.category}`] });
    expect(await countAll()).toBe(5);
    await payload.update({ collection: 'categories', id: ids.category, data: { name: 'Synthetic category' }, overrideAccess: true });
    await expect(lib.cleanupImport(payload, importId, { env, failAfterDeletes: 2 })).rejects.toThrow(/injected failure during cleanup/);
    expect(await countAll()).toBe(5); // one transaction: the two deletes were rolled back
    expect(await statusOf(importId)).toBe('committed');
  });

  it('recovery deletes exactly the journaled records; repeated recovery is a recorded no-op', async () => {
    const receipt = await lib.cleanupImport(payload, importId, { env });
    expect(receipt.deleted).toHaveLength(5);
    expect(receipt.previouslyCompleted).toBe(false);
    expect(await countAll()).toBe(0);
    const again = await lib.cleanupImport(payload, importId, { env });
    expect(again.previouslyCompleted).toBe(true);
    expect(again.deleted).toHaveLength(5);
    expect(await statusOf(importId)).toBe('cleaned');
  });

  let report: any;
  it('imports with original IDs and relations; sequences reconciled; re-import journals and deletes nothing', async () => {
    report = await lib.importBundle(payload, bundle(), opts());
    expect(report.created.map((c: any) => c.id)).toEqual([ids.category, ids.author, ids.tool, ids.article, ids.article2]);
    expect(await statusOf(report.journal.importId)).toBe('committed');
    const art = await payload.findByID({ collection: 'articles', id: ids.article, depth: 0, overrideAccess: true });
    expect(art.primaryTool).toBe(ids.tool);
    expect(art.layout[0].tool).toBe(ids.tool);
    expect(await lib.verifyImport(payload, bundle())).toEqual([]);
    const fresh = await payload.create({ collection: 'categories', data: { name: 'After import', slug: `after-${base}` }, overrideAccess: true });
    expect(Number(fresh.id)).toBeGreaterThan(ids.category);
    await payload.delete({ collection: 'categories', id: fresh.id, overrideAccess: true });
    const again = await lib.importBundle(payload, bundle(), opts());
    expect(again.created).toEqual([]);
    expect(again.journal!.created).toEqual([]);
    expect((await lib.cleanupImport(payload, again.journal!.importId, { env })).deleted).toEqual([]); // pre-existing records are never deleted
    expect(await countAll()).toBe(5);
    const changed = bundle();
    changed.collections.articles[1] = { ...changed.collections.articles[1], title: 'Different title' };
    changed.checksums[`articles:${ids.article2}`] = lib.checksum(changed.collections.articles[1]);
    await expect(lib.importBundle(payload, changed, opts())).rejects.toThrow(/Conflict/);
  });

  it('final cleanup leaves the disposable database empty of synthetic records', async () => {
    await lib.cleanupImport(payload, report.journal.importId, { env });
    expect(await countAll()).toBe(0);
  });
});
