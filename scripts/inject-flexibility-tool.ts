import { getPayload } from 'payload'
import configPromise from '@payload-config'

const TOOL = {
  name: 'Flexibility & Mobility Score',
  slug: 'flexibility-mobility-score',
  categorySlug: 'fitness',
  toolType: 'coded',
  codedComponent: 'GenericCalculator',
  icon: 'activity',
  gradient: 'green',
  accentColor: '#16a34a',
  minutesBadge: 'Under 2 min',
  enabled: true,
  featured: false,
  riskLevel: 'low',
  relatedSlugs: ['recovery-time-calculator', 'strength-program-builder', 'sitting-disease-reversal-calculator'],
  seo: {
    metaTitle: 'Flexibility & Mobility Score — At-Home Test Battery',
    metaDescription: 'Test your flexibility and mobility at home with four simple tests. Get an overall score, per-area breakdown, and targeted stretch suggestions. Free, no equipment.',
    canonical: '',
    keywords: ['flexibility test', 'mobility score', 'sit and reach', 'shoulder mobility test', 'flexibility self assessment'],
  },
}

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.')

  // ── 1. Find or create fitness category ──────────────────────────────
  const catResult = await payload.find({ collection: 'categories', where: { slug: { equals: TOOL.categorySlug } }, limit: 1 })
  let catId: number
  if (catResult.docs.length) {
    catId = catResult.docs[0].id as number
    console.log(`Category found: ${TOOL.categorySlug} (ID ${catId})`)
  } else {
    const created = await payload.create({
      collection: 'categories',
      data: { name: 'Fitness', slug: TOOL.categorySlug, kind: 'section' },
    })
    catId = created.id as number
    console.log(`Category created: ${TOOL.categorySlug} (ID ${catId})`)
  }

  // ── 2. Resolve related tool IDs ─────────────────────────────────────
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

  // ── 3. Check if tool already exists ─────────────────────────────────
  const existing = await payload.find({ collection: 'tools', where: { slug: { equals: TOOL.slug } }, limit: 1 })
  if (existing.docs.length) {
    console.log(`Tool ${TOOL.slug} already exists (ID ${existing.docs[0].id}). Skipping creation.`)
    await payload.destroy()
    return
  }

  // ── 4. Create the tool ──────────────────────────────────────────────
  const toolData = {
    name: TOOL.name,
    slug: TOOL.slug,
    category: catId,
    toolType: TOOL.toolType,
    codedComponent: TOOL.codedComponent,
    icon: TOOL.icon,
    gradient: TOOL.gradient,
    accentColor: TOOL.accentColor,
    minutesBadge: TOOL.minutesBadge,
    enabled: TOOL.enabled,
    featured: TOOL.featured,
    riskLevel: TOOL.riskLevel,
    related: relatedIds,
    seo: TOOL.seo,
    _status: 'published',
  } as any

  const tool = await payload.create({ collection: 'tools', data: toolData })

  console.log('\n✅ Flexibility & Mobility Score tool injected successfully!')
  console.log('   ID:', tool.id)
  console.log('   Name:', (tool as any).name)
  console.log('   Slug:', (tool as any).slug)
  console.log('   Status:', (tool as any)._status)
  console.log('   Related tools:', relatedIds.join(', ') || '(none)')

  await payload.destroy()
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
