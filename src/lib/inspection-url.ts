/**
 * Inspection-URL normalization (HOTFIX 2, H2-TASK 1).
 *
 * Every URL headed for GSC urlInspection must be absolute, on the CANONICAL
 * page origin, and normalized — the Permission-denied storm traced back to
 * URLs built on the wrong origin (apex instead of www) reaching Google with a
 * mismatched property. This is the single boundary where raw values become
 * inspection-safe URLs; the property-membership guard then runs on the result.
 *
 * Rules:
 *  - relative path ("/x/y")            → resolved against the canonical origin
 *  - absolute, canonical host          → normalized as-is
 *  - absolute, APEX of canonical host  → host rewritten to canonical
 *    (heals the known apex-vs-www data class — same registrable domain,
 *    unambiguous canonical)
 *  - any other origin (cms. subdomain, foreign domain, http://) → typed
 *    LocalValidationError naming the offending origin — NEVER sent to Google
 *  - empty / malformed                 → typed LocalValidationError
 * Normalization: lowercase host (URL does this), duplicate slashes collapsed,
 * fragments dropped. Pure: pass `origin` explicitly in tests.
 */
import { GSC_SITE_URL, SITE_BASE_URL } from './site-config';

/** A URL rejected before any Google call — taxonomy: LOCAL_VALIDATION. */
export class LocalValidationError extends Error {
  name = 'LocalValidationError';
}

/** Canonical page origin: the URL-prefix property when configured, else SITE_BASE_URL. */
export function canonicalInspectionOrigin(): string {
  if (GSC_SITE_URL.startsWith('http')) return new URL(GSC_SITE_URL).origin;
  return new URL(SITE_BASE_URL).origin;
}

export function toAbsoluteInspectionUrl(raw: string, origin: string = canonicalInspectionOrigin()): string {
  const value = (raw ?? '').trim();
  if (!value) throw new LocalValidationError('empty inspection URL');

  const base = new URL(origin);
  let u: URL;

  if (value.startsWith('/') && !value.startsWith('//')) {
    u = new URL(value, base);
  } else {
    try {
      u = new URL(value);
    } catch {
      throw new LocalValidationError(`malformed URL: "${value.slice(0, 80)}"`);
    }
    if (u.protocol !== 'https:') {
      throw new LocalValidationError(`unsupported protocol "${u.protocol}" — origin ${u.origin} (expected ${base.origin})`);
    }
    const host = u.hostname.toLowerCase();
    const canonicalHost = base.hostname.toLowerCase();
    if (host !== canonicalHost) {
      if (canonicalHost === `www.${host}`) {
        u.hostname = canonicalHost; // apex → canonical www
      } else {
        throw new LocalValidationError(`foreign origin ${u.origin} (expected ${base.origin})`);
      }
    }
  }

  u.hash = '';
  u.pathname = u.pathname.replace(/\/{2,}/g, '/');
  return u.href;
}
