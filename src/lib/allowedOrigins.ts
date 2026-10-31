/**
 * Single source of truth for the browser origins this CMS trusts (Phase 11 —
 * extracted from the inline lists the CORS/CSRF fix left in payload.config.ts
 * and the deploy route, so the whitelist can never fork again).
 *
 * NEXT_PUBLIC_SITE_URL remains the FRONTEND origin (GSC/pSEO/site-audit tooling
 * consume it as such); it is included only so a per-environment override keeps
 * working. Both canonical domains are pinned so a missing or slash-suffixed env
 * var can never lock the admin (or the frontend) out. Localhost dev servers are
 * allowed OUTSIDE production only.
 */
const IS_PROD = process.env.NODE_ENV === 'production';

/** This CMS's own origin (admin panel + API). The double "ss" is correct. */
export const CMS_ORIGIN = 'https://cms.healthylifesstyles.com';
/** The Astro frontend that consumes this CMS at build/runtime. */
export const FRONTEND_ORIGIN = 'https://www.healthylifesstyles.com';


/**
 * Isolated Hostinger staging must be opt-in. Its production-mode browser
 * requests should be same-origin to the staging CMS, NOT trusted to use the
 * live admin's CORS/CSRF origins. This does not attest database isolation.
 *
 * External deploy and IndexNow sends stay separately disabled.
 */
export function resolveIsolatedStagingCmsOrigin(env: {
  mode?: string;
  cmsOrigin?: string;
  serverURL?: string;
  indexNowDisabled?: string;
  indexNowLiveEnabled?: string;
  deployHook?: string;
}): string | null {
  if (env.mode !== 'true') {
    // Staging protection must not be bypassed by accidentally omitting its
    // opt-in flag. Any owned, nonproduction HTTPS CMS subdomain used as
    // SERVER_URL must explicitly opt into the isolation checks below.
    let serverHost = '';
    try {
      if (env.serverURL) {
        const configured = new URL(env.serverURL);
        if (configured.protocol === 'https:') serverHost = configured.hostname.toLowerCase();
      }
    } catch {
      // The ordinary (non-staging) config handles malformed URLs separately.
    }
    if (serverHost.endsWith('.healthylifesstyles.com') &&
        serverHost !== 'cms.healthylifesstyles.com' &&
        serverHost !== 'www.healthylifesstyles.com') {
      throw new Error('Owned staging CMS origin requires HLS_ISOLATED_STAGING=true; startup refused');
    }
    return null;
  }
  const requested = env.cmsOrigin;
  if (typeof requested !== 'string' || requested.length > 253) {
    throw new Error('Isolated staging requires an explicit CMS HTTPS origin');
  }
  let url: URL;
  try { url = new URL(requested); }
  catch { throw new Error('Invalid isolated staging CMS URL'); }

  const host = url.hostname.toLowerCase();
  const validSubdomain = host.endsWith('.healthylifesstyles.com') &&
    host !== 'cms.healthylifesstyles.com' &&
    host !== 'www.healthylifesstyles.com';
  if (url.protocol !== 'https:' || url.origin !== requested ||
      url.username || url.password || url.search || url.hash ||
      url.pathname !== '/' || url.port || !validSubdomain ||
      env.serverURL !== requested ||
      env.indexNowDisabled !== 'true' ||
      env.indexNowLiveEnabled === 'true' ||
      Boolean(env.deployHook?.trim())) {
    throw new Error('Isolated staging cannot start with unsafe origin or live-provider configuration');
  }
  return requested;
}

/** Production defaults are unchanged when isolated staging is not opted into. */
export const ISOLATED_STAGING_CMS_ORIGIN = resolveIsolatedStagingCmsOrigin({
  mode: process.env.HLS_ISOLATED_STAGING,
  cmsOrigin: process.env.HLS_STAGING_CMS_ORIGIN,
  serverURL: process.env.SERVER_URL,
  indexNowDisabled: process.env.INDEXNOW_DISABLE,
  indexNowLiveEnabled: process.env.INDEXNOW_LIVE_ENABLED,
  deployHook: process.env.VERCEL_DEPLOY_HOOK_URL,
});

const stripSlash = (v: string): string => v.replace(/\/+$/, '');

/** Normalized (no trailing slash) + deduped whitelist, for cors/csrf and route checks. */
export const ALLOWED_ORIGINS: string[] = ISOLATED_STAGING_CMS_ORIGIN
  ? [ISOLATED_STAGING_CMS_ORIGIN]
  : [
      CMS_ORIGIN,
      FRONTEND_ORIGIN,
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4321',
      ...(IS_PROD ? [] : ['http://localhost:4321', 'http://localhost:3000']),
    ]
  .map(stripSlash)
  .filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

const ALLOWED_SET = new Set(ALLOWED_ORIGINS);

/**
 * Is this Origin header value one of ours? (Trailing slash tolerated.)
 * Callers decide the missing-header policy themselves: state-changing POSTs
 * should REJECT a missing Origin (same-origin POSTs always send it), while
 * read-only same-origin GETs must ALLOW it (browsers omit Origin there).
 */
export const isAllowedOrigin = (origin: string | null | undefined): boolean =>
  Boolean(origin) && ALLOWED_SET.has(stripSlash(origin as string));

/**
 * Privileged browser POSTs may originate ONLY from the CMS in production.
 * The frontend is intentionally trusted for CORS/CSRF generally, but that
 * must not grant it authority to initiate a Vercel deployment.
 * Non-production keeps the established local development origin allowlist.
 */
export const isAllowedAdminMutationOrigin = (
  origin: string | null | undefined,
  isProduction = IS_PROD,
): boolean =>
  isAllowedOrigin(origin) && (!isProduction || origin === CMS_ORIGIN);

/**
 * Staging can make an admin-authenticated, READ-ONLY IndexNow preview request,
 * without allowing privileged Vercel deploys or confirmed IndexNow submits.
 */
export const isAllowedIndexNowPreviewOrigin = (
  origin: string | null | undefined,
  isProduction = IS_PROD,
): boolean =>
  isAllowedOrigin(origin) &&
  (ISOLATED_STAGING_CMS_ORIGIN
    ? origin === ISOLATED_STAGING_CMS_ORIGIN
    : !isProduction || origin === CMS_ORIGIN);

