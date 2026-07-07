/**
 * AI SEO Autopilot — Crawler (§5 Phase 1).
 *
 * Crawls the site's own content via Payload Local API (not HTTP crawling —
 * we read directly from the database for speed and accuracy in Phase 1).
 * Returns a normalized content snapshot per page for the detectors.
 */

import type { Payload } from 'payload'

export interface CrawledPage {
  id: number
  collection: string
  slug: string
  title: string
  status: string
  seo: {
    metaTitle?: string
    metaDescription?: string
    canonical?: string
    keywords?: string[]
    noIndex?: boolean
    ogTitle?: string
    ogDescription?: string
    twitterTitle?: string
    twitterDescription?: string
  }
  semanticEntities?: { term: string; url?: string }[]
  url: string
}

/**
 * Crawl all articles from Payload Local API.
 * Phase 1: articles only (tools and pages can be added later).
 */
export async function crawlArticles(payload: Payload, limit = 100): Promise<CrawledPage[]> {
  const result = await payload.find({
    collection: 'articles',
    limit,
    depth: 0,
    sort: 'id',
  })

  return result.docs.map((doc: any) => ({
    id: doc.id,
    collection: 'articles',
    slug: doc.slug || '',
    title: doc.title || '',
    status: doc._status || 'draft',
    seo: {
      metaTitle: doc.seo?.metaTitle || '',
      metaDescription: doc.seo?.metaDescription || '',
      canonical: doc.seo?.canonical || '',
      keywords: doc.seo?.keywords || [],
      noIndex: doc.seo?.noIndex || false,
      ogTitle: doc.seo?.ogTitle || '',
      ogDescription: doc.seo?.ogDescription || '',
      twitterTitle: doc.seo?.twitterTitle || '',
      twitterDescription: doc.seo?.twitterDescription || '',
    },
    semanticEntities: doc.semanticEntities || [],
    url: `/wellness-hub/${doc.slug || ''}`,
  }))
}

/**
 * Crawl all tools from Payload Local API.
 */
export async function crawlTools(payload: Payload, limit = 100): Promise<CrawledPage[]> {
  const result = await payload.find({
    collection: 'tools',
    limit,
    depth: 0,
    sort: 'id',
  })

  return result.docs.map((doc: any) => ({
    id: doc.id,
    collection: 'tools',
    slug: doc.slug || '',
    title: doc.name || '',
    status: doc._status || 'draft',
    seo: {
      metaTitle: doc.seo?.metaTitle || '',
      metaDescription: doc.seo?.metaDescription || '',
      canonical: doc.seo?.canonical || '',
      keywords: doc.seo?.keywords || [],
      noIndex: doc.seo?.noIndex || false,
      ogTitle: doc.seo?.ogTitle || '',
      ogDescription: doc.seo?.ogDescription || '',
      twitterTitle: doc.seo?.twitterTitle || '',
      twitterDescription: doc.seo?.twitterDescription || '',
    },
    semanticEntities: doc.semanticEntities || [],
    url: `/tools/${doc.slug || ''}`,
  }))
}
