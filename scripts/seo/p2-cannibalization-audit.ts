import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })

  const catA = 'fitness-and-metabolism'
  const catB = 'fitness'

  // Fetch both categories
  const [resA, resB] = await Promise.all([
    payload.find({ collection: 'categories', where: { slug: { equals: catA } }, limit: 1, depth: 0 }),
    payload.find({ collection: 'categories', where: { slug: { equals: catB } }, limit: 1, depth: 0 }),
  ])

  const cA = resA.docs[0] as any
  const cB = resB.docs[0] as any

  if (!cA) { console.log(`Category "${catA}" not found`); process.exit(1) }
  if (!cB) { console.log(`Category "${catB}" not found`); process.exit(1) }

  console.log(`Category A: "${cA.name}" (slug: ${cA.slug}, id: ${cA.id})`)
  console.log(`  description: ${(cA.description || '').length} chars, ${countWords(cA.description || '')} words`)
  console.log(`Category B: "${cB.name}" (slug: ${cB.slug}, id: ${cB.id})`)
  console.log(`  description: ${(cB.description || '').length} chars, ${countWords(cB.description || '')} words`)

  // Fetch articles in each category
  const [artsA, artsB] = await Promise.all([
    payload.find({ collection: 'articles', where: { category: { equals: cA.id } }, limit: 100, depth: 0 }),
    payload.find({ collection: 'articles', where: { category: { equals: cB.id } }, limit: 100, depth: 0 }),
  ])

  // Also check tools in each category
  const [toolsA, toolsB] = await Promise.all([
    payload.find({ collection: 'tools', where: { category: { equals: cA.id } }, limit: 100, depth: 0 }),
    payload.find({ collection: 'tools', where: { category: { equals: cB.id } }, limit: 100, depth: 0 }),
  ])

  // Word count: category description + sum of article (title + excerpt) words
  let wcA = countWords(cA.description || '')
  let wcB = countWords(cB.description || '')

  console.log(`\nArticles in ${catA}: ${artsA.totalDocs}`)
  for (const d of artsA.docs) {
    const a = d as any
    const t = countWords(a.title || '') + countWords(a.excerpt || '')
    wcA += t
    console.log(`  [A] "${a.title}" — ${t} words`)
  }

  console.log(`Articles in ${catB}: ${artsB.totalDocs}`)
  for (const d of artsB.docs) {
    const a = d as any
    const t = countWords(a.title || '') + countWords(a.excerpt || '')
    wcB += t
    console.log(`  [B] "${a.title}" — ${t} words`)
  }

  // Add tool names/blurbs to word count (they appear on the category page)
  console.log(`\nTools in ${catA}: ${toolsA.totalDocs}`)
  for (const d of toolsA.docs) {
    const t = d as any
    const w = countWords(t.name || '') + countWords((t as any).blurb || t.seo?.metaDescription || '')
    wcA += w
  }

  console.log(`Tools in ${catB}: ${toolsB.totalDocs}`)
  for (const d of toolsB.docs) {
    const t = d as any
    const w = countWords(t.name || '') + countWords((t as any).blurb || t.seo?.metaDescription || '')
    wcB += w
  }

  console.log(`\n=== MEASURED VALUES ===`)
  console.log(`word_count_A (${catA}): ${wcA}`)
  console.log(`word_count_B (${catB}): ${wcB}`)
  console.log(`0.6 × word_count_B = ${Math.round(0.6 * wcB)}`)
  console.log(`word_count_A < 0.6 × word_count_B? ${wcA < 0.6 * wcB}`)

  // Inbound links: search ALL articles for mentions of each category slug in layout content
  const allArticles = await payload.find({ collection: 'articles', limit: 100, depth: 0 })
  let inboundA = 0
  let inboundB = 0

  for (const d of allArticles.docs) {
    const a = d as any
    const bodyStr = JSON.stringify(a.layout || [])
    // Count links to /wellness-hub/fitness-and-metabolism or /fitness-and-metabolism
    if (bodyStr.includes(catA) || bodyStr.includes(`/${catA}`)) {
      inboundA++
    }
    // Count links to /wellness-hub/fitness or /fitness (but not fitness-and-metabolism)
    if (bodyStr.includes(`/${catB}"`) || bodyStr.includes(`/${catB}'`) || bodyStr.includes(`/${catB} `) || bodyStr.includes(`/${catB}<`) || bodyStr.includes(`/${catB}/`)) {
      // Make sure it's not fitness-and-metabolism
      if (!bodyStr.includes(catA)) {
        inboundB++
      } else {
        // Check if there's a separate link to just /fitness
        const regex = new RegExp(`/${catB}(?![-])`, 'g')
        if (regex.test(bodyStr)) {
          inboundB++
        }
      }
    }
  }

  // Also check relatedArticles and relatedTools fields for category references
  for (const d of allArticles.docs) {
    const a = d as any
    // Check if article's relatedArticles or relatedTools point to items in these categories
    // (indirect inbound links via related content)
  }

  console.log(`\ninbound_links_A (${catA}): ${inboundA}`)
  console.log(`inbound_links_B (${catB}): ${inboundB}`)
  console.log(`inbound_links_A < inbound_links_B? ${inboundA < inboundB}`)

  // Apply decision rule
  console.log(`\n=== DECISION RULE ===`)
  const consolidate = (wcA < 0.6 * wcB) && (inboundA < inboundB)
  if (consolidate) {
    console.log(`CONSOLIDATE: ${catA} (thinner) into ${catB} (richer)`)
    console.log(`  Reason: word_count_A (${wcA}) < 0.6 × word_count_B (${Math.round(0.6 * wcB)}) AND inbound_links_A (${inboundA}) < inbound_links_B (${inboundB})`)
  } else {
    console.log(`DIFFERENTIATE`)
    if (!(wcA < 0.6 * wcB)) {
      console.log(`  Reason: word_count_A (${wcA}) >= 0.6 × word_count_B (${Math.round(0.6 * wcB)}) — pages are not thin vs rich`)
    }
    if (!(inboundA < inboundB)) {
      console.log(`  Reason: inbound_links_A (${inboundA}) >= inbound_links_B (${inboundB}) — thinner page doesn't have fewer links`)
    }
  }

  // Output current SEO fields for both categories (for the DIFFERENTIATE checklist)
  if (!consolidate) {
    console.log(`\n=== CURRENT SEO (for DIFFERENTIATE) ===`)
    console.log(`Category A (${catA}):`)
    console.log(`  name: "${cA.name}"`)
    console.log(`  description: "${cA.description || ''}"`)
    console.log(`Category B (${catB}):`)
    console.log(`  name: "${cB.name}"`)
    console.log(`  description: "${cB.description || ''}"`)
  }

  await payload.destroy()
}

function countWords(str: string): number {
  return str.trim().split(/\s+/).filter((w) => w.length > 0).length
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
