/**
 * fix-dead-tool-links.ts
 *
 * Scans all published articles and replaces known dead tool slugs in
 * relatedTools with live equivalents.
 *
 * Known replacements:
 *   how-much-protein-do-i-need     → protein-intake-calculator
 *   body-fat-percentage-calculator → body-fat-calculator
 */
const CMS_URL = process.env.CMS_URL || 'https://cms.healthylifesstyles.com'
const EMAIL = process.env.PAYLOAD_EMAIL || ''
const PASSWORD = process.env.PAYLOAD_PASSWORD || ''

const REPLACEMENTS: Record<string, string> = {
  'how-much-protein-do-i-need': 'protein-intake-calculator',
  'body-fat-percentage-calculator': 'body-fat-calculator',
}

async function login(): Promise<string> {
  const res = await fetch(`${CMS_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status}`)
  const data = (await res.json()) as { token?: string }
  if (!data.token) throw new Error('Login response missing token')
  return data.token
}

async function main() {
  const token = await login()

  const [articlesRes, toolsRes] = await Promise.all([
    fetch(`${CMS_URL}/api/articles?limit=1000&depth=2&where[_status][equals]=published`, {
      headers: { Authorization: `JWT ${token}` },
    }),
    fetch(`${CMS_URL}/api/tools?limit=1000&depth=0`, {
      headers: { Authorization: `JWT ${token}` },
    }),
  ])

  const articlesData = await articlesRes.json()
  const toolsData = await toolsRes.json()
  const articles = articlesData.docs || []
  const tools = toolsData.docs || []
  const slugToId = new Map(tools.map((t: any) => [t.slug, t.id]))

  let fixedCount = 0

  for (const article of articles) {
    const currentTools: any[] = article.relatedTools || []
    const currentSlugs: string[] = currentTools.map((t: any) => t.slug || '')

    let changed = false
    const newToolIds = currentSlugs.map((slug, idx) => {
      const replacementSlug = REPLACEMENTS[slug]
      if (replacementSlug) {
        const newId = slugToId.get(replacementSlug)
        if (newId) {
          console.log(`  ${article.slug}: ${slug} → ${replacementSlug}`)
          changed = true
          return newId
        }
      }
      return currentTools[idx].id
    })

    if (!changed) continue

    const updateRes = await fetch(`${CMS_URL}/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
      body: JSON.stringify({ relatedTools: newToolIds }),
    })
    if (!updateRes.ok) throw new Error(`Update ${article.slug} failed: ${updateRes.status}`)
    fixedCount++
  }

  console.log(`\nFixed dead tool links in ${fixedCount} articles.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
