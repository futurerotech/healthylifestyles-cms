import { getPayload } from 'payload'
import configPromise from '@payload-config'

const TOOL = {
  name: 'Recipe Nutrition Analyzer',
  slug: 'recipe-nutrition-analyzer',
  categorySlug: 'nutrition',
  toolType: 'coded',
  codedComponent: 'RecipeAnalyzer',
  icon: 'utensils',
  gradient: 'green',
  accentColor: '#16a34a',
  minutesBadge: '30 sec',
  enabled: true,
  featured: true,
  riskLevel: 'low',
  relatedSlugs: ['macro-calculator', 'calorie-calculator', 'meal-plan-generator', 'anti-inflammatory-score'],
  seo: {
    metaTitle: 'Recipe Nutrition Analyzer — USDA-Powered Estimates',
    metaDescription: 'Paste any recipe or ingredient list and get estimated nutrition per serving. AI parses ingredients, USDA FoodData Central provides the numbers. Free, no signup.',
    canonical: '',
    keywords: ['recipe nutrition', 'recipe calorie calculator', 'nutrition analyzer', 'recipe macros', 'ingredient nutrition calculator'],
  },
}

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.')

  const catResult = await payload.find({ collection: 'categories', where: { slug: { equals: TOOL.categorySlug } }, limit: 1 })
  let catId: number
  if (catResult.docs.length) {
    catId = catResult.docs[0].id as number
    console.log(`Category found: ${TOOL.categorySlug} (ID ${catId})`)
  } else {
    const created = await payload.create({ collection: 'categories', data: { name: 'Nutrition', slug: TOOL.categorySlug, kind: 'tool' } as any })
    catId = created.id as number
    console.log(`Category created: ${TOOL.categorySlug} (ID ${catId})`)
  }

  const relatedIds: number[] = []
  for (const slug of TOOL.relatedSlugs) {
    const res = await payload.find({ collection: 'tools', where: { slug: { equals: slug } }, limit: 1 })
    if (res.docs.length) {
      relatedIds.push(res.docs[0].id as number)
      console.log(`  Related tool found: ${slug} (ID ${res.docs[0].id})`)
    } else {
      console.log(`  Related tool NOT found: ${slug} (skipping)`)
    }
  }

  const existing = await payload.find({ collection: 'tools', where: { slug: { equals: TOOL.slug } }, limit: 1 })
  if (existing.docs.length) {
    console.log(`Tool ${TOOL.slug} already exists (ID ${existing.docs[0].id}). Skipping.`)
    await payload.destroy()
    return
  }

  const toolData = {
    name: TOOL.name, slug: TOOL.slug, category: catId,
    toolType: TOOL.toolType, codedComponent: TOOL.codedComponent,
    icon: TOOL.icon, gradient: TOOL.gradient, accentColor: TOOL.accentColor,
    minutesBadge: TOOL.minutesBadge, enabled: TOOL.enabled, featured: TOOL.featured,
    riskLevel: TOOL.riskLevel, related: relatedIds, seo: TOOL.seo, _status: 'published',
  } as any

  const tool = await payload.create({ collection: 'tools', data: toolData })
  console.log('\n Recipe Nutrition Analyzer tool injected successfully!')
  console.log('   ID:', tool.id)
  console.log('   Slug:', (tool as any).slug)
  console.log('   Status:', (tool as any)._status)
  console.log('   Related tools:', relatedIds.join(', ') || '(none)')
  await payload.destroy()
}

main().catch((err) => { console.error('Script failed:', err); process.exit(1) })
