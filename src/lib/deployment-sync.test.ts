// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { acknowledgedChanges, reconcileDeployedChanges, type ContentManifest } from './deployment-sync';
import { affectsPublicContent, trackPendingDelete, trackGlobalChange } from '../hooks/trackContentChange';

const manifest: ContentManifest = { version: 1, source: 'cms', buildStartedAt: '2026-10-15T12:00:00Z', collections: ['articles'], records: [{ collection: 'articles', docId: '1', updatedAt: '2026-10-15T11:00:00Z', path: '/wellness-hub/a', noIndex: false }] };
const event = (id: number, docId: string, changedAt: string) => ({ id, docId, collectionSlug: 'articles', changedAt });

describe('deployment acknowledgement', () => {
  it('acknowledges built edits and removals while preserving edits that arrived during a build', () => {
    const entries = [event(1, '1', '2026-10-15T11:00:00Z'), event(2, '1', '2026-10-15T13:00:00Z'), event(3, 'deleted', '2026-10-15T11:30:00Z'), event(4, 'deleted-later', '2026-10-15T12:01:00Z')];
    expect(acknowledgedChanges(manifest, entries).map((x) => x.id)).toEqual([1, 3]);
  });
  it('never acknowledges local fallbacks, missing collection snapshots, or invalid dates', () => {
    const entries = [event(1, '1', '2026-10-15T11:00:00Z')];
    expect(acknowledgedChanges({ ...manifest, source: 'local' }, entries)).toEqual([]);
    expect(acknowledgedChanges({ ...manifest, collections: [] }, entries)).toEqual([]);
    expect(acknowledgedChanges({ ...manifest, buildStartedAt: 'invalid' }, entries)).toEqual([]);
  });
  it('leaves every change pending after a failed or unavailable build', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    const payload = { find: vi.fn(), delete: vi.fn() };
    expect(await reconcileDeployedChanges(payload as any)).toEqual({ acknowledged: 0, verified: false });
    expect(payload.delete).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('deletes only acknowledged immutable entries and preserves concurrent changes', async () => {
    vi.stubEnv('SERVER_URL', 'https://cms.healthylifesstyles.com');
    vi.stubEnv('INDEXNOW_DISABLE', 'true');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...manifest, cmsOrigin: 'https://cms.healthylifesstyles.com' })));
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [event(1, '1', '2026-10-15T11:00:00Z'), event(2, '1', '2026-10-15T13:00:00Z')] }),
      delete: vi.fn().mockResolvedValue({}),
    };
    expect(await reconcileDeployedChanges(payload as any)).toEqual({ acknowledged: 1, verified: true });
    expect(payload.delete).toHaveBeenCalledTimes(1);
    expect(payload.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { and: [{ id: { equals: 1 } }, { changedAt: { equals: '2026-10-15T11:00:00Z' } }] } }));
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });
});

describe('public content lifecycle', () => {
  it('queues publications, unpublications and non-versioned metadata; ignores pure drafts', () => {
    expect(affectsPublicContent({ _status: 'draft' }, { _status: 'published' })).toBe(true);
    expect(affectsPublicContent({ _status: 'draft' }, { _status: 'draft' })).toBe(false);
    expect(affectsPublicContent({ _status: 'published' })).toBe(true);
    expect(affectsPublicContent({ kind: 'tool' })).toBe(true);
    expect(affectsPublicContent({ status: 'draft' }, { status: 'published' })).toBe(true);
  });
  it('queues deletions and global changes transactionally without a deploy request', async () => {
    const req = { payload: { create: vi.fn().mockResolvedValue({}) }, context: {} };
    await trackPendingDelete({ req, doc: { id: 1, _status: 'published' }, collection: { slug: 'articles' } } as any);
    await trackGlobalChange({ req, doc: { id: 1, updatedAt: '2026-10-15T11:00:00Z' }, global: { slug: 'settings' } } as any);
    expect(req.payload.create).toHaveBeenCalledWith(expect.objectContaining({ req, overrideAccess: true, data: expect.objectContaining({ collectionSlug: 'global:settings', changedAt: '2026-10-15T11:00:00Z' }) }));
    expect(req.payload.create).toHaveBeenCalledTimes(2);
  });
});
