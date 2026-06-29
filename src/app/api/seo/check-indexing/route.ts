import { NextResponse } from 'next/server';
import { getGoogleAuth } from '../../../../lib/google-auth';
import { authorizeSeoRequest } from '../../../../lib/seo-guard';
import { consumeQuota, getQuota } from '../../../../lib/indexing-quota';

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

  const siteUrl = process.env.GSC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return NextResponse.json({ error: 'GSC_SITE_URL / NEXT_PUBLIC_SITE_URL is not configured.' }, { status: 503 });
  }

  let searchconsole: import('googleapis').searchconsole_v1.Searchconsole;
  try {
    const { google } = await import('googleapis');
    const auth = await getGoogleAuth();
    searchconsole = google.searchconsole({ version: 'v1', auth });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Google authentication failed.' }, { status: 502 });
  }

  // One request per URL, run in parallel; per-URL failures never sink the batch.
  const settled = await Promise.allSettled(
    urls.map(async (url): Promise<InspectResult> => {
      try {
        const res = await searchconsole.urlInspection.index.inspect({ requestBody: { inspectionUrl: url, siteUrl } });
        const idx = res.data.inspectionResult?.indexStatusResult;
        const coverageState = idx?.coverageState || 'Unknown';
        const isIndexed = idx?.verdict === 'PASS' || /indexed/i.test(coverageState);
        return { url, isIndexed, lastCrawled: idx?.lastCrawlTime || null, coverageState, error: null };
      } catch (err) {
        return { url, isIndexed: false, lastCrawled: null, coverageState: 'Error', error: err instanceof Error ? err.message : 'Inspection failed.' };
      }
    }),
  );

  const results: InspectResult[] = settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : { url: urls[i], isIndexed: false, lastCrawled: null, coverageState: 'Error', error: 'Inspection failed.' },
  );

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
