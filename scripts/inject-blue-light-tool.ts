import { getPayload } from 'payload'
import configPromise from '@payload-config'

const TOOL = {
  name: 'Blue Light Exposure Estimator',
  slug: 'blue-light-exposure-estimator',
  categorySlug: 'sleep',
  toolType: 'coded',
  codedComponent: 'GenericCalculator',
  icon: 'moon-star',
  gradient: 'indigo',
  accentColor: '#6366f1',
  minutesBadge: 'Under 2 min',
  enabled: true,
  featured: false,
  riskLevel: 'low',
  relatedSlugs: ['caffeine-curfew-calculator', 'sleep-chronotype-quiz', 'sleep-calculator'],
  seo: {
    metaTitle: 'Blue Light Exposure Estimator — Evening Screen Habits & Sleep',
    metaDescription: 'Score your evening light hygiene: screen time before bed, device type, night mode, room lighting. Get a 0-100 score with specific tips to improve. Educational, not medical.',
    canonical: '',
    keywords: ['blue light', 'screen time sleep', 'evening light hygiene', 'night mode', 'blue light filter', 'melatonin screen'],
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
    const created = await payload.create({
      collection: 'categories',
      data: { name: 'Sleep & Recovery', slug: TOOL.categorySlug, kind: 'tool' },
    })
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

  console.log('\n Blue Light Exposure Estimator tool injected successfully!')
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
