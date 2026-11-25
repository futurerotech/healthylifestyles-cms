/**
 * Staging-only crawler protection. Isolated Hostinger staging serves a copy of
 * published content; it must never be indexed or compete with production.
 * Production (HLS_ISOLATED_STAGING unset) is unchanged: no extra header and
 * the normal robots rules.
 */
export const STAGING_ROBOTS_TAG = 'noindex, nofollow, noarchive';

/** @param {Record<string, string | undefined>} env */
export function isIsolatedStaging(env = process.env) {
  return env.HLS_ISOLATED_STAGING === 'true';
}

/** Next.js `headers()` entries: a noindex header on every staging response only. */
export function stagingRobotsHeaders(env = process.env) {
  if (!isIsolatedStaging(env)) return [];
  return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: STAGING_ROBOTS_TAG }] }];
}
