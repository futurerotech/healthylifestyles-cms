import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscriberSyncDirect } from './subscriberSync';
import { checkBacklinksDirect } from './checkBacklinks';

afterEach(() => vi.unstubAllEnvs());

describe('collision-free Payload endpoint aliases', () => {
  it('preserves method and distinct path without weakening access control', () => {
    expect(subscriberSyncDirect.path).toBe('/subscriber-sync');
    expect(subscriberSyncDirect.method).toBe('post');
    expect(checkBacklinksDirect.path).toBe('/backlink-check');
    expect(checkBacklinksDirect.method).toBe('get');
  });

  it('denies incorrect subscriber shared secret in non-staging mode', async () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'false');
    vi.stubEnv('SYNC_SHARED_SECRET', 'synthetic-test-only-key');
    const request = new Request('https://cms.healthylifesstyles.com/api/subscriber-sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-secret': 'incorrect' },
      body: JSON.stringify({ email: 'no-write@example.invalid' }),
    });
    const create = vi.fn();
    const response = await subscriberSyncDirect.handler(Object.assign(request, {
      payload: { create, findGlobal: vi.fn() },
    }) as never);
    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts correct subscriber shared secret and performs only the synthetic create', async () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'false');
    vi.stubEnv('SYNC_SHARED_SECRET', 'synthetic-test-only-key');
    const create = vi.fn().mockResolvedValue({ id: 1 });
    const findGlobal = vi.fn().mockResolvedValue({ forwardOnCreate: false });
    const request = new Request('https://cms.healthylifesstyles.com/api/subscriber-sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-secret': 'synthetic-test-only-key' },
      body: JSON.stringify({ email: 'synthetic@example.invalid' }),
    });
    const result = await subscriberSyncDirect.handler(Object.assign(request, {
      payload: { create, findGlobal },
    }) as never);
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ ok: true, imported: 1, failed: 0, total: 1 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(findGlobal).toHaveBeenCalledTimes(1);
  });

  it('requires internal key for backlink checks and accepts a synthetic empty scan', async () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'false');
    vi.stubEnv('INTERNAL_API_KEY', 'synthetic-internal-only-key');
    const find = vi.fn().mockResolvedValue({ docs: [] });
    const payload = { find };
    const url = 'https://cms.healthylifesstyles.com/api/backlink-check';
    const denied = await checkBacklinksDirect.handler(Object.assign(new Request(url), { payload }) as never);
    expect(denied.status).toBe(401);
    expect(find).not.toHaveBeenCalled();

    const permitted = await checkBacklinksDirect.handler(Object.assign(new Request(url, {
      headers: { 'x-api-key': 'synthetic-internal-only-key' },
    }), { payload }) as never);
    expect(permitted.status).toBe(200);
    expect(await permitted.json()).toMatchObject({ ok: true, checked: 0 });
    expect(find).toHaveBeenCalledTimes(1);
  });

  it('fails closed on both aliases in isolated staging even with authorization', async () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'true');
    vi.stubEnv('INTERNAL_API_KEY', 'synthetic-internal-only-key');
    vi.stubEnv('SYNC_SHARED_SECRET', 'synthetic-test-only-key');
    const payload = { find: vi.fn(), findGlobal: vi.fn(), create: vi.fn() };
    const subscriber = await subscriberSyncDirect.handler(Object.assign(
      new Request('https://cms-qa.healthylifesstyles.com/api/subscriber-sync', {
        method: 'POST', headers: { 'x-sync-secret': 'synthetic-test-only-key' }, body: '{}',
      }), { payload },
    ) as never);
    const backlinks = await checkBacklinksDirect.handler(Object.assign(
      new Request('https://cms-qa.healthylifesstyles.com/api/backlink-check', {
        headers: { 'x-api-key': 'synthetic-internal-only-key' },
      }), { payload },
    ) as never);
    expect(subscriber.status).toBe(503);
    expect(backlinks.status).toBe(503);
    expect(payload.find).not.toHaveBeenCalled();
    expect(payload.findGlobal).not.toHaveBeenCalled();
    expect(payload.create).not.toHaveBeenCalled();
  });
});
