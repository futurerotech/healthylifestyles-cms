import { describe, expect, it, vi } from 'vitest';
import { buildGateContext, publishGateHook } from './publishGateHook';
import { findBrokenInternalLinks } from '../lib/publishGate';

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

describe('publish gate completeness with failed and paginated catalog queries', () => {
  it('treats one failed source as unknown without suppressing other known link failures', async () => {
    const find = vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'tools') throw new Error('simulated tools database error');
      return { docs: [{ slug: 'existing' }], totalDocs: 1 };
    });
    const c = await buildGateContext({ find, findByID: vi.fn() } as never, null);
    expect(c.toolSlugsComplete).toBe(false);
    expect(c.articleSlugsComplete).toBe(true);
    expect(findBrokenInternalLinks(['/tools/maybe-exists','/wellness-hub/clearly-missing'],c))
      .toEqual(['/wellness-hub/clearly-missing']);
  });
  it('does not falsely block a slug absent from a truncated first result page', async () => {
    const find = vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'tools'
        ? { docs: [{ slug: 'first' }], hasNextPage: true, totalDocs: 10 }
        : { docs: [{ slug: 'existing' }], hasNextPage: false, totalDocs: 1 });
    const c = await buildGateContext({ find, findByID: vi.fn() } as never, null);
    expect(c.toolSlugsComplete).toBe(false);
    expect(findBrokenInternalLinks(['/tools/later-page'],c)).toEqual([]);
  });
  it('still rejects missing targets after complete, genuinely empty queries', async () => {
    const find = vi.fn(async () => ({ docs: [], hasNextPage: false, totalDocs: 0 }));
    const c = await buildGateContext({ find, findByID: vi.fn() } as never, null);
    expect(c.toolSlugsComplete).toBe(true);
    expect(c.categorySlugsComplete).toBe(true);
    expect(findBrokenInternalLinks(['/tools/missing','/wellness-hub/missing'],c))
      .toEqual(['/tools/missing','/wellness-hub/missing']);
  });
});
