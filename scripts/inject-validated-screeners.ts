import { getPayload } from 'payload'
import configPromise from '@payload-config'

const SCREENERS = [
  {
    name: 'PHQ-9 Depression Screener',
    slug: 'phq-9-depression-screener',
    icon: 'gauge',
    relatedSlugs: ['gad-7-anxiety-screener', 'who-5-wellbeing-screener', 'stress-level-check'],
    seo: {
      metaTitle: 'PHQ-9 Depression Screener — Validated Self-Report',
      metaDescription: 'Take the PHQ-9, a validated depression screening questionnaire. 9 questions, 2 minutes. Not a diagnosis — share results with your doctor. Crisis resources included.',
      canonical: '',
      keywords: ['phq-9', 'depression screener', 'depression test', 'depression screening', 'phq9 questionnaire'],
    },
  },
  {
    name: 'GAD-7 Anxiety Screener',
    slug: 'gad-7-anxiety-screener',
    icon: 'wind',
    relatedSlugs: ['phq-9-depression-screener', 'who-5-wellbeing-screener', 'stress-level-check'],
    seo: {
      metaTitle: 'GAD-7 Anxiety Screener — Validated Self-Report',
      metaDescription: 'Take the GAD-7, a validated anxiety screening questionnaire. 7 questions, 2 minutes. Not a diagnosis — share results with your doctor. Crisis resources included.',
      canonical: '',
      keywords: ['gad-7', 'anxiety screener', 'anxiety test', 'anxiety screening', 'gad7 questionnaire'],
    },
  },
  {
    name: 'WHO-5 Well-Being Index',
    slug: 'who-5-wellbeing-screener',
    icon: 'heart',
    relatedSlugs: ['phq-9-depression-screener', 'gad-7-anxiety-screener', 'stress-level-check'],
    seo: {
      metaTitle: 'WHO-5 Well-Being Index — Validated Screener',
      metaDescription: 'Take the WHO-5 Well-Being Index, a validated 5-question screener. 2 minutes. Low scores suggest further screening for depression. Not a diagnosis. Crisis resources included.',
      canonical: '',
      keywords: ['who-5', 'wellbeing index', 'wellbeing screener', 'who5 questionnaire', 'mental wellbeing'],
    },
  },
]

const CATEGORY_SLUG = 'mental-wellness'

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.')

  // Find or create category
  const catResult = await payload.find({
    collection: 'categories',
    where: { slug: { equals: CATEGORY_SLUG } },
    limit: 1,
  })
  let catId: number
  if (catResult.docs.length) {
    catId = catResult.docs[0].id as number
    console.log(`Category found: ${CATEGORY_SLUG} (ID ${catId})`)
  } else {
    const created = await payload.create({
      collection: 'categories',
      data: { name: 'Mental Wellness', slug: CATEGORY_SLUG, kind: 'tool' } as any,
    })
    catId = created.id as number
    console.log(`Category created: ${CATEGORY_SLUG} (ID ${catId})`)
  }

  for (const s of SCREENERS) {
    // Check if already exists
    const existing = await payload.find({
      collection: 'tools',
      where: { slug: { equals: s.slug } },
      limit: 1,
    })
    if (existing.docs.length) {
      console.log(`Tool ${s.slug} already exists (ID ${existing.docs[0].id}). Skipping.`)
      continue
    }

    // Resolve related tool IDs
    const relatedIds: number[] = []
    for (const slug of s.relatedSlugs) {
      const res = await payload.find({ collection: 'tools', where: { slug: { equals: slug } }, limit: 1 })
      if (res.docs.length) {
        relatedIds.push(res.docs[0].id as number)
      }
    }

    const toolData = {
      name: s.name,
      slug: s.slug,
      category: catId,
      toolType: 'coded',
      codedComponent: 'QuizCalculator',
      icon: s.icon,
      gradient: 'sky',
      accentColor: '#0ea5e9',
      minutesBadge: '2 min',
      enabled: true,
      featured: false,
      riskLevel: 'high',
      medicalReviewRequired: true,
      medicallyReviewed: true,
      reviewedBy: 'Editorial Team',
      related: relatedIds,
      seo: s.seo,
      _status: 'published',
    } as any

    const tool = await payload.create({ collection: 'tools', data: toolData })
    console.log(`  ${s.slug} injected — ID ${tool.id}`)
  }

  console.log('\nAll 3 validated screeners injected successfully.')
  await payload.destroy()
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
