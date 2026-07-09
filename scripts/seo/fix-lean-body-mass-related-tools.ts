/**
 * fix-lean-body-mass-related-tools.ts
 *
 * Fixes dead tool slugs in the relatedTools of the article
 * /wellness-hub/lean-body-mass-calculator-guide.
 *
 * Replaces:
 *   body-fat-percentage-calculator → body-fat-calculator
 *   how-much-protein-do-i-need     → protein-intake-calculator
 */
const CMS_URL = process.env.CMS_URL || 'https://cms.healthylifesstyles.com'
const EMAIL = process.env.PAYLOAD_EMAIL || ''
const PASSWORD = process.env.PAYLOAD_PASSWORD || ''

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

  // Find the article
  const findRes = await fetch(
    `${CMS_URL}/api/articles?where[slug][equals]=lean-body-mass-calculator-guide&depth=2`,
    { headers: { Authorization: `JWT ${token}` } },
  )
  if (!findRes.ok) throw new Error(`Find failed: ${findRes.status}`)
  const findData = await findRes.json()
  const doc = findData.docs?.[0]
  if (!doc) throw new Error('Article lean-body-mass-calculator-guide not found')

  console.log(`Found article: ${doc.title} (id: ${doc.id})`)
  console.log('Current relatedTools:', doc.relatedTools?.map((t: any) => t.slug || t.id || t).join(', ') || 'none')

  const currentIds = doc.relatedTools?.map((t: any) => t.id) || []
  const currentSlugs = doc.relatedTools?.map((t: any) => t.slug || '') || []

  // Map dead slugs to live tool IDs
  const replacements: Record<string, string> = {
    'body-fat-percentage-calculator': 'body-fat-calculator',
    'how-much-protein-do-i-need': 'protein-intake-calculator',
  }

  // Fetch all tools to build slug→id map
  const toolsRes = await fetch(`${CMS_URL}/api/tools?limit=1000&depth=0`, {
    headers: { Authorization: `JWT ${token}` },
  })
  const toolsData = await toolsRes.json()
  const tools = toolsData.docs || []
  const slugToId = new Map(tools.map((t: any) => [t.slug, t.id]))

  const newRelatedTools = currentSlugs.map((slug: string) => {
    const replacementSlug = replacements[slug]
    if (replacementSlug) {
      const newId = slugToId.get(replacementSlug)
      if (newId) {
        console.log(`  Replacing ${slug} → ${replacementSlug}`)
        return newId
      }
    }
    return currentIds[currentSlugs.indexOf(slug)]
  })

  const updateRes = await fetch(`${CMS_URL}/api/articles/${doc.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    body: JSON.stringify({ relatedTools: newRelatedTools }),
  })
  if (!updateRes.ok) throw new Error(`Update failed: ${updateRes.status} ${await updateRes.text()}`)

  console.log('Updated relatedTools successfully.')
}

main().catch((e) => { console.error(e); process.exit(1) })
