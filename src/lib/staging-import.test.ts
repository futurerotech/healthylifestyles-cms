/** Staging importer: pure safety rules (no database). */
import { describe, it, expect } from 'vitest';
import { toWritable, subsetEqual, validateBundle, assertImportRuntime, IMPORT_ORDER, checksum } from './staging-import';

const populated = (id: number, extra = {}) => ({ id, slug: `s${id}`, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', ...extra });

describe('toWritable', () => {
  it('turns populated relations into IDs and keeps block rows intact', () => {
    const doc = { id: 27, createdAt: 'x', updatedAt: 'y', _status: 'published', title: 'T', primaryTool: populated(65), tags: [populated(3), populated(4)],
      layout: [{ id: 'row1', blockType: 'toolEmbed', tool: populated(65) }, { id: 'row2', blockType: 'text', body: 'b' }] };
    expect(toWritable(doc)).toEqual({ id: 27, title: 'T', primaryTool: 65, tags: [3, 4],
      layout: [{ id: 'row1', blockType: 'toolEmbed', tool: 65 }, { id: 'row2', blockType: 'text', body: 'b' }] });
  });
});

describe('subsetEqual', () => {
  it('accepts extra server defaults but never a changed exported value', () => {
    expect(subsetEqual({ a: 1, b: [{ x: 1 }] }, { a: 1, b: [{ x: 1, id: 'gen' }], extra: null })).toBe(true);
    expect(subsetEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(subsetEqual({ b: [1, 2] }, { b: [1] })).toBe(false);
    expect(subsetEqual({ a: null }, {})).toBe(true);
    expect(subsetEqual({ a: 'x' }, {})).toBe(false);
  });
});

describe('validateBundle', () => {
  const ok = { version: 1, sourceOrigin: 'https://cms.healthylifesstyles.com', collections: { articles: [{ id: 1 }] }, checksums: { 'articles:1': 'c' } };
  it('accepts an allowlisted bundle', () => expect(() => validateBundle(ok as any)).not.toThrow());
  it('refuses private collections, duplicates, missing ids and missing checksums', () => {
    for (const c of ['users', 'subscribers', 'leads', 'push-subscriptions', 'audit-log']) {
      expect(() => validateBundle({ ...ok, collections: { [c]: [] } } as any)).toThrow(/not allowed/);
      expect(IMPORT_ORDER as readonly string[]).not.toContain(c);
    }
    expect(() => validateBundle({ ...ok, collections: { articles: [{ id: 1 }, { id: 1 }] } } as any)).toThrow(/duplicate/);
    expect(() => validateBundle({ ...ok, collections: { articles: [{}] } } as any)).toThrow(/without id/);
    expect(() => validateBundle({ ...ok, checksums: {} } as any)).toThrow(/no export checksum/);
    expect(() => validateBundle({ ...ok, version: 2 } as any)).toThrow(/Invalid/);
  });
});

describe('assertImportRuntime', () => {
  const staging = { HLS_ISOLATED_STAGING: 'true', HLS_STAGING_IMPORT_APPROVED: 'yes', HLS_STAGING_DB_HOST: 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech',
    DATABASE_URI: 'postgres://u:p@ep-plain-forest-bca0vqud-pooler.c-16.us-east-1.aws.neon.tech/neondb' } as NodeJS.ProcessEnv;
  it('allows only the declared isolated staging database with owner approval', () => {
    expect(() => assertImportRuntime({ env: staging })).not.toThrow();
  });
  it('refuses production, unapproved, undeclared or outbound-capable runtimes', () => {
    expect(() => assertImportRuntime({ env: { ...staging, DATABASE_URI: 'postgres://u:p@ep-lucky-voice-ad5egz8d.c-2.us-east-1.aws.neon.tech/neondb' } })).toThrow(/production/);
    expect(() => assertImportRuntime({ env: { ...staging, HLS_ISOLATED_STAGING: undefined } })).toThrow(/HLS_ISOLATED_STAGING/);
    expect(() => assertImportRuntime({ env: { ...staging, HLS_STAGING_IMPORT_APPROVED: undefined } })).toThrow(/approval/);
    expect(() => assertImportRuntime({ env: { ...staging, DATABASE_URI: 'postgres://u:p@other.neon.tech/db' } })).toThrow(/declared staging host/);
    for (const k of ['INDEXNOW_API_KEY', 'GOOGLE_INDEXING_CREDENTIALS', 'VERCEL_DEPLOY_HOOK_URL']) expect(() => assertImportRuntime({ env: { ...staging, [k]: 'x' } })).toThrow(new RegExp(k));
  });
  it('checksums are key-order independent', () => expect(checksum({ a: 1, b: 2 })).toBe(checksum({ b: 2, a: 1 })));
});
