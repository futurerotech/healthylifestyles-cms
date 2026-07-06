import { getPayload } from 'payload'
import configPromise from '@payload-config'

const ARTICLE_TAGS: Record<number, string[]> = {
  1: ['weight-loss', 'calories-and-energy', 'beginner-friendly'],
  2: ['protein', 'muscle-building', 'evidence-based'],
  3: ['body-composition', 'beginner-friendly'],
  4: ['sleep-optimization', 'healthy-habits'],
  5: ['muscle-building', 'weight-loss', 'body-composition', 'evidence-based'],
  6: ['womens-health', 'beginner-friendly'],
  7: ['fasting-and-timing', 'beginner-friendly', 'weight-loss'],
  8: ['sleep-optimization', 'healthy-habits'],
  9: ['protein', 'recipe-and-meal-planning', 'muscle-building', 'daily-nutrition'],
  10: ['weight-loss', 'recovery-and-timelines', 'evidence-based'],
  11: ['daily-nutrition', 'calories-and-energy', 'protein'],
  13: ['hydration', 'beginner-friendly', 'evidence-based'],
  15: ['metabolism-and-blood-sugar', 'evidence-based'],
  16: ['calories-and-energy', 'evidence-based', 'body-composition'],
  17: ['body-composition', 'muscle-building', 'evidence-based'],
  18: ['metabolism-and-blood-sugar', 'evidence-based'],
  19: ['recipe-and-meal-planning', 'calories-and-energy', 'daily-nutrition'],
  20: ['daily-nutrition', 'fasting-and-timing', 'evidence-based'],
  21: ['daily-nutrition', 'healthy-habits', 'evidence-based'],
  22: ['daily-nutrition', 'healthy-habits', 'evidence-based'],
  23: ['recipe-and-meal-planning', 'healthy-habits', 'daily-nutrition'],
}

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.')

  // Build slug -> ID map
  const tags = await payload.find({ collection: 'tags', limit: 50, depth: 0 })
  const slugToId = new Map<string, number>()
  for (const t of tags.docs) {
    slugToId.set((t as any).slug, (t as any).id)
  }
  console.log(`Found ${tags.totalDocs} tags.`)

  // Re-tag articles one by one
  console.log('\n=== Re-tagging articles ===\n')
  let done = 0
  for (const [articleId, slugs] of Object.entries(ARTICLE_TAGS)) {
    const id = Number(articleId)
    const tagIds = slugs.map((s) => slugToId.get(s)).filter((x) => x != null) as number[]

    try {
      const article = await payload.findByID({ collection: 'articles', id, depth: 0 }) as any
      await payload.update({ collection: 'articles', id, data: { tags: tagIds } as any })
      done++
      console.log(`  [${done}/${Object.keys(ARTICLE_TAGS).length}] Article ID ${id}: ${tagIds.length} tags [${slugs.join(', ')}]`)
    } catch (err) {
      console.log(`  ERROR on article ${id}: ${(err as Error).message}`)
    }
  }

  // Final verification
  console.log(`\nRe-tagged ${done} articles.`)
  const all = await payload.find({ collection: 'articles', limit: 100, depth: 1 })
  let untagged = 0
  for (const doc of all.docs) {
    const a = doc as any
    if (!a.tags || a.tags.length === 0) untagged++
  }
  console.log(`Final: ${all.totalDocs} articles, ${untagged} untagged.`)

  await payload.destroy()
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
