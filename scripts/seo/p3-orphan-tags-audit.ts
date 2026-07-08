import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })

  const tags = ['heart-health', 'mental-wellness']

  for (const tagSlug of tags) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`TAG: ${tagSlug}`)
    console.log('='.repeat(60))

    // 1. Find the tag
    const tagRes = await payload.find({ collection: 'tags', where: { slug: { equals: tagSlug } }, limit: 1 })
    if (!tagRes.docs.length) {
      console.log(`  Tag not found: ${tagSlug}`)
      continue
    }
    const tag = tagRes.docs[0] as any
    console.log(`  Tag ID ${tag.id}: "${tag.name}" (slug: ${tag.slug})`)

    // 2. Find all articles with this tag
    const articles = await payload.find({
      collection: 'articles',
      limit: 50,
      depth: 1, // populate tags
    })

    const taggedArticles = articles.docs.filter((d: any) => {
      const tagIds: number[] = (d.tags || []).map((t: any) => typeof t === 'object' ? t.id : t)
      return tagIds.includes(tag.id)
    })

    console.log(`  Articles with this tag: ${taggedArticles.length}`)
    for (const a of taggedArticles) {
      console.log(`    ID ${a.id}: "${a.title}" [${a._status}]`)
    }

    // 3. Find all tools in related categories
    // heart-health → heart-vitals category; mental-wellness → mental-wellness category
    const catSlug = tagSlug === 'heart-health' ? 'heart-vitals' : 'mental-wellness'
    const catRes = await payload.find({ collection: 'categories', where: { slug: { equals: catSlug } }, limit: 1 })
    let tools: any[] = []
    if (catRes.docs.length) {
      const catId = catRes.docs[0].id
      const toolRes = await payload.find({ collection: 'tools', where: { category: { equals: catId } }, limit: 20, depth: 0 })
      tools = toolRes.docs
      console.log(`  Tools in category "${catSlug}": ${tools.length}`)
      for (const t of tools) {
        console.log(`    ID ${t.id}: "${t.name}" (slug: ${t.slug}) [${t._status}]`)
      }
    }

    // 4. Pick top 3 by inbound internal links (fallback since no analytics)
    // Count how many other articles link to each tagged article
    const allArtForLinks = await payload.find({ collection: 'articles', limit: 100, depth: 0 })
    const inboundCounts = new Map<number, number>()
    for (const a of taggedArticles as any[]) {
      let count = 0
      for (const other of allArtForLinks.docs) {
        if (other.id === a.id) continue
        const bodyStr = JSON.stringify((other as any).layout || [])
        if (bodyStr.includes(a.slug)) count++
      }
      inboundCounts.set(a.id, count)
    }

    console.log(`  \n  Inbound link counts (fallback metric — no analytics available):`)
    for (const a of taggedArticles as any[]) {
      console.log(`    ID ${a.id}: "${a.title}" — ${inboundCounts.get(a.id)} inbound links`)
    }

    // Sort by inbound links, pick top 3
    const sorted = [...taggedArticles].sort((a: any, b: any) => (inboundCounts.get(b.id) || 0) - (inboundCounts.get(a.id) || 0))
    const top3 = sorted.slice(0, 3)
    console.log(`  \n  Top 3 selected (by inbound links, fallback used: no analytics):`)
    for (const a of top3 as any[]) {
      console.log(`    ID ${a.id}: "${a.title}"`)
    }

    // 5. Check current inbound links to the TAG page itself
    let tagInbound = 0
    for (const other of allArtForLinks.docs) {
      const bodyStr = JSON.stringify((other as any).layout || [])
      if (bodyStr.includes(`/wellness-hub/tag/${tagSlug}`) || bodyStr.includes(`tag/${tagSlug}`)) {
        tagInbound++
      }
    }
    console.log(`  Current inbound links to /wellness-hub/tag/${tagSlug}: ${tagInbound}`)
  }

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
