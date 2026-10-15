import { NextResponse } from 'next/server';
import { authorizeSeoRequest } from '@/lib/seo-guard';
import { readDeployedManifest } from '@/lib/deployment-sync';
import { queueIndexNowPing } from '@/lib/indexnow';
import { SITE_BASE_URL } from '@/lib/site-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** General health pages use IndexNow; Google requests belong in Search Console. */
export async function POST(req: Request): Promise<NextResponse> {
  const auth = await authorizeSeoRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: { urls?: unknown; type?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  if (body.type !== 'URL_UPDATED' || !Array.isArray(body.urls) || !body.urls.length || body.urls.length > 100 || body.urls.some((u) => typeof u !== 'string')) {
    return NextResponse.json({ error: 'Provide 1–100 published URLs and type URL_UPDATED.' }, { status: 400 });
  }
  if (!process.env.INDEXNOW_API_KEY || process.env.INDEXNOW_DISABLE === 'true') {
    return NextResponse.json({ error: 'IndexNow is not configured. Use Google Search Console for Google crawl requests.' }, { status: 503 });
  }
  let allowed: Set<string>;
  try { allowed = new Set((await readDeployedManifest()).records.filter((r) => r.path && !r.noIndex).map((r) => SITE_BASE_URL + r.path)); }
  catch { return NextResponse.json({ error: 'Cannot verify the published site.' }, { status: 503 }); }
  const urls = [...new Set(body.urls as string[])];
  if (urls.some((u) => !allowed.has(u))) return NextResponse.json({ error: 'Only indexable URLs confirmed on the published site may be submitted.' }, { status: 422 });
  queueIndexNowPing(urls);
  return NextResponse.json({ provider: 'indexnow', submitted: urls, failed: [], message: 'Notifications queued; indexing is not guaranteed.' }, { status: 202 });
}
