/**
 * Published wellness articles/tools: IndexNow notifications only. Google Indexing
 * API is restricted to qualifying JobPosting or BroadcastEvent-in-VideoObject
 * pages, so this hook must never call it for ordinary health content.
 * IndexNow failures are logged to the IndexingStatus collection.
 */

const SITE_URL = process.env.SITE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.healthylifesstyles.com';

/* -------------------------------------------------------------------------- */
/*  IndexNow                                                                  */
/* -------------------------------------------------------------------------- */

interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
const INDEXNOW_HOST = new URL(SITE_URL).hostname;

/** Ping all participating IndexNow engines. Returns per-engine results. */
export async function pingIndexNow(urls: string[]): Promise<{ engine: string; ok: boolean; status: number }[]> {
  if (!INDEXNOW_KEY || urls.length === 0) return [];

  const payload: IndexNowPayload = {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  const engines = [
    'https://api.indexnow.org/indexnow',
    'https://www.bing.com/indexnow',
    'https://search.yandex.com/indexnow',
  ];

  const results: { engine: string; ok: boolean; status: number }[] = [];

  for (const endpoint of engines) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      results.push({ engine: endpoint, ok: res.ok, status: res.status });
    } catch (err) {
      results.push({ engine: endpoint, ok: false, status: 0 });
    }
  }

  return results;
}

/* -------------------------------------------------------------------------- */
/*  Google Indexing API                                                       */
/* -------------------------------------------------------------------------- */

interface GoogleIndexingResult { ok: boolean; status: number; error?: string }

const GOOGLE_KEY_JSON = process.env.GOOGLE_INDEXING_KEY || '';

/**
 * Legacy Google Indexing API helper. Do not use for ordinary articles/tools.
 * Google's API is limited to qualifying job postings or livestreaming videos;
 * this project's wellness pages do not meet those criteria. The afterChange
 * indexing hook below deliberately does not invoke this helper.
 */
export async function pingGoogle(url: string): Promise<GoogleIndexingResult> {
  if (!GOOGLE_KEY_JSON) {
    return { ok: false, status: 0, error: 'GOOGLE_INDEXING_KEY not configured' };
  }

  try {
    const key = JSON.parse(GOOGLE_KEY_JSON);
    const token = await getGoogleAccessToken(key);
    if (!token) return { ok: false, status: 0, error: 'Failed to obtain access token' };

    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url,
        type: 'URL_UPDATED',
      }),
      signal: AbortSignal.timeout(5000),
    });

    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, error: body?.error?.message };
  } catch (err) {
    return { ok: false, status: 0, error: String(err) };
  }
}

async function getGoogleAccessToken(key: Record<string, string>): Promise<string | null> {
  const { private_key, client_email } = key;
  if (!private_key || !client_email) return null;

  const jwt = await signJwt(
    {
      iss: client_email,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    },
    private_key,
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json().catch(() => ({}));
  return data?.access_token || null;
}

async function signJwt(payload: Record<string, unknown>, privateKey: string): Promise<string> {
  const jose = await import('jose');
  const pk = await jose.importPKCS8(privateKey, 'RS256');
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(pk);
}

/* -------------------------------------------------------------------------- */
/*  Reusable afterChange hook                                                 */
/* -------------------------------------------------------------------------- */

import type { CollectionAfterChangeHook } from 'payload';
import type { IndexingStatus } from '../collections/IndexingStatus';

/**
 * Payload hook — records indexing attempts only for intentional changes to
 * published content on the production CMS. Draft saves (including autosaves
 * of already-published articles) must never contact search engines or write
 * IndexingStatus records.
 *
 * This legacy hook is separate from the later publish-only IndexNow queue.
 * Keep staging, maintenance and CI fail-closed until real provider isolation
 * is verified.
 */
export const afterChangeIndexingHook: CollectionAfterChangeHook = async ({ doc, operation, collection, req }) => {
  // Maintenance and non-write operations must remain side-effect free.
  if ((req?.context as { reseedVersions?: boolean } | undefined)?.reseedVersions) return doc;
  if (operation !== 'create' && operation !== 'update') return doc;

  // This hook is intentionally limited to the two public wellness collections.
  // Never derive an IndexNow URL for unrelated Payload collections if reused.
  if (collection?.slug !== 'articles' && collection?.slug !== 'tools') return doc;

  // Payload draft mode can save a new version of an already-published doc.
  // Check BOTH the returned status and the explicit REST draft flag.
  if (doc?._status !== 'published') return doc;
  const draft = (req?.query as { draft?: unknown } | undefined)?.draft;
  if (draft === true || draft === 'true') return doc;

  // Avoid production-facing indexing on local builds, isolated Hostinger QA,
  // or maintenance/CI runs. The legacy hook must honor the existing IndexNow
  // kill switch for Google submissions and status writes as well.
  if (process.env.NODE_ENV !== 'production' ||
      process.env.HLS_ISOLATED_STAGING === 'true' ||
      process.env.INDEXNOW_DISABLE === 'true' ||
      process.env.INDEXNOW_DRY_RUN === 'true') return doc;

  // Never fabricate a supposedly canonical URL from a database ID. The
  // collection slug field emits lowercase hyphenated segments; malformed or
  // missing values are not eligible for indexing notifications.
  const slug = typeof doc?.slug === 'string' ? doc.slug : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return doc;

  // Never ping search engines from a local environment — Google rejects
  // localhost URLs and it just floods the IndexingStatus dashboard with
  // "Failed" entries.
  if (/localhost|127\.0\.0\.1|\.local/.test(SITE_URL)) return doc;

  const url = `${SITE_URL}/${collection.slug === 'articles' ? 'wellness-hub' : collection.slug}/${slug}`;

  const payload = req.payload;

  // Ordinary wellness content is outside Google's Indexing API eligibility.
  // Keep Google discovery on the public sitemap/Search Console path instead.
  // Do not create misleading Google indexing-status rows for these pages.
  const indexNowResults = await pingIndexNow([url]);

  const records: Record<string, unknown>[] = [];

  for (const r of indexNowResults) {
    records.push({
      docType: collection.slug,
      docSlug: slug,
      url,
      engine: r.engine,
      status: r.ok ? 'success' : 'failed',
      httpStatus: r.status,
      submittedAt: new Date().toISOString(),
    });
  }

  for (const data of records) {
    try {
      await payload.create({ collection: 'indexing-status' as any, data: data as any });
    } catch {
      /* Best-effort; don't fail the main operation */
    }
  }

  return doc;
};
