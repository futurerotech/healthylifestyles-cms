import { getPayload } from 'payload'
import configPromise from '@payload-config'

// ── Source JSON ─────────────────────────────────────────────────────
const ARTICLE_JSON = {
  tool: 'metabolic-age-calculator',
  title: 'What Is Metabolic Age and What Does It Say About Your Health?',
  excerpt: 'Learn how your metabolic age compares to your actual age, what drives your basal metabolic rate (BMR), and actionable steps to improve your metabolic health.',
  snippetAnswer: 'Your metabolic age compares your basal metabolic rate (BMR) to the average BMR for your chronological age group. A metabolic age lower than your actual age indicates optimal fitness and muscle mass, while a higher age suggests a slower metabolism, often improved through strength training and nutrition.',
  category: 'fitness-and-metabolism',
  author: 'editorial-team',
  primaryTool: 'metabolic-age-calculator',
  relatedTools: ['calories-burned-calculator', 'lean-body-mass-calculator', 'vo2-max-calculator'],
  layoutBlocks: [
    { type: 'paragraph', text: 'Your metabolic age isn\'t tracked by birthdays—it is driven entirely by how efficiently your body burns energy at rest. If your basal metabolic rate (BMR) matches the average for someone ten years younger, your metabolic age is a decade lower than your chronological age. That is the part most guides skip: metabolic age is essentially a proxy for your muscle-to-fat ratio.' },
    { type: 'toolEmbed', toolSlug: 'metabolic-age-calculator' },
    { type: 'heading', level: 2, text: 'How is Metabolic Age Calculated?' },
    { type: 'paragraph', text: 'To find your metabolic age, you first need to determine your Basal Metabolic Rate (BMR)—the minimum number of calories your body requires to perform basic life-sustaining functions like breathing, circulation, and cell production. Once your BMR is calculated, it is compared to the benchmark averages of different age groups. Muscle tissue burns more calories at rest than fat tissue, meaning individuals with higher muscle mass naturally have a higher BMR and, consequently, a lower metabolic age.' },
    { type: 'heading', level: 2, text: 'Chronological Age vs. Metabolic Age: What is the Difference?' },
    { type: 'paragraph', text: 'While you cannot pause your chronological age, you have significant control over your metabolic age. Here is how they contrast in practical terms:' },
    { type: 'table', headers: ['Metric', 'Chronological Age', 'Metabolic Age'], rows: [['Definition', 'The exact number of years you have been alive.', 'A comparison of your BMR to age group averages.'], ['Controllability', 'Fixed and unstoppable.', 'Highly modifiable through lifestyle changes.'], ['Health Indication', 'A general marker, but tells little about internal fitness.', 'A strong indicator of muscle mass and metabolic efficiency.']] },
    { type: 'heading', level: 2, text: 'Why Is My Metabolic Age Higher Than My Actual Age?' },
    { type: 'paragraph', text: 'A metabolic age higher than your chronological age usually signals a lower-than-average BMR for your demographic. This is most commonly caused by:' },
    { type: 'list', ordered: false, items: ['Low muscle mass (sarcopenia) due to a lack of resistance training.', 'A sedentary lifestyle that reduces overall daily energy expenditure.', 'Chronic sleep deprivation, which disrupts metabolic hormones like insulin and cortisol.', 'Extreme calorie restriction (crash dieting), which forces the body to slow down its metabolism to conserve energy.'] },
    { type: 'heading', level: 2, text: 'How to Lower Your Metabolic Age' },
    { type: 'paragraph', text: 'Lowering your metabolic age requires increasing your resting energy expenditure. You can achieve this by focusing on body composition rather than just weight loss. Incorporate progressive resistance training 2-3 times a week to build lean muscle mass. Pair this with a high-protein diet to support muscle repair and ensure you are getting 7-9 hours of quality sleep to maintain hormonal balance.' },
    { type: 'disclaimer', text: 'This article and calculator are for educational purposes only and do not constitute medical advice. Consult a healthcare provider or a registered dietitian for personalized guidance regarding your metabolic health and weight management.' },
  ],
  faq: [
    { question: 'Is metabolic age a true medical diagnosis?', answer: 'No. It is a fitness metric used to help you understand your basal metabolic rate in context. It is not a clinical diagnostic tool.' },
    { question: 'Can I lower my metabolic age quickly?', answer: 'Lowering your metabolic age requires building lean muscle mass and improving metabolic efficiency, which takes consistent resistance training and nutrition over several months. There are no safe overnight fixes.' },
    { question: 'Does weight loss automatically lower my metabolic age?', answer: 'Not necessarily. If you lose weight by losing muscle mass (often caused by severe calorie deficits without protein or lifting), your BMR drops, which can actually increase your metabolic age.' },
    { question: 'Why do men generally have a lower metabolic age than women?', answer: 'Men typically naturally carry a higher percentage of lean muscle mass and lower body fat compared to women of the same chronological age, resulting in a higher BMR.' },
  ],
  sources: [
    { label: 'National Institutes of Health — Physiology, Basal Metabolic Rate (2023)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK459224/' },
    { label: 'MedlinePlus — Metabolism (2022)', url: 'https://medlineplus.gov/metabolism.html' },
    { label: 'CDC — Physical Activity for a Healthy Weight', url: 'https://www.cdc.gov/healthyweight/physical_activity/index.html' },
  ],
  semanticEntities: [
    { term: 'Basal metabolic rate', url: 'https://medlineplus.gov/ency/article/002257.htm' },
    { term: 'Metabolism', url: 'https://medlineplus.gov/metabolism.html' },
    { term: 'Muscle tissue', url: 'https://medlineplus.gov/ency/imagepages/19841.htm' },
    { term: 'Sarcopenia', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4269139/' },
    { term: 'Resistance training', url: 'https://medlineplus.gov/ency/patientinstructions/000803.htm' },
  ],
  seo: {
    metaTitle: 'Metabolic Age Calculator & Guide: Improve Your Health',
    metaDescription: 'Use our Metabolic Age Calculator to compare your BMR to your actual age. Learn actionable, science-backed ways to build muscle and lower your metabolic age.',
    slug: 'metabolic-age-calculator-guide',
    canonical: '',
    keywords: ['metabolic age calculator', 'how to lower metabolic age', 'what is metabolic age', 'basal metabolic rate', 'chronological age vs metabolic age'],
  },
  ogTitle: 'Metabolic Age Calculator: What Does It Say About Your Health?',
  ogDescription: 'Discover how your metabolic age compares to your actual age, and learn how to improve your basal metabolic rate.',
  twitterTitle: 'Metabolic Age Calculator: What Does It Say About Your Health?',
  twitterDescription: 'Discover how your metabolic age compares to your actual age, and learn how to improve your BMR.',
  aiGenerated: true,
  reviewedByHuman: false,
}

async function ensureTool(payload: any, slug: string, catId: number): Promise<number> {
  const existing = await payload.find({ collection: 'tools', where: { slug: { equals: slug } }, limit: 1 })
  if (existing.docs.length) {
    const id = existing.docs[0].id as number
    console.log(`  Tool found: ${slug} (ID ${id})`)
    return id
  }
  const displayName = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  const created = await payload.create({
    collection: 'tools',
    data: { name: displayName, slug, category: catId, toolType: 'coded', codedComponent: 'GenericCalculator', enabled: true, featured: false } as any,
  })
  console.log(`  Tool created: ${slug} (ID ${created.id})`)
  return created.id
}

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.')

  // ── 1. Upsert category ────────────────────────────────────────────
  const catSlug = ARTICLE_JSON.category
  let cat = await payload.find({ collection: 'categories', where: { slug: { equals: catSlug } }, limit: 1 })
  let catId: number
  if (cat.docs.length) {
    catId = cat.docs[0].id as number
    console.log(`Category found: ${catSlug} (ID ${catId})`)
  } else {
    const displayName = catSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    const created = await payload.create({ collection: 'categories', data: { name: displayName, slug: catSlug, kind: 'section' } })
    catId = created.id as number
    console.log(`Category created: ${catSlug} (ID ${catId})`)
  }

  // ── 2. Upsert author ──────────────────────────────────────────────
  const authorSlug = ARTICLE_JSON.author
  let auth = await payload.find({ collection: 'authors', where: { slug: { equals: authorSlug } }, limit: 1 })
  let authorId: number
  if (auth.docs.length) {
    authorId = auth.docs[0].id as number
    console.log(`Author found: ${authorSlug} (ID ${authorId})`)
  } else {
    const displayName = authorSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    const created = await payload.create({ collection: 'authors', data: { name: displayName, slug: authorSlug, schemaType: 'Organization' } })
    authorId = created.id as number
    console.log(`Author created: ${authorSlug} (ID ${authorId})`)
  }

  // ── 3. Ensure primary tool ────────────────────────────────────────
  const primaryToolId = await ensureTool(payload, ARTICLE_JSON.primaryTool, catId)

  // ── 4. Ensure related tools ───────────────────────────────────────
  const relatedToolIds: number[] = []
  for (const slug of ARTICLE_JSON.relatedTools) {
    const id = await ensureTool(payload, slug, catId)
    relatedToolIds.push(id)
  }

  // ── 5. Build layout blocks ────────────────────────────────────────
  const layout: any[] = []
  for (const b of ARTICLE_JSON.layoutBlocks) {
    switch (b.type) {
      case 'paragraph':
        layout.push({ blockType: 'text', style: 'p', text: b.text })
        break
      case 'heading':
        layout.push({ blockType: 'text', style: `h${b.level}` as any, text: b.text })
        break
      case 'toolEmbed':
        layout.push({ blockType: 'toolEmbed', tool: primaryToolId, label: 'Try the Metabolic Age Calculator' })
        break
      case 'table':
        layout.push({
          blockType: 'table',
          caption: '',
          headers: b.headers,
          rows: (b as any).rows!.map((cells: string[]) => ({ cells })),
        })
        break
      case 'list':
        layout.push({
          blockType: 'list',
          style: b.ordered ? 'ordered' : 'unordered' as any,
          items: b.items!.map((text: string) => ({ text })),
        })
        break
      case 'disclaimer':
        layout.push({ blockType: 'callout', tone: 'warning', title: 'Medical disclaimer', text: b.text })
        break
    }
  }

  // ── 6. Build SEO object ───────────────────────────────────────────
  const slug = ARTICLE_JSON.seo.slug || undefined
  const seo = {
    metaTitle: ARTICLE_JSON.seo.metaTitle,
    metaDescription: ARTICLE_JSON.seo.metaDescription,
    canonical: ARTICLE_JSON.seo.canonical || undefined,
    keywords: ARTICLE_JSON.seo.keywords,
    ogTitle: ARTICLE_JSON.ogTitle,
    ogDescription: ARTICLE_JSON.ogDescription,
    twitterTitle: ARTICLE_JSON.twitterTitle,
    twitterDescription: ARTICLE_JSON.twitterDescription,
  }

  // ── 7. Build full article data ────────────────────────────────────
  const articleData = {
    title: ARTICLE_JSON.title,
    excerpt: ARTICLE_JSON.excerpt,
    slug,
    category: catId,
    author: authorId,
    primaryTool: primaryToolId,
    relatedTools: relatedToolIds,
    layout,
    faq: ARTICLE_JSON.faq,
    sources: ARTICLE_JSON.sources,
    semanticEntities: ARTICLE_JSON.semanticEntities,
    seo,
    aiGenerated: ARTICLE_JSON.aiGenerated,
    reviewedByHuman: ARTICLE_JSON.reviewedByHuman,
    _status: 'draft',
  } as any

  const article = await payload.create({ collection: 'articles', data: articleData })

  console.log('\n✅ Article injected successfully!')
  console.log('   ID:', article.id)
  console.log('   Title:', (article as any).title)
  console.log('   Slug:', (article as any).slug)
  console.log('   Status:', (article as any)._status)

  await payload.destroy()
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
