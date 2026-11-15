import { beforeAll, describe, expect, it } from 'vitest';

// Runs only in the isolated-staging CI step (real staging-mode config on the disposable
// loopback database); the general integration suite skips it, as it skips the role tests.
const enabled = process.env.CI_STAGING_ROLE_INTEGRATION === '1';
if (enabled && (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUN_DATABASE_TESTS !== '1' ||
    process.env.DATABASE_URI !== 'postgres://mock:mock@localhost:5432/mock' || process.env.HLS_ISOLATED_STAGING !== 'true')) {
  throw new Error('Staging-import integration tests require the disposable GitHub Actions loopback mock database in isolated-staging mode.');
}

/**
 * SYNTHETIC evidence: proves the importer against the real Payload config and schema on a
 * disposable database. It is not evidence about the real staging runtime.
 */
describe.skipIf(!enabled)('staging mirror importer on the committed schema (disposable DB, synthetic records)', () => {
  let payload: any;
  let lib: typeof import('../../src/lib/staging-import');
  const base = 900000; // far above any fixture ID, so it never collides with other tests
  const ids = { category: base + 1, author: base + 2, tool: base + 3, article: base + 4, article2: base + 5 };
  const now = '2026-11-15T00:00:00.000Z';
  const rel = (id: number, slug: string) => ({ id, slug, createdAt: now, updatedAt: now });
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
    return { version: 1, sourceOrigin: 'https://cms.healthylifesstyles.com', scope: 'published public content only', collections, checksums };
  };

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const config = (await import('../../payload.config')).default;
    payload = await getPayload({ config });
    lib = await import('../../src/lib/staging-import');
  });

  const env = { ...process.env, HLS_STAGING_IMPORT_JOURNAL_KEY: 'test-only-journal-key-0123456789abcdef' } as NodeJS.ProcessEnv;
  const journals: any[] = [];
  const opts = () => ({ env, requiredArticleIds: [ids.article, ids.article2], writeJournal: (j: any) => { journals.push(structuredClone(j)); } });
  const countAll = async () => {
    let n = 0;
    for (const [collection, id] of [['categories', ids.category], ['authors', ids.author], ['tools', ids.tool], ['articles', ids.article], ['articles', ids.article2]] as const) {
      if (await payload.findByID({ collection, id, depth: 0, overrideAccess: true, disableErrors: true })) n++;
    }
    return n;
  };

  it('denied entrypoint paths write nothing against the real database', async () => {
    const prod = 'postgres://u:p@ep-lucky-voice-ad5egz8d.c-2.us-east-1.aws.neon.tech/neondb';
    const staging = { HLS_ISOLATED_STAGING: 'true', HLS_STAGING_IMPORT_APPROVED: 'yes', HLS_STAGING_DB_HOST: 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech', DATABASE_URI: 'postgres://u:p@ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech/neondb' } as NodeJS.ProcessEnv;
    const before = payload.db.allowIDOnCreate;
    for (const denied of [
      { ...staging, DATABASE_URI: prod },                    // production URI
      staging,                                                // env says staging, connection is the CI DB
      { ...staging, HLS_STAGING_IMPORT_APPROVED: undefined }, // no owner approval
      { ...staging, HLS_ISOLATED_STAGING: undefined },        // not isolated staging
      { ...staging, INDEXNOW_API_KEY: 'x' },                  // outbound credential present
    ]) await expect(lib.importBundle(payload, bundle() as any, { ...opts(), env: denied })).rejects.toThrow(/Refusing/);
    expect(await countAll()).toBe(0);
    expect(payload.db.allowIDOnCreate).toBe(before);
  });

  it('a failing transaction start restores allowIDOnCreate and writes nothing', async () => {
    const original = payload.db.beginTransaction;
    const before = payload.db.allowIDOnCreate;
    payload.db.beginTransaction = async () => { throw new Error('begin failed (injected)'); };
    try { await expect(lib.importBundle(payload, bundle() as any, opts())).rejects.toThrow(/begin failed/); }
    finally { payload.db.beginTransaction = original; }
    expect(payload.db.allowIDOnCreate).toBe(before);
    expect(await countAll()).toBe(0);
  });

  it('failure during sequence reconciliation rolls back all content', async () => {
    await expect(lib.importBundle(payload, bundle() as any, { ...opts(), failAt: 'sequences' })).rejects.toThrow(/sequences/);
    expect(await countAll()).toBe(0);
  });

  it('failure after commit is reported with the exact report; cleanup removes it; re-run is clean', async () => {
    let err: any;
    try { await lib.importBundle(payload, bundle() as any, { ...opts(), failAt: 'after-commit' }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(lib.ImportCommittedError);
    expect(err.report.created).toHaveLength(5);
    expect(await countAll()).toBe(5);
    // The durable receipt was written before commit and equals the one in the error.
    expect(journals.at(-1)).toEqual(err.report.journal);
    // Guarded cleanup refuses a forged journal and a wrong environment, deleting nothing.
    await expect(lib.cleanupImport(payload, { ...err.report.journal, signature: '0'.repeat(64) }, { env })).rejects.toThrow(/signature/);
    await expect(lib.cleanupImport(payload, err.report.journal, { env: { ...env, DATABASE_URI: 'postgres://u:p@ep-lucky-voice-ad5egz8d.c-2.us-east-1.aws.neon.tech/neondb' } })).rejects.toThrow(/production/);
    expect(await countAll()).toBe(5);
    // An editor change blocks the whole cleanup.
    await payload.update({ collection: 'categories', id: ids.category, data: { name: 'Edited after import' }, overrideAccess: true });
    await expect(lib.cleanupImport(payload, err.report.journal, { env })).rejects.toMatchObject({ records: [`categories:${ids.category}`] });
    expect(await countAll()).toBe(5);
    await payload.update({ collection: 'categories', id: ids.category, data: { name: 'Synthetic category' }, overrideAccess: true });
    // Partial cleanup failure, then resume.
    const realDelete = payload.delete.bind(payload);
    let n = 0;
    payload.delete = async (a: any) => { if (n++ === 2) throw new Error('delete failed (injected)'); return realDelete(a); };
    try { await expect(lib.cleanupImport(payload, err.report.journal, { env })).rejects.toThrow(/delete failed/); }
    finally { payload.delete = realDelete; }
    expect(await countAll()).toBe(3);
    const resumed = await lib.cleanupImport(payload, err.report.journal, { env });
    expect(resumed.deleted).toHaveLength(3);
    expect(resumed.alreadyAbsent).toHaveLength(2);
    expect(await countAll()).toBe(0);
  });

  it('partial failure rolls back everything (injected failure at the second article)', async () => {
    await expect(lib.importBundle(payload, bundle() as any, { ...opts(), failAt: `articles:${ids.article2}` })).rejects.toThrow(/injected failure/);
    for (const [collection, id] of [['categories', ids.category], ['tools', ids.tool], ['articles', ids.article]] as const) {
      expect(await payload.findByID({ collection, id, depth: 0, overrideAccess: true, disableErrors: true })).toBeNull();
    }
  });

  let report: any;
  it('imports with original IDs and relations, then verifies against the export', async () => {
    report = await lib.importBundle(payload, bundle() as any, opts());
    expect(report.created.map((c: any) => c.id)).toEqual([ids.category, ids.author, ids.tool, ids.article, ids.article2]);
    const art = await payload.findByID({ collection: 'articles', id: ids.article, depth: 0, overrideAccess: true });
    expect(art.primaryTool).toBe(ids.tool);
    expect(art.layout[0].tool).toBe(ids.tool);
    expect(art._status).toBe('published');
    expect(await lib.verifyImport(payload, bundle() as any)).toEqual([]);
    // Nothing was queued for deployment or indexing.
    expect((await payload.count({ collection: 'pending-deploys', where: { docId: { equals: String(ids.article) } }, overrideAccess: true }).catch(() => ({ totalDocs: 0 }))).totalDocs).toBe(0);
  });

  it('reconciles sequences: a new record gets an ID above the imported ones', async () => {
    const fresh = await payload.create({ collection: 'categories', data: { name: 'After import', slug: `after-${base}` }, overrideAccess: true });
    expect(Number(fresh.id)).toBeGreaterThan(ids.category);
    await payload.delete({ collection: 'categories', id: fresh.id, overrideAccess: true });
  });

  it('is idempotent, and refuses a conflicting existing record', async () => {
    const again = await lib.importBundle(payload, bundle() as any, opts());
    expect(again.created).toEqual([]);
    expect(again.skipped).toHaveLength(5);
    // A re-run journals nothing, so its cleanup can never delete pre-existing records.
    expect(again.journal.created).toEqual([]);
    expect((await lib.cleanupImport(payload, again.journal, { env })).deleted).toEqual([]);
    expect(await countAll()).toBe(5);
    const changed = bundle();
    changed.collections.articles[1] = { ...changed.collections.articles[1], title: 'Different title' };
    changed.checksums[`articles:${ids.article2}`] = lib.checksum(changed.collections.articles[1]);
    await expect(lib.importBundle(payload, changed as any, opts())).rejects.toThrow(/Conflict/);
  });

  it('cleanup removes exactly what was imported', async () => {
    await lib.cleanupImport(payload, report.journal, { env });
    for (const { collection, id } of report.created) {
      expect(await payload.findByID({ collection, id, depth: 0, overrideAccess: true, disableErrors: true })).toBeNull();
    }
  });
});
