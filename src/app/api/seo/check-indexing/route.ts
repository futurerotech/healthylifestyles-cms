import { NextResponse } from 'next/server';
import { getGoogleAuth } from '../../../../lib/google-auth';
import { authorizeSeoRequest } from '../../../../lib/seo-guard';
import { consumeQuota, getQuota } from '../../../../lib/indexing-quota';
// Validated at MODULE LOAD (site-config throws on malformed values): either a
// URL-prefix property ("https://…/", trailing slash required) or a Domain
// property ("sc-domain:example.com"). The previous inline `process.env` read
// bypassed this validation — the root of the Permission-denied hotfix.
import { GSC_SITE_URL } from '../../../../lib/site-config';

/** Is this inspection URL inside the configured property? (both property forms) */
function urlUnderProperty(url: string, property: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (property.startsWith('sc-domain:')) {
    const domain = property.slice('sc-domain:'.length).toLowerCase();
    const host = u.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  return url.startsWith(property);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface InspectResult {
  url: string;
  isIndexed: boolean;
  lastCrawled: string | null;
  coverageState: string;
  error: string | null;
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await authorizeSeoRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const rawUrls = (body as { urls?: unknown })?.urls;
  if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
    return NextResponse.json({ error: 'Provide a non-empty `urls` array.' }, { status: 400 });
  }
  if (rawUrls.length > 10) {
    return NextResponse.json({ error: 'Max 10 URLs per call (GSC batch limit).' }, { status: 400 });
  }
  const urls = rawUrls.filter((u): u is string => typeof u === 'string' && u.length > 0);

  // Byte-exact property identifier, validated at module load by site-config.
  // NEXT_PUBLIC_SITE_URL is deliberately NOT a fallback any more: it has no
  // trailing slash, so it can never equal a URL-prefix property — that silent
  // substitution produced blanket "Permission denied" on every inspection.
  const siteUrl = GSC_SITE_URL;

  let searchconsole: import('googleapis').searchconsole_v1.Searchconsole;
  try {
    const { google } = await import('googleapis');
    const auth = await getGoogleAuth();
    searchconsole = google.searchconsole({ version: 'v1', auth });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Google authentication failed.' }, { status: 502 });
  }

  // SEQUENTIAL, never a parallel burst: the inspect quota (2000/day/property)
  // is shared, and 429s under a burst poison the whole batch. Per-URL failures
  // never sink the batch; a 429 gets bounded backoff retries (2s, then 5s).
  const inspectOnce = async (url: string) => {
    const res = await searchconsole.urlInspection.index.inspect({ requestBody: { inspectionUrl: url, siteUrl } });
    const idx = res.data.inspectionResult?.indexStatusResult;
    const coverageState = idx?.coverageState || 'Unknown';
    const isIndexed = idx?.verdict === 'PASS' || /indexed/i.test(coverageState);
    return { url, isIndexed, lastCrawled: idx?.lastCrawlTime || null, coverageState, error: null } as InspectResult;
  };

  const results: InspectResult[] = [];
  for (const url of urls) {
    if (!urlUnderProperty(url, siteUrl)) {
      results.push({ url, isIndexed: false, lastCrawled: null, coverageState: 'Error', error: `URL is not under the configured GSC property (${siteUrl}).` });
      continue;
    }
    let lastErr: unknown = null;
    let done = false;
    for (let attempt = 0; attempt <= 2 && !done; attempt++) {
      try {
        const r = await inspectOnce(url);
        console.log(`[check-indexing] inspected ok — siteUrl=${siteUrl} inspectionUrl=${url} coverage="${r.coverageState}"`);
        results.push(r);
        done = true;
      } catch (err) {
        lastErr = err;
        const e = err as { message?: string; code?: number | string; response?: { status?: number } };
        const status = e.response?.status ?? e.code;
        console.error('[check-indexing] inspect FAILED', { message: e.message, code: e.code, status, url, siteUrl });
        if (String(status) === '429' && attempt < 2) {
          await sleep(attempt === 0 ? 2_000 : 5_000);
          continue;
        }
        break;
      }
    }
    if (!done) {
      results.push({ url, isIndexed: false, lastCrawled: null, coverageState: 'Error', error: lastErr instanceof Error ? lastErr.message : 'Inspection failed.' });
    }
  }

  consumeQuota('inspect', urls.length);
  return NextResponse.json(
    { results },
    {
      headers: {
        // The dashboard quota bar tracks the (constraining) publish quota.
        'X-GSC-Quota-Remaining': String(getQuota('publish').remaining),
        'X-GSC-Inspect-Remaining': String(getQuota('inspect').remaining),
      },
    },
  );
}
