import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })

  // Step 1: Query for the two "dead" tool slugs
  const slugs = ['body-fat-percentage-calculator', 'how-much-protein-do-i-need']
  for (const slug of slugs) {
    const res = await payload.find({ collection: 'tools', where: { slug: { equals: slug } }, limit: 1 })
    if (res.docs.length) {
      const t = res.docs[0] as any
      console.log(`EXISTS: "${slug}" -> ID ${t.id}, name="${t.name}", slug="${t.slug}"`)
    } else {
      console.log(`NOT FOUND: "${slug}"`)
    }
  }

  // Fuzzy match: search for similar tool names
  console.log('\n--- Fuzzy match: body-fat ---')
  const bf = await payload.find({ collection: 'tools', where: { name: { contains: 'body fat' } }, limit: 5 })
  for (const d of bf.docs) console.log(`  ID ${(d as any).id}: name="${(d as any).name}", slug="${(d as any).slug}"`)

  console.log('\n--- Fuzzy match: protein ---')
  const pr = await payload.find({ collection: 'tools', where: { name: { contains: 'protein' } }, limit: 5 })
  for (const d of pr.docs) console.log(`  ID ${(d as any).id}: name="${(d as any).name}", slug="${(d as any).slug}"`)

  // Step 2: Fetch article 17 body to find the dead links
  console.log('\n--- Article 17 body (searching for dead links) ---')
  const article = await payload.findByID({ collection: 'articles', id: 17, depth: 0 }) as any
  if (article.body && Array.isArray(article.body)) {
    for (let i = 0; i < article.body.length; i++) {
      const block = article.body[i]
      const text = typeof block.text === 'string' ? block.text : ''
      if (text.includes('body-fat-percentage') || text.includes('how-much-protein')) {
        console.log(`  Block [${i}] type=${block.type}: ${text.slice(0, 200)}`)
      }
    }
  } else {
    console.log('  Body is not an array. Type:', typeof article.body)
    // Check if it's Lexical rich text
    const bodyStr = JSON.stringify(article.body || {})
    if (bodyStr.includes('body-fat-percentage')) {
      console.log('  Found "body-fat-percentage" in body JSON')
      // Find context
      const idx = bodyStr.indexOf('body-fat-percentage')
      console.log('  Context:', bodyStr.slice(Math.max(0, idx - 80), idx + 120))
    }
    if (bodyStr.includes('how-much-protein')) {
      console.log('  Found "how-much-protein" in body JSON')
      const idx = bodyStr.indexOf('how-much-protein')
      console.log('  Context:', bodyStr.slice(Math.max(0, idx - 80), idx + 120))
    }
  }

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
