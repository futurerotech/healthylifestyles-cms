import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')

  // Fetch first 10 articles (published first, then drafts)
  const result = await payload.find({
    collection: 'articles',
    limit: 10,
    sort: 'id',
    depth: 1,
  })

  console.log(`=== STEP 3: SEO Audit — Batch 1 (${result.docs.length} articles) ===\n`)

  for (const doc of result.docs) {
    const a = doc as any
    const seo = a.seo || {}
    const entities = a.semanticEntities || []

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`ARTICLE ID ${a.id}: ${a.title}`)
    console.log(`  Slug: ${a.slug}`)
    console.log(`  Status: ${a._status}`)
    console.log(`  Category: ${typeof a.category === 'object' ? a.category?.slug : a.category}`)
    console.log(`  Author: ${typeof a.author === 'object' ? a.author?.name : a.author}`)
    console.log(`  Reviewer: ${typeof a.reviewer === 'object' ? a.reviewer?.name : a.reviewer}`)
    console.log(`  Primary tool: ${typeof a.primaryTool === 'object' ? a.primaryTool?.slug : a.primaryTool}`)
    console.log(`  publishDate: ${a.publishDate || 'MISSING'}`)
    console.log(`  updatedDate: ${a.updatedDate || 'MISSING'}`)
    console.log()
    console.log(`  --- SEO FIELDS ---`)
    console.log(`  metaTitle: [${(seo.metaTitle || '').length} chars] "${seo.metaTitle || 'MISSING'}"`)
    console.log(`  metaDescription: [${(seo.metaDescription || '').length} chars] "${seo.metaDescription || 'MISSING'}"`)
    console.log(`  canonical: "${seo.canonical || 'MISSING'}"`)
    console.log(`  keywords: ${seo.keywords ? JSON.stringify(seo.keywords) : 'MISSING'}`)
    console.log(`  noindex: ${seo.noIndex ?? false}`)
    console.log(`  ogTitle: [${(seo.ogTitle || '').length} chars] "${seo.ogTitle || 'MISSING'}"`)
    console.log(`  ogDescription: [${(seo.ogDescription || '').length} chars] "${seo.ogDescription || 'MISSING'}"`)
    console.log(`  ogImage: ${seo.ogImage ? 'SET' : 'MISSING — needs human-picked 1200x630'}`)
    console.log(`  twitterTitle: [${(seo.twitterTitle || '').length} chars] "${seo.twitterTitle || 'MISSING'}"`)
    console.log(`  twitterDescription: [${(seo.twitterDescription || '').length} chars] "${seo.twitterDescription || 'MISSING'}"`)
    console.log(`  twitterImage: ${seo.twitterImage ? 'SET' : 'MISSING — needs human-picked 1200x630'}`)
    console.log()
    console.log(`  --- SEMANTIC ENTITIES (${entities.length}) ---`)
    if (entities.length > 0) {
      for (const e of entities) {
        console.log(`  - ${e.name || e.term || '?'}: ${e.url || 'NO URL'}`)
      }
    } else {
      console.log(`  NONE — needs 5 entities with authoritative URLs`)
    }
    console.log()
  }

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
