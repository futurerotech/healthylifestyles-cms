import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { trackPendingChange } from './trackPendingChange';
import { afterPublishPushHook } from '../lib/push';
import { recordPublishedPendingChange } from '../lib/indexnow-pending-queue';
vi.mock('../lib/indexnow-pending-queue', () => ({ recordPublishedPendingChange: vi.fn(async () => 'inserted') }));
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));
const makeArgs = (slug: string, draft: unknown, status = 'published', previousStatus = 'draft') => ({
  doc: { id: 41, slug: 'example', title: 'Example', _status: status },
  previousDoc: { _status: previousStatus },
  collection: { slug },
  req: { query: { draft }, transactionID: 123, payload: { db: {}, findGlobal: vi.fn(async () => ({ pushEnabled: false })), create: vi.fn(), find: vi.fn(), update: vi.fn() } },
}) as any;
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());
describe('combined PR34 queue and PR61 push hook wiring', () => {
  it.each(['articles','tools'])('%s draft creation, edit and unpublish do not queue', async slug => {
    for (const previousStatus of ['draft', 'published']) {
      const args = makeArgs(slug, undefined, 'draft', previousStatus);
      await trackPendingChange(args);
      if (slug === 'articles') await afterPublishPushHook(args);
      expect(recordPublishedPendingChange).not.toHaveBeenCalled();
      expect(args.req.payload.findGlobal).not.toHaveBeenCalled();
      expect(args.req.payload.create).not.toHaveBeenCalled();
      expect(args.req.payload.update).not.toHaveBeenCalled();
    }
  });
  it.each(['articles','tools'])('%s draft save does not queue or write', async slug => {
    for (const draft of [true, 'true']) {
      const args = makeArgs(slug, draft);
      await trackPendingChange(args);
      if (slug === 'articles') await afterPublishPushHook(args);
      expect(recordPublishedPendingChange).not.toHaveBeenCalled();
      expect(args.req.payload.findGlobal).not.toHaveBeenCalled();
      expect(args.req.payload.create).not.toHaveBeenCalled();
    }
  });
  it.each(['articles','tools'])('%s isolated staging does not queue or write', async slug => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'true');
    const args = makeArgs(slug, undefined);
    await trackPendingChange(args);
    if (slug === 'articles') await afterPublishPushHook(args);
    expect(recordPublishedPendingChange).not.toHaveBeenCalled();
    expect(args.req.payload.findGlobal).not.toHaveBeenCalled();
    expect(args.req.payload.create).not.toHaveBeenCalled();
  });
  it.each(['articles','tools'])('%s published change queues', async slug => {
    const args = makeArgs(slug, undefined);
    await trackPendingChange(args);
    if (slug === 'articles') await afterPublishPushHook(args);
    expect(recordPublishedPendingChange).toHaveBeenCalledTimes(1);
    if (slug === 'articles') expect(args.req.payload.findGlobal).toHaveBeenCalledTimes(1);
  });
  it('published article edits queue but do not trigger publish push', async () => {
    const args = makeArgs('articles', undefined, 'published', 'published');
    await trackPendingChange(args);
    await afterPublishPushHook(args);
    expect(recordPublishedPendingChange).toHaveBeenCalledTimes(1);
    expect(args.req.payload.findGlobal).not.toHaveBeenCalled();
  });
});

