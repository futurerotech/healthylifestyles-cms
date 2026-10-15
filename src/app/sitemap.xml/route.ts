import { NextResponse } from 'next/server';
import { SITE_BASE_URL } from '@/lib/site-config';

/** The frontend owns the complete sitemap of pages it actually rendered. */
export function GET() {
  return NextResponse.redirect(`${SITE_BASE_URL}/sitemap-index.xml`, 308);
}
