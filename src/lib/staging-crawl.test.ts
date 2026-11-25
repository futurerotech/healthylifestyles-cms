import { afterEach, describe, expect, it, vi } from 'vitest';
import { STAGING_ROBOTS_TAG, isIsolatedStaging, stagingRobotsHeaders } from './staging-crawl.mjs';
import robots from '../app/robots';
import nextConfig from '../../next.config.mjs';

afterEach(() => { vi.unstubAllEnvs(); });

describe('staging-only crawler protection', () => {
  it('production keeps its existing robots rules and sitemap', () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', '');
    expect(isIsolatedStaging(process.env)).toBe(false);
    expect(robots()).toEqual({
      rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin/'] }],
      sitemap: 'https://www.healthylifesstyles.com/sitemap.xml',
    });
  });

  it('production adds no X-Robots-Tag header', async () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', '');
    expect(stagingRobotsHeaders(process.env)).toEqual([]);
    const headers = (await nextConfig.headers?.()) ?? [];
    expect(JSON.stringify(headers)).not.toContain('X-Robots-Tag');
  });

  it('isolated staging disallows every crawler and advertises no sitemap', () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'true');
    expect(robots()).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] });
  });

  it('isolated staging sends noindex on every response path', async () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'true');
    const headers = (await nextConfig.headers?.()) ?? [];
    const entry = headers.find((h) => h.source === '/:path*' && h.headers.some((x) => x.key === 'X-Robots-Tag'));
    expect(entry?.headers.find((x) => x.key === 'X-Robots-Tag')?.value).toBe(STAGING_ROBOTS_TAG);
  });

  it('only the exact value "true" enables staging behavior', () => {
    for (const value of ['1', 'TRUE', 'yes', 'false']) {
      expect(isIsolatedStaging({ HLS_ISOLATED_STAGING: value })).toBe(false);
    }
  });
});
