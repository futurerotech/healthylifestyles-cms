// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { validatePublicRoute } from './route-validation';
import { findBrokenInternalLinks } from './publishGate';
import { readDeployedManifest } from './deployment-sync';

describe('public URL namespace', () => {
  it('rejects unimplemented published tools, reserved pages and cross-collection collisions', async () => {
    const req = { payload: { find: vi.fn().mockResolvedValue({ totalDocs: 0 }) } };
    await expect(validatePublicRoute({ req, collection: { slug: 'tools' }, data: { slug: 'not-implemented', enabled: true, _status: 'published' } } as any)).rejects.toThrow('Implement');
    await expect(validatePublicRoute({ req, collection: { slug: 'pages' }, data: { slug: 'about' } } as any)).rejects.toThrow('reserved');
    req.payload.find.mockResolvedValue({ totalDocs: 1 });
    await expect(validatePublicRoute({ req, collection: { slug: 'articles' }, data: { slug: 'nutrition' } } as any)).rejects.toThrow('already used');
  });
  it('does not treat a database slug as proof of an implemented tool', () => {
    const ctx = { toolSlugs: new Set(['not-implemented', 'body-fat-calculator']), articleSlugs: new Set<string>(), categorySlugs: new Set<string>() };
    expect(findBrokenInternalLinks(['/tools/not-implemented', '/tools/body-fat-percentage-calculator'], ctx)).toEqual(['/tools/not-implemented']);
  });
  it('rejects publication receipts from another CMS instance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ version: 1, source: 'cms', cmsOrigin: 'https://unrelated.test', collections: [], records: [] })));
    await expect(readDeployedManifest()).rejects.toThrow('this CMS');
    vi.unstubAllGlobals();
  });
});
