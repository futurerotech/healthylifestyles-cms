import { afterEach, describe, expect, it, vi } from 'vitest';
import { afterPublishPushHook } from './push';

afterEach(() => vi.unstubAllEnvs());

const makeInput = (draft?: boolean | string) => {
  const findGlobal = vi.fn().mockResolvedValue({ pushEnabled: false, autoPushOnPublish: false });
  const create = vi.fn();
  const payload = { findGlobal, create, find: vi.fn(), delete: vi.fn() };
  const input = {
    doc: { id: 41, title: 'Existing wellness article', slug: 'example', _status: 'published' },
    previousDoc: { _status: 'draft' },
    operation: 'update',
    collection: { slug: 'articles' },
    req: { payload, query: draft === undefined ? {} : { draft } },
  } as unknown as Parameters<typeof afterPublishPushHook>[0];
  return { input, findGlobal, create, payload };
};

describe('published article push hook draft isolation', () => {
  it.each([true, 'true'] as const)('draft=%s with published parent never calls audience or push', async draft => {
    const { input, findGlobal, create, payload } = makeInput(draft);
    await expect(afterPublishPushHook(input)).resolves.toBeUndefined();
    expect(findGlobal).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(payload.find).not.toHaveBeenCalled();
  });

  it('isolated staging does not contact push audience even on published transition', async () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'true');
    const { input, findGlobal, create } = makeInput();
    await expect(afterPublishPushHook(input)).resolves.toBeUndefined();
    expect(findGlobal).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('normal published transition still checks the audience without sending a push', async () => {
    const { input, findGlobal, create } = makeInput();
    await expect(afterPublishPushHook(input)).resolves.toBeUndefined();
    expect(findGlobal).toHaveBeenCalledExactlyOnceWith({ slug: 'audience', depth: 0 });
    expect(create).not.toHaveBeenCalled();
  });

  it('already-published updates remain side-effect free', async () => {
    const { input, findGlobal } = makeInput();
    (input as { previousDoc: { _status: string } }).previousDoc._status = 'published';
    await expect(afterPublishPushHook(input)).resolves.toBeUndefined();
    expect(findGlobal).not.toHaveBeenCalled();
  });
});
