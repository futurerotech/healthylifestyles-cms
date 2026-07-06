import { getPayload } from 'payload'
import configPromise from '@payload-config'

/* ── Tag definitions ────────────────────────────────────────────────── */

interface TagDef {
  name: string
  slug: string
  description: string
}

// Existing tags to KEEP (with updated descriptions)
const EXISTING_TAGS: Record<number, TagDef> = {
  1: {
    name: 'Hydration',
    slug: 'hydration',
    description: 'Water intake, electrolytes, and why hydration affects everything from physical performance to kidney health. Practical daily targets and how to tell if you are drinking enough.',
  },
  3: {
    name: 'Muscle Building',
    slug: 'muscle-building',
    description: 'Build and preserve muscle through protein intake, resistance training, and recovery. Covers daily targets, timing, age-related muscle loss, and evidence-based protocols.',
  },
  4: {
    name: 'Sleep Optimization',
    slug: 'sleep-optimization',
    description: 'Better sleep through chronotype alignment, caffeine timing, blue light management, and sleep debt tracking. Practical habits that help you fall asleep faster and wake up refreshed.',
  },
  7: {
    name: 'Body Composition',
    slug: 'body-composition',
    description: 'Beyond the scale: body fat percentage, lean body mass, waist-to-height ratio, and why where you carry weight matters more than what the scale says.',
  },
  9: {
    name: 'Daily Nutrition',
    slug: 'daily-nutrition',
    description: 'Practical daily eating habits: macros, meal planning, recipe nutrition analysis, and what a healthy plate actually looks like. No fads, just sustainable fundamentals.',
  },
}

// Existing tags to RENAME
const RENAME_TAGS: Record<number, TagDef> = {
  2: {
    name: 'Weight Loss',
    slug: 'weight-loss',
    description: 'Sustainable, evidence-based approaches to losing weight: calorie deficits, realistic timelines, muscle preservation, and why consistency beats perfection every time.',
  },
  5: {
    name: 'Metabolism & Blood Sugar',
    slug: 'metabolism-and-blood-sugar',
    description: 'Metabolic age, insulin sensitivity, diabetes risk, and how lifestyle choices shape your metabolism over time. Understand the numbers and what moves them.',
  },
  10: {
    name: 'Recovery & Timelines',
    slug: 'recovery-and-timelines',
    description: 'How long things actually take: weight loss timelines, muscle recovery, sleep debt repayment, and realistic progress expectations. No overnight promises.',
  },
}

// Tag to DELETE (after merging articles into tag ID 2)
const DELETE_TAG_ID = 8 // "Weight Management" → merge into "Weight Loss" (ID 2)

// New tags to CREATE
const NEW_TAGS: TagDef[] = [
  {
    name: 'Protein',
    slug: 'protein',
    description: 'How much protein you need, the best food sources, timing for muscle and satiety, and what the latest research says about high-protein diets.',
  },
  {
    name: 'Calories & Energy',
    slug: 'calories-and-energy',
    description: 'Understanding energy balance, TDEE, how calories are burned, and why precision matters less than consistency. Tools and explainers for managing your energy intake.',
  },
  {
    name: 'Fasting & Timing',
    slug: 'fasting-and-timing',
    description: 'When you eat matters: intermittent fasting protocols, circadian eating patterns, meal timing, keto carb thresholds, and the science of time-restricted eating.',
  },
  {
    name: 'Heart Health',
    slug: 'heart-health',
    description: 'Cardiovascular risk factors, heart rate training zones, blood pressure categories, HRV tracking, and what the numbers actually mean for your heart.',
  },
  {
    name: "Women's Health",
    slug: 'womens-health',
    description: 'Pregnancy, fertility, menstrual health, due date calculations, and body composition considerations specific to women throughout every life stage.',
  },
  {
    name: 'Mental Wellness',
    slug: 'mental-wellness',
    description: 'Stress, burnout, depression and anxiety screening, breathing exercises, and when to seek professional help. Validated tools and honest, non-diagnostic guidance.',
  },
  {
    name: 'Beginner-Friendly',
    slug: 'beginner-friendly',
    description: 'Start here: simple explanations, easy-to-use tools, and no-jargon guides for people new to health tracking. Clear answers without overwhelming detail.',
  },
  {
    name: 'Evidence-Based',
    slug: 'evidence-based',
    description: 'Grounded in peer-reviewed research and official guidelines from CDC, NIH, WHO, AHA, and USDA. We cite our sources so you can verify every claim.',
  },
  {
    name: 'Healthy Habits',
    slug: 'healthy-habits',
    description: 'Small, sustainable lifestyle changes that compound over time: sleep hygiene, anti-inflammatory eating, gut health, daily routines, and building momentum.',
  },
  {
    name: 'Recipe & Meal Planning',
    slug: 'recipe-and-meal-planning',
    description: 'Turn nutrition knowledge into actual meals: recipe nutrition analysis, meal plan generators, macro tracking, food diaries, and practical kitchen strategies.',
  },
]

/* ── Article-to-tag assignments ─────────────────────────────────────── */
// Maps article ID → list of tag SLUGS (resolved to IDs after creation)
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

/* ── Execution ──────────────────────────────────────────────────────── */

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')

  // Build a slug → ID map as we go
  const slugToId = new Map<string, number>()

  // ── 1. Update existing tags (descriptions) ──────────────────────
  console.log('=== 1. Update existing tags with descriptions ===\n')
  for (const [id, def] of Object.entries(EXISTING_TAGS)) {
    const tagId = Number(id)
    await payload.update({
      collection: 'tags',
      id: tagId,
      data: { name: def.name, slug: def.slug, description: def.description } as any,
    })
    slugToId.set(def.slug, tagId)
    console.log(`  Updated ID ${tagId}: ${def.name} (slug: ${def.slug})`)
  }

  // ── 2. Rename existing tags ─────────────────────────────────────
  console.log('\n=== 2. Rename existing tags ===\n')
  for (const [id, def] of Object.entries(RENAME_TAGS)) {
    const tagId = Number(id)
    await payload.update({
      collection: 'tags',
      id: tagId,
      data: { name: def.name, slug: def.slug, description: def.description } as any,
    })
    slugToId.set(def.slug, tagId)
    console.log(`  Renamed ID ${tagId}: -> ${def.name} (slug: ${def.slug})`)
  }

  // ── 3. Merge: reassign articles from DELETE_TAG_ID to tag ID 2 ─
  console.log('\n=== 3. Merge Weight Management into Weight Loss ===\n')
  const allArticles = await payload.find({ collection: 'articles', limit: 100, depth: 1 })
  for (const doc of allArticles.docs) {
    const a = doc as any
    const tagIds: number[] = (a.tags || []).map((t: any) => typeof t === 'object' ? t.id : t)
    if (tagIds.includes(DELETE_TAG_ID)) {
      const merged = [...new Set([...tagIds.filter((id) => id !== DELETE_TAG_ID), 2])]
      await payload.update({ collection: 'articles', id: a.id, data: { tags: merged } as any })
      console.log(`  Article ID ${a.id}: removed tag ${DELETE_TAG_ID}, ensured tag 2`)
    }
  }

  // Verify no articles reference the tag to delete
  const remainingCheck = await payload.find({ collection: 'articles', limit: 100, depth: 1 })
  const stillReferenced = remainingCheck.docs.filter((d: any) => {
    const ids: number[] = (d.tags || []).map((t: any) => typeof t === 'object' ? t.id : t)
    return ids.includes(DELETE_TAG_ID)
  })

  if (stillReferenced.length === 0) {
    await payload.delete({ collection: 'tags', id: DELETE_TAG_ID })
    console.log(`  Deleted tag ID ${DELETE_TAG_ID} ("Weight Management") — 0 articles remaining`)
  } else {
    console.log(`  WARNING: ${stillReferenced.length} articles still reference tag ${DELETE_TAG_ID}. NOT deleting.`)
  }

  // ── 4. Create new tags ──────────────────────────────────────────
  console.log('\n=== 4. Create new tags ===\n')
  for (const def of NEW_TAGS) {
    // Check if already exists
    const existing = await payload.find({
      collection: 'tags',
      where: { slug: { equals: def.slug } },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      const t = existing.docs[0] as any
      slugToId.set(def.slug, t.id)
      console.log(`  Already exists: ${def.name} (ID ${t.id}, slug: ${def.slug}) — skipping creation`)
      continue
    }

    const created = await payload.create({
      collection: 'tags',
      data: { name: def.name, slug: def.slug, description: def.description } as any,
    })
    slugToId.set(def.slug, created.id)
    console.log(`  Created: ${def.name} (ID ${created.id}, slug: ${def.slug})`)
  }

  // ── 5. Re-tag all articles ──────────────────────────────────────
  console.log('\n=== 5. Re-tag all articles ===\n')
  for (const [articleIdStr, slugs] of Object.entries(ARTICLE_TAGS)) {
    const articleId = Number(articleIdStr)
    const tagIds: number[] = []
    for (const slug of slugs) {
      const id = slugToId.get(slug)
      if (id) {
        tagIds.push(id)
      } else {
        console.log(`  WARNING: tag slug "${slug}" not found for article ${articleId}`)
      }
    }

    const article = await payload.findByID({ collection: 'articles', id: articleId, depth: 0 }) as any
    const oldTagIds: number[] = (article.tags || []).map((t: any) => typeof t === 'object' ? t.id : t)
    await payload.update({ collection: 'articles', id: articleId, data: { tags: tagIds } as any })
    console.log(`  Article ID ${articleId} ("${(article.title || '').slice(0, 45)}..."): ${oldTagIds.length} tags -> ${tagIds.length} tags [${slugs.join(', ')}]`)
  }

  // ── 6. Final verification ───────────────────────────────────────
  console.log('\n=== 6. Final verification ===\n')
  const finalTags = await payload.find({ collection: 'tags', limit: 50, sort: 'name', depth: 0 })
  console.log(`Total tags: ${finalTags.totalDocs}`)
  for (const doc of finalTags.docs) {
    const t = doc as any
    const hasDesc = t.description ? 'YES' : 'NO'
    console.log(`  ID ${t.id}: ${t.name} (slug: ${t.slug}) [description: ${hasDesc}]`)
  }

  const finalArticles = await payload.find({ collection: 'articles', limit: 100, depth: 1 })
  console.log(`\nTotal articles: ${finalArticles.totalDocs}`)
  let untagged = 0
  for (const doc of finalArticles.docs) {
    const a = doc as any
    const tagCount = a.tags ? a.tags.length : 0
    if (tagCount === 0) {
      untagged++
      console.log(`  UNTAGGED: ID ${a.id} "${a.title}"`)
    }
  }
  if (untagged === 0) {
    console.log('All articles have at least 1 tag.')
  } else {
    console.log(`${untagged} articles have no tags.`)
  }

  await payload.destroy()
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
