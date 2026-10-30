import { NextResponse } from 'next/server';
import { authorizeSeoRequest } from '../../../../lib/seo-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * This legacy route previously sent arbitrary health URLs to the Google Indexing
 * API, whose policy is restricted to eligible JobPosting / BroadcastEvent pages.
 * Preserve the authenticated route and all Google Search Console inspection
 * features, but fail closed before calling the Indexing API or consuming quota.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const auth = await authorizeSeoRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json({
    code: 'GOOGLE_INDEXING_API_NOT_ELIGIBLE',
    error: 'Health articles and calculators are not eligible for Google Indexing API. Use Google Search Console URL Inspection and sitemap discovery.',
    submitted: [],
  }, { status: 422 });
}
