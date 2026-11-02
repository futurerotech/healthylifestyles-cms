// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { checkBacklinks } from './checkBacklinks';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('times out while reading a stalled response body without marking the backlink lost', async () => {
  vi.useFakeTimers();
  vi.stubEnv('HLS_ISOLATED_STAGING', 'false');
  const update = vi.fn().mockResolvedValue({});
  const payload = { find: vi.fn().mockResolvedValue({ docs: [{ id: 1, sourceUrl: 'https://example.invalid/' }] }), update, logger: { warn: vi.fn() } };
  let signal: AbortSignal | undefined;
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, options: { signal: AbortSignal }) => {
    signal = options.signal;
    return { ok: true, status: 200, text: () => new Promise<string>((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }) };
  }));
  const req = { user: { id: 1 }, payload, headers: new Headers() };
  const pending = checkBacklinks.handler(req as never);
  await vi.advanceTimersByTimeAsync(8001);
  expect(signal?.aborted).toBe(true);
  const response = await pending;
  expect(await response.json()).toMatchObject({ checked: 1, lost: 0, inconclusive: 1 });
  expect(update).toHaveBeenCalledOnce();
  expect(update.mock.calls[0][0].data).not.toHaveProperty('liveStatus');
});
