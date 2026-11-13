import { describe, expect, it, vi } from 'vitest';
import { publishGateHook } from './publishGateHook';

const build = (draft?: boolean | string) => {
  const find = vi.fn(async () => ({ docs: [] }));
  const findByID = vi.fn(async () => ({ alt: 'Example image' }));
  const data = { title: ' ' };
  const args = {
    data,
    originalDoc: { id: 41, _status: 'published', title: 'Existing published guide', slug: 'example' },
    operation: 'update',
    req: { query: draft === undefined ? {} : { draft }, context: {}, payload: {
      find, findByID, logger: { warn: vi.fn() },
    } },
  } as unknown as Parameters<typeof publishGateHook>[0];
  return { args, data, find, findByID };
};

describe('publish gate: published parent may have an independent draft version', () => {
  it.each([true, 'true'] as const)('does not run publish checks for draft=%s', async draft => {
    const { args, data, find, findByID } = build(draft);
    await expect(publishGateHook(args)).resolves.toBe(data);
    expect(find).not.toHaveBeenCalled();
    expect(findByID).not.toHaveBeenCalled();
  });

  it('normal published update still enforces the original blocking quality gate', async () => {
    const { args, find } = build();
    await expect(publishGateHook(args)).rejects.toThrow(/Publish blocked by the SEO quality gate/);
    expect(find).toHaveBeenCalled();
  });

  it('draft=false never bypasses the real publishing gate', async () => {
    const { args, find } = build('false');
    await expect(publishGateHook(args)).rejects.toThrow(/Publish blocked by the SEO quality gate/);
    expect(find).toHaveBeenCalled();
  });
});
