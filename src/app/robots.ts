import type { MetadataRoute } from 'next';
import { SITE_BASE_URL } from '../lib/site-config';
import { isIsolatedStaging } from '../lib/staging-crawl.mjs';

// Evaluate per request so a staging runtime can never serve production rules.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (isIsolatedStaging(process.env)) {
    // Isolated staging mirrors production content: keep every crawler out.
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
    ],
    sitemap: `${SITE_BASE_URL}/sitemap.xml`,
  };
}
