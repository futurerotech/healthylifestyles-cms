/**
 * apply-internal-links-rest.ts
 *
 * Fallback apply script using the hosted CMS REST API + admin credentials.
 * Use this when Payload Local API initialization hangs (e.g., from this
 * development environment). It performs the same mutations as
 * propose-internal-links.ts --apply:
 *   1. Adds proposed relatedTools / relatedArticles to each article.
 *   2. Fixes dead body links in /wellness-hub/lean-body-mass-calculator-guide.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/seo/apply-internal-links-rest.ts
 */
import * as fs from 'fs'
import * as path from 'path'

const CMS_URL = process.env.CMS_URL || 'https://cms.healthylifesstyles.com'
const EMAIL = process.env.PAYLOAD_EMAIL || ''
const PASSWORD = process.env.PAYLOAD_PASSWORD || ''

const MANIFEST_PATH = path.resolve(process.cwd(), 'docs/seo/internal-links-proposed-manifest.json')

interface CmsDoc {
  id: string | number
  slug: string
  relatedTools?: (string | number)[]
  relatedArticles?: (string | number)[]
  layout?: any[]
}

async function login(): Promise<string> {
  const res = await fetch(`${CMS_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Login failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as { token?: string; user?: any }
  if (!data.token) throw new Error('Login response missing token')
  console.log(`Logged in as: ${data.user?.email || 'unknown'}`)
  return data.token
}

async function fetchCollection(token: string, slug: string, limit = 1000): Promise<CmsDoc[]> {
  const res = await fetch(`${CMS_URL}/api/${slug}?limit=${limit}&depth=0`, {
    headers: { Authorization: `JWT ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Failed to fetch ${slug}: ${res.status}`)
  const data = (await res.json()) as { docs: CmsDoc[] }
  return data.docs || []
}

async function updateArticle(token: string, id: string | number, data: any): Promise<void> {
  const res = await fetch(`${CMS_URL}/api/articles/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${token}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Update article ${id} failed: ${res.status} ${text}`)
  }
}

function replaceDeadLinksInLayout(layout: any[]): any[] {
  return layout.map((block: any) => {
    if (!block || typeof block !== 'object') return block
    const next = { ...block }
    if (typeof next.text === 'string') {
      next.text = next.text
        .replace(/\/tools\/body-fat-percentage-calculator/g, '/tools/body-fat-calculator')
        .replace(/\/tools\/how-much-protein-do-i-need/g, '/tools/protein-intake-calculator')
    }
    if (Array.isArray(next.items)) {
      next.items = next.items.map((item: any) =>
        typeof item === 'string'
          ? item
              .replace(/\/tools\/body-fat-percentage-calculator/g, '/tools/body-fat-calculator')
              .replace(/\/tools\/how-much-protein-do-i-need/g, '/tools/protein-intake-calculator')
          : item,
      )
    }
    return next
  })
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('PAYLOAD_EMAIL and PAYLOAD_PASSWORD must be set in .env')
    process.exit(1)
  }

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found: ${MANIFEST_PATH}`)
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
  const token = await login()

  console.log('Fetching tools and articles for ID mapping...')
  const [tools, articles] = await Promise.all([
    fetchCollection(token, 'tools'),
    fetchCollection(token, 'articles'),
  ])

  const toolSlugToId = new Map(tools.map((t) => [t.slug, t.id]))
  const articleSlugToId = new Map(articles.map((a) => [a.slug, a.id]))
  const articleIdToDoc = new Map(articles.map((a) => [String(a.id), a]))

  console.log(`Tools: ${tools.length}, Articles: ${articles.length}`)

  let updated = 0
  let deadLinkFixes = 0

  for (const proposal of manifest.articles) {
    const articleId = articleSlugToId.get(proposal.slug)
    if (!articleId) {
      console.warn(`Article not found: ${proposal.slug}`)
      continue
    }

    const current = articleIdToDoc.get(String(articleId))
    const currentToolIds = (current?.relatedTools || []).map(String)
    const currentArticleIds = (current?.relatedArticles || []).map(String)

    const proposedToolSlugs = proposal.proposed.relatedTools
      .filter((t: any) => !proposal.current.relatedTools.includes(t.slug))
      .map((t: any) => t.slug)
    const proposedArticleSlugs = proposal.proposed.relatedArticles
      .filter((a: any) => !proposal.current.relatedArticles.includes(a.slug))
      .map((a: any) => a.slug)

    if (proposedToolSlugs.length === 0 && proposedArticleSlugs.length === 0) continue

    const newToolIds = proposedToolSlugs
      .map((s: string) => toolSlugToId.get(s))
      .filter((id): id is string | number => !!id)
      .filter((id) => !currentToolIds.includes(String(id)))
    const newArticleIds = proposedArticleSlugs
      .map((s: string) => articleSlugToId.get(s))
      .filter((id): id is string | number => !!id)
      .filter((id) => !currentArticleIds.includes(String(id)))

    const relatedTools = [...(current?.relatedTools || []), ...newToolIds].slice(0, 4)
    const relatedArticles = [...(current?.relatedArticles || []), ...newArticleIds].slice(0, 4)

    const updateData: any = {}
    if (newToolIds.length > 0) updateData.relatedTools = relatedTools
    if (newArticleIds.length > 0) updateData.relatedArticles = relatedArticles

    // Also fix dead links if this is the target article.
    if (proposal.slug === 'lean-body-mass-calculator-guide' && current?.layout) {
      const fixedLayout = replaceDeadLinksInLayout(current.layout)
      if (JSON.stringify(fixedLayout) !== JSON.stringify(current.layout)) {
        updateData.layout = fixedLayout
        deadLinkFixes++
        console.log(`  Will fix dead links in ${proposal.slug}`)
      }
    }

    if (Object.keys(updateData).length === 0) continue

    await updateArticle(token, articleId, updateData)
    updated++
    console.log(
      `Updated ${proposal.slug}: +${newToolIds.length} tools, +${newArticleIds.length} articles${
        updateData.layout ? ', dead links fixed' : ''
      }`,
    )
  }

  // If the dead-link article wasn't in the manifest (it should be), handle it separately.
  const deadLinkArticle = articles.find((a) => a.slug === 'lean-body-mass-calculator-guide')
  if (deadLinkArticle && deadLinkArticle.layout) {
    const fixedLayout = replaceDeadLinksInLayout(deadLinkArticle.layout)
    if (JSON.stringify(fixedLayout) !== JSON.stringify(deadLinkArticle.layout)) {
      await updateArticle(token, deadLinkArticle.id, { layout: fixedLayout })
      deadLinkFixes++
      console.log(`Updated lean-body-mass-calculator-guide: dead links fixed`)
    }
  }

  console.log(`\nTotal articles updated: ${updated}`)
  console.log(`Dead-link fixes applied: ${deadLinkFixes}`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
