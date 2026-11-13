// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queueIndexNowPing } from '../lib/indexnow';
import { afterPublishPushHook } from '../lib/push';
import { notifyIndexNow } from './notifyIndexNow';
import { trackPendingChange } from './trackPendingChange';

// Never contact a real provider or schedule a debounce timer from these tests.
vi.mock('../lib/indexnow', () => ({ queueIndexNowPing: vi.fn() }));

const request = (draft?: boolean | string) => ({
  query: draft === undefined ? {} : { draft },
  payload: {
    find: vi.fn(async () => ({ totalDocs: 0, docs: [] })),
    update: vi.fn(async () => ({ id: 1 })),
    create: vi.fn(async () => ({ id: 1 })),
    findGlobal: vi.fn(async () => ({ pushEnabled: false, autoPushOnPublish: false })),
  },
});

async function runAll({ status = 'published', previous = 'draft', draft, operation = 'update' }: {
  status?: string;
  previous?: string;
  draft?: boolean | string;
  operation?: string;
} = {}) {
  const req = request(draft);
  const doc = { id: 41, slug: 'what-does-your-push-up-test-score-mean', title: 'Push-Up Test', _status: status };
  const previousDoc = { _status: previous };
  const collection = { slug: 'articles' };
  const args = { req, doc, previousDoc, collection, operation } as never;
  await notifyIndexNow(args);
  await trackPendingChange(args);
  await afterPublishPushHook(args);
  return { req, doc };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe('draft-version side effects across the original CMS hooks', () => {
  it.each([true, 'true'] as const)('draft=%s with a published parent makes no indexing, pending-deploy, or push writes', async draft => {
    const { req } = await runAll({ draft });
    expect(queueIndexNowPing).not.toHaveBeenCalled();
    expect(req.payload.find).not.toHaveBeenCalled();
    expect(req.payload.update).not.toHaveBeenCalled();
    expect(req.payload.create).not.toHaveBeenCalled();
    expect(req.payload.findGlobal).not.toHaveBeenCalled();
  });

  it('a regular draft document cannot trigger publishing side effects', async () => {
    const { req } = await runAll({ status: 'draft', previous: 'published' });
    expect(queueIndexNowPing).not.toHaveBeenCalled();
    expect(req.payload.find).not.toHaveBeenCalled();
    expect(req.payload.update).not.toHaveBeenCalled();
    expect(req.payload.create).not.toHaveBeenCalled();
    expect(req.payload.findGlobal).not.toHaveBeenCalled();
  });

  it('an isolated staging runtime cannot enqueue production indexing, push, or rebuilds', async () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'true');
    const { req } = await runAll();
    expect(queueIndexNowPing).not.toHaveBeenCalled();
    expect(req.payload.find).not.toHaveBeenCalled();
    expect(req.payload.update).not.toHaveBeenCalled();
    expect(req.payload.create).not.toHaveBeenCalled();
    expect(req.payload.findGlobal).not.toHaveBeenCalled();
  });

  it('real first publish retains the established paths (with mocked providers)', async () => {
    const { req } = await runAll();
    expect(queueIndexNowPing).toHaveBeenCalledExactlyOnceWith(['/wellness-hub/what-does-your-push-up-test-score-mean']);
    expect(req.payload.find).toHaveBeenCalledOnce();
    expect(req.payload.create).toHaveBeenCalledWith(expect.objectContaining({ collection: 'pending-deploys' }));
    expect(req.payload.findGlobal).toHaveBeenCalledWith({ slug: 'audience', depth: 0 });
  });

  it('an update of an already-published article never creates a duplicate publish push or IndexNow transition', async () => {
    const { req } = await runAll({ previous: 'published' });
    expect(queueIndexNowPing).not.toHaveBeenCalled();
    expect(req.payload.findGlobal).not.toHaveBeenCalled();
    // Normal published content edits still enter the expected pending-deploy pipeline.
    expect(req.payload.find).toHaveBeenCalledOnce();
  });
});
