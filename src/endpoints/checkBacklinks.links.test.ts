// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { checkBacklinks } from './checkBacklinks';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function mockScan(body: string, targetPage = '/tools/bmi-calculator') {
  vi.stubEnv('HLS_ISOLATED_STAGING', 'false');
  vi.stubEnv('SITE_BASE_URL', 'https://www.healthylifesstyles.com');
  const update = vi.fn().mockResolvedValue({});
  const payload = {
    find: vi.fn().mockResolvedValue({ docs: [{ id: 7, sourceUrl: 'https://referrer.example/article', targetPage }] }),
    update,
    logger: { warn: vi.fn() },
  };
  const fetch = vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } }));
  vi.stubGlobal('fetch', fetch);
  return { payload, update, fetch };
}

it('does not mark a backlink live solely because the domain is in the text', async () => {
  const { payload, update } = mockScan('<p>healthylifesstyles.com</p>');
  const result = await checkBacklinks.handler({ user: { id: 1 }, headers: new Headers(), payload } as never);
  expect(await result.json()).toMatchObject({ checked: 1, live: 0, lost: 1, inconclusive: 0 });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 7, data: expect.objectContaining({ liveStatus: 'lost' }) }));
});

it('marks a real link to the recorded target live', async () => {
  const { payload, update } = mockScan('<a href="https://www.healthylifesstyles.com/tools/bmi-calculator">BMI</a>');
  const result = await checkBacklinks.handler({ user: { id: 1 }, headers: new Headers(), payload } as never);
  expect(await result.json()).toMatchObject({ checked: 1, live: 1, lost: 0 });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 7, data: expect.objectContaining({ liveStatus: 'live' }) }));
});

it('keeps existing backlink status if targetPage is malformed', async () => {
  const { payload, update } = mockScan('<a href="https://www.healthylifesstyles.com/tools/bmi-calculator">BMI</a>', 'https://wrong.example/');
  const result = await checkBacklinks.handler({ user: { id: 1 }, headers: new Headers(), payload } as never);
  expect(await result.json()).toMatchObject({ checked: 1, live: 0, lost: 0, inconclusive: 1 });
  expect(update).toHaveBeenCalledTimes(1);
  expect(update.mock.calls[0][0].data).not.toHaveProperty('liveStatus');
});
