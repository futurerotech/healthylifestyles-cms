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

const stripSlash = (v: string): string => v.replace(/\/+$/, '');

/** Normalized (no trailing slash) + deduped whitelist, for cors/csrf and route checks. */
export const ALLOWED_ORIGINS: string[] = [
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
