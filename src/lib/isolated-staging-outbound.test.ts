import { afterEach, describe, expect, it, vi } from 'vitest';
import { denyIsolatedStagingOutbound } from './isolated-staging-outbound';

afterEach(() => vi.unstubAllEnvs());
describe('isolated staging external integrations', () => {
  it('keeps normal production and development behavior unchanged', () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'false');
    expect(denyIsolatedStagingOutbound()).toBeNull();
    vi.stubEnv('HLS_ISOLATED_STAGING', '');
    expect(denyIsolatedStagingOutbound()).toBeNull();
  });
  it('fails closed before any external provider call when staging is opted in', async () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'true');
    const response = denyIsolatedStagingOutbound();
    expect(response?.status).toBe(503);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    await expect(response?.json()).resolves.toMatchObject({ ok: false });
  });
});
