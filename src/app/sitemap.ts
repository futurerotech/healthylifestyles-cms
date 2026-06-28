import type { MetadataRoute } from 'next';
import config from '@payload-config';
import { getPayload } from 'payload';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.healthylifesstyles.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config });

  const [pages, articles, tools, categories, pseoPages] = await Promise.all([
    payload.find({ collection: 'pages', limit: 1000, pagination: false, select: { slug: true, updatedAt: true, _status: true } }),
    payload.find({ collection: 'articles', limit: 1000, pagination: false, select: { slug: true, updatedAt: true, _status: true } }),
    payload.find({ collection: 'tools', limit: 1000, pagination: false, select: { slug: true, updatedAt: true, _status: true } }),
    payload.find({ collection: 'categories', limit: 100, pagination: false, select: { slug: true, updatedAt: true, kind: true } }),
    payload.find({ collection: 'pseo-pages', limit: 5000, pagination: false, select: { slug: true, updatedAt: true, status: true } }),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  // Homepage
  entries.push({
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1.0,
  });

  // Pages (catch-all CMS pages)
  for (const page of pages.docs) {
    if (page._status === 'draft' || !page.slug) continue;
    entries.push({
      url: `${SITE_URL}/${page.slug}`,
      lastModified: new Date(page.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  // Articles (/wellness-hub/<slug>)
  for (const article of articles.docs) {
    if (article._status === 'draft' || !article.slug) continue;
    entries.push({
      url: `${SITE_URL}/wellness-hub/${article.slug}`,
      lastModified: new Date(article.updatedAt),
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  // Tools (/tools/<slug>)
  for (const tool of tools.docs) {
    if (tool._status === 'draft' || !tool.slug) continue;
    entries.push({
      url: `${SITE_URL}/tools/${tool.slug}`,
      lastModified: new Date(tool.updatedAt),
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  // Category hub pages
  for (const cat of categories.docs) {
    if (!cat.slug) continue;
    const prefix = cat.kind === 'section' ? 'wellness-hub' : 'tools';
    entries.push({
      url: `${SITE_URL}/${prefix}/${cat.slug}`,
      lastModified: new Date(cat.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.5,
    });
  }

  // pSEO generated pages
  for (const p of pseoPages.docs) {
    if (p.status === 'draft' || !p.slug) continue;
    entries.push({
      url: `${SITE_URL}/tools/pseo/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.4,
    });
  }

  return entries;
}
