/** Staging importer: safety rules and the REAL entrypoint's denied paths (no database). */
import { describe, it, expect } from 'vitest';
import { toWritable, subsetEqual, validateBundle, assertImportRuntime, importBundle, IMPORT_ORDER, checksum } from './staging-import';

const populated = (id: number, extra = {}) => ({ id, slug: `s${id}`, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', ...extra });
const STAGING_URI = 'postgres://u:p@ep-plain-forest-bca0vqud-pooler.c-16.us-east-1.aws.neon.tech/neondb';
const PROD_URI = 'postgres://u:p@ep-lucky-voice-ad5egz8d.c-2.us-east-1.aws.neon.tech/neondb';
const stagingEnv = { HLS_ISOLATED_STAGING: 'true', HLS_STAGING_IMPORT_APPROVED: 'yes', HLS_STAGING_DB_HOST: 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech', DATABASE_URI: STAGING_URI } as NodeJS.ProcessEnv;
const mkBundle = (docs: any[] = [{ id: 1, slug: 'a', title: 'A' }]) => {
  const collections = { articles: docs };
  const checksums = Object.fromEntries(docs.map((d) => [`articles:${d.id}`, checksum(d)]));
  return { version: 1, sourceOrigin: 'https://cms.healthylifesstyles.com', scope: 'published public content only', collections, checksums } as any;
};
/** A fake Payload that records every database call; any call on a denied path is a failure. */
const spyPayload = (uri: string | null, over: Record<string, any> = {}) => {
  const calls: string[] = [];
  const rec = (n: string) => async (..._a: any[]) => { calls.push(n); return n === 'beginTransaction' ? 'tx1' : null; };
  const db: any = { allowIDOnCreate: undefined, poolOptions: uri ? { connectionString: uri } : undefined,
    beginTransaction: rec('beginTransaction'), commitTransaction: rec('commitTransaction'), rollbackTransaction: rec('rollbackTransaction'), create: rec('db.create'), sessions: {}, ...over };
  const payload = { db, findByID: rec('findByID'), create: rec('create'), delete: rec('delete'), find: rec('find') };
  return { payload, calls, db };
};

describe('toWritable / subsetEqual', () => {
  it('turns populated relations into IDs and keeps block rows intact', () => {
    const doc = { id: 27, createdAt: 'x', updatedAt: 'y', _status: 'published', title: 'T', primaryTool: populated(65), tags: [populated(3)],
      layout: [{ id: 'row1', blockType: 'toolEmbed', tool: populated(65) }] };
    expect(toWritable(doc)).toEqual({ id: 27, title: 'T', primaryTool: 65, tags: [3], layout: [{ id: 'row1', blockType: 'toolEmbed', tool: 65 }] });
  });
  it('accepts extra server defaults but never a changed exported value', () => {
    expect(subsetEqual({ a: 1, b: [{ x: 1 }] }, { a: 1, b: [{ x: 1, id: 'gen' }], extra: null })).toBe(true);
    expect(subsetEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(subsetEqual({ b: [1, 2] }, { b: [1] })).toBe(false);
  });
});

describe('canonical checksum (shared with the frontend exporter)', () => {
  it('is key-order independent and matches a fixed vector', () => {
    expect(checksum({ a: 1, b: { d: [1, { f: 2, e: 3 }], c: 'x' } })).toBe(checksum({ b: { c: 'x', d: [1, { e: 3, f: 2 }] }, a: 1 }));
    // Fixed vector: sha256 of '{"a":[1,{"c":3,"d":4}],"b":2}'. The frontend exporter test asserts the same value.
    expect(checksum({ b: 2, a: [1, { d: 4, c: 3 }] })).toBe('b90ecf34c980b7ce791e11520e8f83c0c20ddbc78be1ff95bd85fb7708edb05a');
  });
});

describe('validateBundle', () => {
  const opts = { requiredArticleIds: [1] };
  it('accepts a valid bundle', () => expect(() => validateBundle(mkBundle(), opts)).not.toThrow());
  it('rejects tampering, missing or orphan checksums, unauthorized fields, sources and scope', () => {
    const b = mkBundle(); b.collections.articles[0].title = 'tampered';
    expect(() => validateBundle(b, opts)).toThrow(/does not match its export checksum/);
    const reordered = mkBundle(); reordered.collections.articles[0] = { title: 'A', slug: 'a', id: 1 };
    expect(() => validateBundle(reordered, opts)).not.toThrow();
    expect(() => validateBundle({ ...mkBundle(), checksums: {} }, opts)).toThrow(/no export checksum/);
    expect(() => validateBundle({ ...mkBundle(), checksums: { ...mkBundle().checksums, 'articles:99': 'x' } }, opts)).toThrow(/without a record/);
    expect(() => validateBundle({ ...mkBundle(), extra: 1 }, opts)).toThrow(/Unauthorized bundle field/);
    expect(() => validateBundle({ ...mkBundle(), sourceOrigin: 'https://evil.example' }, opts)).toThrow(/source origin/);
    expect(() => validateBundle({ ...mkBundle(), scope: 'everything' }, opts)).toThrow(/scope/);
    expect(() => validateBundle({ ...mkBundle(), findings: [{ path: 'x', kind: 'email address' }] }, opts)).toThrow(/unreviewed/);
    expect(() => validateBundle(mkBundle([{ id: 1, slug: 'a', title: 'A', apiKey: 'k' }]), opts)).toThrow(/secret-looking field: apiKey/);
    expect(() => validateBundle(mkBundle([{ id: 1, slug: 'a', title: 'A', nested: [{ webhookUrl: 'x' }] }]), opts)).toThrow(/nested\[0\]\.webhookUrl/);
  });
  it('rejects private collections, duplicates, missing ids and missing required records', () => {
    for (const c of ['users', 'subscribers', 'leads', 'push-subscriptions', 'audit-log']) {
      expect(() => validateBundle({ ...mkBundle(), collections: { [c]: [] } }, opts)).toThrow(/not allowed/);
      expect(IMPORT_ORDER as readonly string[]).not.toContain(c);
    }
    expect(() => validateBundle(mkBundle([{ id: 1 }, { id: 1 }]), opts)).toThrow(/checksum|duplicate/);
    expect(() => validateBundle(mkBundle(), {})).toThrow(/missing required article records: 5, 7/);
  });
});

describe('importBundle entrypoint: denied paths perform zero database calls', () => {
  const bundle = mkBundle();
  const denied: [string, NodeJS.ProcessEnv, string | null, RegExp][] = [
    ['production DATABASE_URI', { ...stagingEnv, DATABASE_URI: PROD_URI }, PROD_URI, /production/],
    ['connected to production while env claims staging', stagingEnv, PROD_URI, /production/],
    ['connected database differs from env', stagingEnv, 'postgres://u:p@other.neon.tech/db', /differs/],
    ['unknown connection', stagingEnv, null, /cannot determine/],
    ['missing isolation flag', { ...stagingEnv, HLS_ISOLATED_STAGING: undefined }, STAGING_URI, /HLS_ISOLATED_STAGING/],
    ['missing owner approval', { ...stagingEnv, HLS_STAGING_IMPORT_APPROVED: undefined }, STAGING_URI, /approval/],
    ['wrong staging host', { ...stagingEnv, HLS_STAGING_DB_HOST: 'ep-other.neon.tech' }, STAGING_URI, /declared staging host/],
    ['IndexNow credential present', { ...stagingEnv, INDEXNOW_API_KEY: 'x' }, STAGING_URI, /INDEXNOW_API_KEY/],
    ['Google indexing credential present', { ...stagingEnv, GOOGLE_INDEXING_CREDENTIALS: 'x' }, STAGING_URI, /GOOGLE_INDEXING/],
    ['deploy hook present', { ...stagingEnv, VERCEL_DEPLOY_HOOK_URL: 'x' }, STAGING_URI, /VERCEL_DEPLOY_HOOK_URL/],
  ];
  for (const [name, env, uri, msg] of denied) it(`refuses: ${name}`, async () => {
    const { payload, calls, db } = spyPayload(uri);
    await expect(importBundle(payload, bundle, { env, requiredArticleIds: [1] })).rejects.toThrow(msg);
    expect(calls).toEqual([]);
    expect(db.allowIDOnCreate).toBeUndefined();
  });
  it('refuses an invalid bundle before any database call', async () => {
    const { payload, calls } = spyPayload(STAGING_URI);
    const b = mkBundle(); b.checksums['articles:1'] = '0'.repeat(64);
    await expect(importBundle(payload, b, { env: stagingEnv, requiredArticleIds: [1] })).rejects.toThrow(/checksum/);
    expect(calls).toEqual([]);
  });
  it('restores allowIDOnCreate when beginTransaction fails, and writes nothing', async () => {
    const { payload, calls, db } = spyPayload(STAGING_URI, { allowIDOnCreate: false, beginTransaction: async () => { throw new Error('begin failed'); } });
    await expect(importBundle(payload, bundle, { env: stagingEnv, requiredArticleIds: [1] })).rejects.toThrow(/begin failed/);
    expect(db.allowIDOnCreate).toBe(false);
    expect(calls).toEqual([]);
  });
  it('refuses when the adapter opens no transaction, and restores the flag', async () => {
    const { payload, calls, db } = spyPayload(STAGING_URI, { beginTransaction: async () => null });
    await expect(importBundle(payload, bundle, { env: stagingEnv, requiredArticleIds: [1] })).rejects.toThrow(/did not open a transaction/);
    expect(db.allowIDOnCreate).toBeUndefined();
    expect(calls).toEqual([]);
  });
});

describe('assertImportRuntime', () => {
  it('allows only the declared isolated staging database with owner approval', () => expect(() => assertImportRuntime({ env: stagingEnv })).not.toThrow());
});
