import { afterEach, describe, expect, it, vi } from 'vitest';

const STAGE = 'https://cms-qa.healthylifesstyles.com';
const LIVE = 'https://cms.healthylifesstyles.com';
function setProductionEnvironment() {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('HLS_STAGING_CMS_ORIGIN', STAGE);
  vi.stubEnv('SERVER_URL', STAGE);
  vi.stubEnv('INDEXNOW_DISABLE', 'true');
  vi.stubEnv('INDEXNOW_LIVE_ENABLED', 'false');
  vi.stubEnv('VERCEL_DEPLOY_HOOK_URL', undefined);
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe('Isolated staging CORS/CSRF configuration', () => {
  it('keeps live CMS origins and mutation protections when staging is not enabled', async () => {
    setProductionEnvironment();
    vi.stubEnv('HLS_ISOLATED_STAGING', 'false');
    vi.stubEnv('SERVER_URL', LIVE);
    vi.resetModules();
    const mod = await import('./allowedOrigins');
    expect(mod.ISOLATED_STAGING_CMS_ORIGIN).toBeNull();
    expect(mod.ALLOWED_ORIGINS).toContain(LIVE);
    expect(mod.ALLOWED_ORIGINS).not.toContain(STAGE);
    expect(mod.isAllowedAdminMutationOrigin(LIVE)).toBe(true);
    expect(mod.isAllowedAdminMutationOrigin(STAGE)).toBe(false);
    expect(mod.isAllowedIndexNowPreviewOrigin(LIVE)).toBe(true);
    expect(mod.isAllowedIndexNowPreviewOrigin(STAGE)).toBe(false);
    expect(mod.isAllowedIndexNowPreviewOrigin('https://www.healthylifesstyles.com')).toBe(false);
  });

  it('only trusts the isolated staging origin for browser CORS/CSRF', async () => {
    setProductionEnvironment();
    vi.stubEnv('HLS_ISOLATED_STAGING', 'true');
    vi.resetModules();
    const mod = await import('./allowedOrigins');
    expect(mod.ISOLATED_STAGING_CMS_ORIGIN).toBe(STAGE);
    expect(mod.ALLOWED_ORIGINS).toEqual([STAGE]);
    expect(mod.isAllowedOrigin(STAGE)).toBe(true);
    expect(mod.isAllowedOrigin(LIVE)).toBe(false);
    // Staging must NEVER be able to initiate the live Vercel deploy route.
    expect(mod.isAllowedAdminMutationOrigin(STAGE)).toBe(false);
    expect(mod.isAllowedIndexNowPreviewOrigin(STAGE)).toBe(true);
    expect(mod.isAllowedIndexNowPreviewOrigin(LIVE)).toBe(false);
    expect(mod.isAllowedIndexNowPreviewOrigin('https://www.healthylifesstyles.com')).toBe(false);
    expect(mod.isAllowedIndexNowPreviewOrigin(undefined)).toBe(false);
  });

  it('fails startup on missing disable flag, mismatched URL or live deploy hook', async () => {
    const { resolveIsolatedStagingCmsOrigin } = await import('./allowedOrigins');
    const safe = {
      mode: 'true', cmsOrigin: STAGE, serverURL: STAGE,
      indexNowDisabled: 'true', indexNowLiveEnabled: 'false',
      deployHook: undefined,
    };
    expect(resolveIsolatedStagingCmsOrigin(safe)).toBe(STAGE);
    for (const invalid of [
      { ...safe, cmsOrigin: LIVE, serverURL: LIVE },
      { ...safe, cmsOrigin: 'https://www.healthylifesstyles.com',
                 serverURL: 'https://www.healthylifesstyles.com' },
      { ...safe, cmsOrigin: 'http://cms-qa.healthylifesstyles.com' },
      { ...safe, cmsOrigin: 'https://cms-qa.healthylifesstyles.com:8443' },
      { ...safe, cmsOrigin: 'https://cms-qa.healthylifesstyles.com/path' },
      { ...safe, cmsOrigin: 'https://cms-qa.otherdomain.test',
                 serverURL: 'https://cms-qa.otherdomain.test' },
      { ...safe, serverURL: LIVE },
      { ...safe, indexNowDisabled: undefined },
      { ...safe, indexNowLiveEnabled: 'true' },
      { ...safe, deployHook: 'https://api.vercel.com/webhooks/deploy' },
    ]) expect(() => resolveIsolatedStagingCmsOrigin(invalid)).toThrow();
    expect(() => resolveIsolatedStagingCmsOrigin({ ...safe, mode: 'false' })).toThrow(/requires HLS_ISOLATED_STAGING/);
    expect(() => resolveIsolatedStagingCmsOrigin({ ...safe, mode: undefined })).toThrow(/requires HLS_ISOLATED_STAGING/);
    expect(resolveIsolatedStagingCmsOrigin({ ...safe, mode: 'false', serverURL: LIVE })).toBeNull();
  });
});
