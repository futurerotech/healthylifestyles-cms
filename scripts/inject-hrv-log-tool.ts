import { getPayload } from 'payload'
import configPromise from '@payload-config'

const TOOL = {
  name: 'HRV Explainer & Log',
  slug: 'hrv-explainer-log',
  categorySlug: 'heart-vitals',
  toolType: 'coded',
  codedComponent: 'HRVLog',
  icon: 'activity',
  gradient: 'blue',
  accentColor: '#3b82f6',
  minutesBadge: 'Ongoing',
  enabled: true,
  featured: false,
  riskLevel: 'low',
  relatedSlugs: ['resting-heart-rate-checker', 'stress-level-check', 'sleep-quality-check'],
  seo: {
    metaTitle: 'HRV Explainer & Log — Track Your Heart Rate Variability',
    metaDescription: 'Learn what HRV is, log readings from your own device, and see your trend over time. Educational — HRV cannot be calculated from age or pulse alone. Not medical advice.',
    canonical: '',
    keywords: ['hrv', 'heart rate variability', 'hrv tracker', 'hrv log', 'rmssd', 'hrv chart'],
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
      data: { name: 'Heart & Vitals', slug: TOOL.categorySlug, kind: 'section' },
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

  console.log('\n HRV Explainer & Log tool injected successfully!')
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
