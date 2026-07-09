/**
 * propose-internal-links.ts
 *
 * Internal-link proposal engine.
 *
 * Dry-run (default): fetches published articles/tools via the hosted CMS REST API
 * and writes a review manifest to docs/seo/internal-links-proposed-manifest.json.
 *
 * Apply mode: npx tsx --env-file=.env scripts/seo/propose-internal-links.ts --apply
 * Uses Payload Local API to mutate article.relatedTools / article.relatedArticles.
 *
 * Matching scores:
 *   +5  article.primaryTool == tool.slug
 *   +3  same category
 *   +2  shared semantic entity
 *   +1  keyword overlap (tool keywords found in article title/excerpt)
 *   +2  shared tag (article↔article)
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import * as fs from 'fs'
import * as path from 'path'

const MANIFEST_PATH = path.resolve(process.cwd(), 'docs/seo/internal-links-proposed-manifest.json')
const CMS_URL = process.env.CMS_URL || 'https://cms.healthylifesstyles.com'
const SCORES = {
  primaryTool: 5,
  sameCategory: 3,
  sharedEntity: 2,
  keywordOverlap: 1,
  sharedTag: 2,
}

interface CmsDoc {
  id: string | number
  slug: string
  title?: string
  name?: string
  category?: { slug?: string; id?: string | number } | string | number
  tags?: Array<{ slug?: string; name?: string } | string | number>
  primaryTool?: { slug?: string; id?: string | number } | string | number
  relatedTools?: Array<{ slug?: string; id?: string | number } | string | number>
  relatedArticles?: Array<{ slug?: string; id?: string | number } | string | number>
  keywords?: string[]
  semanticEntities?: Array<{ term?: string; url?: string }>
  excerpt?: string
  _status?: string
  enabled?: boolean
}

interface Proposal {
  slug: string
  title: string
  current: {
    primaryTool?: string
    relatedTools: string[]
    relatedArticles: string[]
  }
  proposed: {
    relatedTools: { slug: string; score: number; reasons: string[] }[]
    relatedArticles: { slug: string; score: number; reasons: string[] }[]
  }
}

function pickSlug(rel: unknown): string {
  if (rel && typeof rel === 'object') {
    const o = rel as Record<string, unknown>
    return typeof o.slug === 'string' ? o.slug : String(o.id || '')
  }
  return String(rel || '')
}

function pickSlugs(rels: unknown[] | undefined): string[] {
  if (!rels) return []
  return rels.map(pickSlug).filter(Boolean)
}

function normalizeDoc(doc: any): CmsDoc {
  return {
    id: doc.id,
    slug: String(doc.slug || ''),
    title: typeof doc.title === 'string' ? doc.title : typeof doc.name === 'string' ? doc.name : '',
    name: typeof doc.name === 'string' ? doc.name : undefined,
    category: doc.category,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    primaryTool: doc.primaryTool,
    relatedTools: Array.isArray(doc.relatedTools) ? doc.relatedTools : [],
    relatedArticles: Array.isArray(doc.relatedArticles) ? doc.relatedArticles : [],
    keywords: Array.isArray(doc.keywords) ? doc.keywords.map(String) : [],
    semanticEntities: Array.isArray(doc.semanticEntities)
      ? doc.semanticEntities.filter((e: any) => e && typeof e === 'object')
      : [],
    excerpt: typeof doc.excerpt === 'string' ? doc.excerpt : '',
    _status: doc._status,
    enabled: doc.enabled,
  }
}

function getCategorySlug(doc: CmsDoc): string {
  return pickSlug(doc.category)
}

function getTags(doc: CmsDoc): string[] {
  return (doc.tags || [])
    .map((t) => {
      if (t && typeof t === 'object') return String(t.slug || t.name || '')
      return String(t || '')
    })
    .filter(Boolean)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

function scoreArticleTool(article: CmsDoc, tool: CmsDoc): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  if (pickSlug(article.primaryTool) === tool.slug) {
    score += SCORES.primaryTool
    reasons.push('primary tool')
  }

  if (getCategorySlug(article) && getCategorySlug(article) === getCategorySlug(tool)) {
    score += SCORES.sameCategory
    reasons.push('same category')
  }

  const articleTerms = new Set(tokenize(`${article.title} ${article.excerpt || ''}`))
  const toolKeywords = (tool.keywords || []).map((k) => k.toLowerCase())
  const keywordHits = toolKeywords.filter((k) => articleTerms.has(k) || articleTerms.has(k.replace(/s$/, '')))
  if (keywordHits.length > 0) {
    score += keywordHits.length * SCORES.keywordOverlap
    reasons.push(`keyword overlap: ${keywordHits.join(', ')}`)
  }

  const articleEntities = new Set((article.semanticEntities || []).map((e) => String(e.term || '').toLowerCase()))
  const toolEntities = new Set((tool.semanticEntities || []).map((e) => String(e.term || '').toLowerCase()))
  const sharedEntities = [...articleEntities].filter((e) => toolEntities.has(e))
  if (sharedEntities.length > 0) {
    score += sharedEntities.length * SCORES.sharedEntity
    reasons.push(`shared entities: ${sharedEntities.join(', ')}`)
  }

  return { score, reasons }
}

function scoreArticleArticle(a: CmsDoc, b: CmsDoc): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  if (getCategorySlug(a) && getCategorySlug(a) === getCategorySlug(b)) {
    score += SCORES.sameCategory
    reasons.push('same category')
  }

  const aTags = new Set(getTags(a))
  const sharedTags = getTags(b).filter((t) => aTags.has(t))
  if (sharedTags.length > 0) {
    score += sharedTags.length * SCORES.sharedTag
    reasons.push(`shared tags: ${sharedTags.join(', ')}`)
  }

  const aTokens = new Set(tokenize(`${a.title} ${a.excerpt || ''}`))
  const bTokens = tokenize(`${b.title} ${b.excerpt || ''}`)
  const overlap = bTokens.filter((t) => aTokens.has(t))
  const uniqueOverlap = [...new Set(overlap)]
  if (uniqueOverlap.length > 0) {
    score += uniqueOverlap.length * SCORES.keywordOverlap
    reasons.push(`topic overlap: ${uniqueOverlap.slice(0, 5).join(', ')}`)
  }

  return { score, reasons }
}

async function fetchViaRest(): Promise<{ articles: CmsDoc[]; tools: CmsDoc[] }> {
  console.log(`Fetching from CMS REST API: ${CMS_URL}`)

  const articlesRes = await fetch(`${CMS_URL}/api/articles?limit=1000&depth=2&where[_status][equals]=published`)
  if (!articlesRes.ok) throw new Error(`Articles fetch failed: ${articlesRes.status}`)
  const articlesData = await articlesRes.json()

  const toolsRes = await fetch(
    `${CMS_URL}/api/tools?limit=1000&depth=2&where[_status][equals]=published&where[enabled][equals]=true`,
  )
  if (!toolsRes.ok) throw new Error(`Tools fetch failed: ${toolsRes.status}`)
  const toolsData = await toolsRes.json()

  return {
    articles: (articlesData.docs || []).map(normalizeDoc),
    tools: (toolsData.docs || []).map(normalizeDoc),
  }
}

async function fetchViaLocalApi(): Promise<{ articles: CmsDoc[]; tools: CmsDoc[] }> {
  console.log('Fetching via Payload Local API...')
  const payload = await getPayload({ config: configPromise })

  const articlesRes = await payload.find({
    collection: 'articles',
    limit: 1000,
    depth: 2,
    where: { _status: { equals: 'published' } },
  } as any)
  const toolsRes = await payload.find({
    collection: 'tools',
    limit: 1000,
    depth: 2,
    where: { and: [{ _status: { equals: 'published' } }, { enabled: { equals: true } }] },
  } as any)

  await payload.destroy()

  return {
    articles: (articlesRes.docs as any[]).map(normalizeDoc),
    tools: (toolsRes.docs as any[]).map(normalizeDoc),
  }
}

function buildManifest(articles: CmsDoc[], tools: CmsDoc[]) {
  const proposals: Proposal[] = []

  for (const article of articles) {
    const primaryToolSlug = pickSlug(article.primaryTool)

    const toolScores = tools
      .filter((t) => t.slug !== primaryToolSlug)
      .map((t) => {
        const { score, reasons } = scoreArticleTool(article, t)
        return { slug: t.slug, score, reasons }
      })
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    const articleScores = articles
      .filter((a) => a.slug !== article.slug)
      .map((a) => {
        const { score, reasons } = scoreArticleArticle(article, a)
        return { slug: a.slug, score, reasons }
      })
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    proposals.push({
      slug: article.slug,
      title: article.title || article.name || '',
      current: {
        primaryTool: primaryToolSlug,
        relatedTools: pickSlugs(article.relatedTools),
        relatedArticles: pickSlugs(article.relatedArticles),
      },
      proposed: {
        relatedTools: toolScores,
        relatedArticles: articleScores,
      },
    })
  }

  const toolProposals = tools.map((tool) => {
    const linkingArticles = articles
      .filter((a) => pickSlug(a.primaryTool) === tool.slug || pickSlugs(a.relatedTools).includes(tool.slug))
      .map((a) => a.slug)

    const candidateArticles = articles
      .filter((a) => a.slug !== tool.slug && !linkingArticles.includes(a.slug))
      .map((a) => {
        const { score, reasons } = scoreArticleTool(a, tool)
        return { slug: a.slug, score, reasons }
      })
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    return {
      slug: tool.slug,
      title: tool.title || tool.name || '',
      alreadyLinkedFrom: linkingArticles,
      proposedNewLinks: candidateArticles,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    articleCount: articles.length,
    toolCount: tools.length,
    articles: proposals,
    tools: toolProposals,
  }
}

async function applyManifest(articles: CmsDoc[], tools: CmsDoc[], proposals: Proposal[]) {
  const payload = await getPayload({ config: configPromise })
  const toolSlugToId = new Map(tools.map((t) => [t.slug, t.id]))
  const articleSlugToId = new Map(articles.map((a) => [a.slug, a.id]))

  let updated = 0
  for (const p of proposals) {
    const newToolSlugs = p.proposed.relatedTools
      .filter((t) => !p.current.relatedTools.includes(t.slug))
      .map((t) => t.slug)
    const newArticleSlugs = p.proposed.relatedArticles
      .filter((a) => !p.current.relatedArticles.includes(a.slug))
      .map((a) => a.slug)

    if (newToolSlugs.length === 0 && newArticleSlugs.length === 0) continue

    const relatedTools = [...p.current.relatedTools, ...newToolSlugs].slice(0, 4)
    const relatedArticles = [...p.current.relatedArticles, ...newArticleSlugs].slice(0, 4)

    const toolIds = relatedTools.map((s) => toolSlugToId.get(s)).filter((id): id is string | number => !!id)
    const articleIds = relatedArticles.map((s) => articleSlugToId.get(s)).filter((id): id is string | number => !!id)

    const articleId = articleSlugToId.get(p.slug)
    if (!articleId) {
      console.warn(`  Could not find ID for article ${p.slug}; skipping.`)
      continue
    }

    await payload.update({
      collection: 'articles',
      id: articleId,
      data: {
        relatedTools: toolIds,
        relatedArticles: articleIds,
      } as any,
    })
    updated++
    console.log(`  Updated ${p.slug}: +${newToolSlugs.length} tools, +${newArticleSlugs.length} articles`)
  }

  await payload.destroy()
  return updated
}

async function main() {
  const apply = process.argv.includes('--apply')

  if (apply) {
    console.log('APPLY MODE: using Payload Local API.')
  } else {
    console.log('DRY-RUN MODE: using hosted CMS REST API.')
  }

  const { articles, tools } = apply ? await fetchViaLocalApi() : await fetchViaRest()
  console.log(`Articles: ${articles.length}, Tools: ${tools.length}`)

  const manifest = buildManifest(articles, tools)

  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8')

  const newToolLinks = manifest.articles.reduce(
    (sum, p) => sum + p.proposed.relatedTools.filter((t) => !p.current.relatedTools.includes(t.slug)).length,
    0,
  )
  const newArticleLinks = manifest.articles.reduce(
    (sum, p) => sum + p.proposed.relatedArticles.filter((a) => !p.current.relatedArticles.includes(a.slug)).length,
    0,
  )

  console.log(`\nManifest written: ${MANIFEST_PATH}`)
  console.log(`Proposed new article→tool links: ${newToolLinks}`)
  console.log(`Proposed new article→article links: ${newArticleLinks}`)
  console.log(`Total article changes: ${newToolLinks + newArticleLinks}`)

  if (!apply) {
    console.log('\nDry-run complete. Review the manifest, then run with --apply to mutate CMS data via Local API.')
    return
  }

  console.log('\nApplying changes...')
  const updated = await applyManifest(articles, tools, manifest.articles)
  console.log(`\nApplied updates to ${updated} articles.`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
