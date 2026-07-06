import { getPayload } from 'payload'
import configPromise from '@payload-config'

const REMAINING: Record<number, string[]> = {
  1: ['weight-loss', 'calories-and-energy', 'beginner-friendly'],
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

  for (const [articleId, slugs] of Object.entries(REMAINING)) {
    const id = Number(articleId)
    const tagIds = slugs.map((s) => slugToId.get(s)).filter((x) => x != null) as number[]
    try {
      await payload.update({ collection: 'articles', id, data: { tags: tagIds } as any })
      console.log(`Article ID ${id}: ${tagIds.length} tags OK [${slugs.join(', ')}]`)
    } catch (err) {
      console.log(`ERROR on article ${id}: ${(err as Error).message.slice(0, 200)}`)
    }
  }

  // Final count
  const all = await payload.find({ collection: 'articles', limit: 100, depth: 1 })
  let untagged = 0
  for (const doc of all.docs) {
    const a = doc as any
    if (!a.tags || a.tags.length === 0) {
      untagged++
      console.log(`  UNTAGGED: ID ${a.id} "${a.title}"`)
    }
  }
  console.log(`\nFinal: ${all.totalDocs} articles, ${untagged} untagged.`)

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
