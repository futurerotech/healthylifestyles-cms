import { getPayload } from 'payload'
import configPromise from '@payload-config'

const ARTICLE_JSON = {
  tool: 'lean-body-mass-calculator',
  title: 'What Is Lean Body Mass and Why Does It Matter More Than Weight?',
  excerpt: 'Learn how to calculate your lean body mass, the difference between lean mass and body fat, and why building muscle is the key to a healthy metabolism.',
  snippetAnswer: 'Lean Body Mass (LBM) is the total weight of your body minus your fat mass. It includes your organs, skin, bones, body water, and muscle mass. Calculating your LBM provides a much more accurate picture of your health and metabolic rate than simply tracking your total body weight on a scale.',
  category: 'fitness-and-metabolism',
  author: 'editorial-team',
  primaryTool: 'lean-body-mass-calculator',
  relatedTools: ['body-fat-percentage-calculator', 'metabolic-age-calculator', 'how-much-protein-do-i-need'],
  layoutBlocks: [
    { type: 'paragraph', text: 'When most people decide to get healthy, they immediately focus on a single metric: the number on the scale. But total body weight tells an incomplete and often misleading story. If you lose five pounds, did you lose fat, water, or metabolism-boosting muscle? That is the part most guides skip: true metabolic health isn\'t about weighing less; it\'s about optimizing your Lean Body Mass (LBM).' },
    { type: 'toolEmbed', toolSlug: 'lean-body-mass-calculator' },
    { type: 'heading', level: 2, text: 'What Exactly Is Lean Body Mass?' },
    { type: 'paragraph', text: 'Your total body weight is composed of two main categories: fat mass and lean mass. Lean Body Mass is everything in your body that is not fat. This includes:' },
    { type: 'list', ordered: false, items: ['Skeletal muscle tissue', 'Bones and connective tissue', 'Organs (brain, heart, liver, etc.)', 'Body water (intracellular and extracellular fluids)'] },
    { type: 'paragraph', text: 'Because organs and bones remain relatively constant in adulthood, changes in your Lean Body Mass are primarily driven by fluctuations in your muscle mass and hydration levels.' },
    { type: 'heading', level: 2, text: 'Why Lean Mass is Crucial for Your Metabolism' },
    { type: 'paragraph', text: 'Your Basal Metabolic Rate (BMR)—the number of calories your body burns at rest—is directly correlated to your Lean Body Mass. Muscle tissue is highly metabolically active, meaning it requires significantly more energy to maintain than fat tissue. The higher your LBM, the more calories you burn simply sitting on the couch.' },
    { type: 'heading', level: 2, text: 'How to Protect Your Lean Mass While Losing Weight' },
    { type: 'paragraph', text: 'One of the biggest mistakes in weight loss is severe calorie restriction without adequate protein or resistance training. This causes the body to break down muscle tissue for energy, resulting in a loss of Lean Body Mass and a slower metabolism. To protect your LBM, aim to consume 0.7 to 1 gram of protein per pound of your target body weight and incorporate strength training 2-3 times per week.' },
    { type: 'disclaimer', text: 'This article and calculator are for educational purposes only and do not constitute medical advice. Consult a healthcare provider, physical therapist, or registered dietitian before making significant changes to your diet or exercise routine.' },
  ],
  faq: [
    { question: 'Is lean body mass the same as muscle mass?', answer: 'No. Muscle mass is a component of your Lean Body Mass, but LBM also includes your bones, water, and organs. Muscle mass specifically refers to the weight of your skeletal muscles.' },
    { question: 'What is a healthy Lean Body Mass percentage?', answer: 'Because LBM is the inverse of your body fat percentage, a healthy LBM percentage is generally 75-80% for women and 80-85% for men, though optimal ranges vary by age and athletic level.' },
    { question: 'Can I increase my lean body mass without gaining fat?', answer: 'Yes, this is known as body recomposition. It is typically achieved by eating at a slight caloric maintenance or very small deficit, consuming high protein, and engaging in progressive resistance training.' },
  ],
  sources: [
    { label: 'National Institutes of Health (NIH) — Body Composition and Health', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6021272/' },
    { label: 'MedlinePlus — Muscle Mass', url: 'https://medlineplus.gov/ency/imagepages/19841.htm' },
  ],
  semanticEntities: [
    { term: 'Lean body mass', url: 'https://www.ncbi.nlm.nih.gov/mesh/68001823' },
    { term: 'Body composition', url: 'https://medlineplus.gov/bodyweight.html' },
    { term: 'Skeletal muscle', url: 'https://medlineplus.gov/ency/imagepages/19841.htm' },
  ],
  seo: {
    metaTitle: 'Lean Body Mass Calculator: Track Your Muscle & Metabolism',
    metaDescription: 'Calculate your Lean Body Mass (LBM) to understand your true body composition. Learn why muscle mass is more important than the number on the scale.',
    slug: 'lean-body-mass-calculator-guide',
    canonical: '',
    keywords: ['lean body mass calculator', 'calculate LBM', 'lean mass vs muscle mass', 'body composition', 'protect lean muscle'],
  },
  ogTitle: 'Lean Body Mass Calculator: Understand Your Body Composition',
  ogDescription: 'Find out your Lean Body Mass and learn why building muscle is the key to a healthy metabolism.',
  twitterTitle: 'Lean Body Mass Calculator: Understand Your Body Composition',
  twitterDescription: 'Find out your Lean Body Mass and learn why building muscle is the key to a healthy metabolism.',
  aiGenerated: true,
  reviewedByHuman: false,
}

function scoreArticleRelevance(title: string): number {
  const lower = title.toLowerCase()
  let score = 0
  const weightTerms = ['weight', 'lose weight', 'losing weight', 'weight loss']
  const muscleTerms = ['muscle', 'muscular', 'lean mass', 'strength']
  const proteinTerms = ['protein', 'macros', 'macro']
  for (const t of weightTerms) { if (lower.includes(t)) score += 3 }
  for (const t of muscleTerms) { if (lower.includes(t)) score += 4 }
  for (const t of proteinTerms) { if (lower.includes(t)) score += 4 }
  return score
}

async function ensureTool(payload: any, slug: string, catId: number): Promise<number> {
  const existing = await payload.find({ collection: 'tools', where: { slug: { equals: slug } }, limit: 1 })
  if (existing.docs.length) {
    const id = existing.docs[0].id as number
    console.log(`  Tool found: ${slug} (ID ${id})`)
    return id
  }
  const displayName = slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const created = await payload.create({ collection: 'tools', data: { name: displayName, slug, category: catId, toolType: 'coded', codedComponent: 'GenericCalculator', enabled: true, featured: false } as any })
  console.log(`  Tool created: ${slug} (ID ${created.id})`)
  return created.id
}

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.')

  // ── 1. Upsert category ──────────────────────────────────────────────
  const catSlug = ARTICLE_JSON.category
  let cat = await payload.find({ collection: 'categories', where: { slug: { equals: catSlug } }, limit: 1 })
  let catId: number
  if (cat.docs.length) {
    catId = cat.docs[0].id as number
    console.log(`Category found: ${catSlug} (ID ${catId})`)
  } else {
    const displayName = catSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const created = await payload.create({ collection: 'categories', data: { name: displayName, slug: catSlug, kind: 'section' } })
    catId = created.id as number
    console.log(`Category created: ${catSlug} (ID ${catId})`)
  }

  // ── 2. Upsert author ────────────────────────────────────────────────
  const authorSlug = ARTICLE_JSON.author
  let auth = await payload.find({ collection: 'authors', where: { slug: { equals: authorSlug } }, limit: 1 })
  let authorId: number
  if (auth.docs.length) {
    authorId = auth.docs[0].id as number
    console.log(`Author found: ${authorSlug} (ID ${authorId})`)
  } else {
    const displayName = authorSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const created = await payload.create({ collection: 'authors', data: { name: displayName, slug: authorSlug, schemaType: 'Organization' } })
    authorId = created.id as number
    console.log(`Author created: ${authorSlug} (ID ${authorId})`)
  }

  // ── 3. Fetch reviewer (medical-review board) ────────────────────────
  const reviewerResult = await payload.find({ collection: 'authors', where: { slug: { equals: 'medical-review' } }, limit: 1 })
  let reviewerId: number
  if (reviewerResult.docs.length) {
    reviewerId = reviewerResult.docs[0].id as number
    console.log(`Reviewer found: medical-review (ID ${reviewerId})`)
  } else {
    const created = await payload.create({ collection: 'authors', data: { name: 'HealthyLifeStyles Medical Review Board', slug: 'medical-review', schemaType: 'Organization' } })
    reviewerId = created.id as number
    console.log(`Reviewer created: medical-review (ID ${reviewerId})`)
  }

  // ── 4. Ensure primary tool ──────────────────────────────────────────
  const primaryToolId = await ensureTool(payload, ARTICLE_JSON.primaryTool, catId)

  // ── 5. Ensure related tools ─────────────────────────────────────────
  const relatedToolIds: number[] = []
  for (const slug of ARTICLE_JSON.relatedTools) {
    const id = await ensureTool(payload, slug, catId)
    relatedToolIds.push(id)
  }

  // ── 6. Fetch tags matching Body Composition, Muscle Building, Weight Management ──
  const targetTagSlugs = ['body-composition', 'muscle-building', 'weight-management']
  const tagIds: number[] = []
  for (const slug of targetTagSlugs) {
    const tagResult = await payload.find({ collection: 'tags', where: { slug: { equals: slug } }, limit: 1 })
    if (tagResult.docs.length) {
      const id = tagResult.docs[0].id as number
      tagIds.push(id)
      console.log(`  Tag found: ${slug} (ID ${id})`)
    } else {
      const displayName = slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const created = await payload.create({ collection: 'tags', data: { name: displayName, slug } })
      tagIds.push(created.id as number)
      console.log(`  Tag created: ${slug} (ID ${created.id})`)
    }
  }

  // ── 7. Fetch existing articles & select top 3 related by relevance ──
  const existing = await payload.find({ collection: 'articles', limit: 50, depth: 0 })
  const scored = existing.docs
    .map((d: any) => ({ id: d.id as number, title: d.title || '', score: scoreArticleRelevance(d.title || '') }))
    .sort((a, b) => b.score - a.score)
  const top3 = scored.slice(0, 3)
  const relatedArticleIds = top3.map((a) => a.id)

  console.log('\nRelevant existing articles for relatedArticles:')
  for (const a of scored) {
    const selected = top3.includes(a)
    console.log(`  ${selected ? '→' : ' '} ID ${a.id} (score ${a.score}): "${a.title}"`)
  }
  console.log(`\nLinking ${relatedArticleIds.length} related article(s): ${relatedArticleIds.join(', ')}`)

  // ── 8. Generate dates ──────────────────────────────────────────────
  const now = new Date().toISOString()
  const publishDate = now
  const updatedDate = now
  console.log(`\nDates: publishDate=${publishDate}, updatedDate=${updatedDate}`)

  // ── 9. Build layout blocks ──────────────────────────────────────────
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
        layout.push({ blockType: 'toolEmbed', tool: primaryToolId, label: 'Try the Lean Body Mass Calculator' })
        break
      case 'table':
        layout.push({ blockType: 'table', caption: '', headers: (b as any).headers, rows: (b as any).rows!.map((cells: string[]) => ({ cells })) })
        break
      case 'list':
        layout.push({ blockType: 'list', style: (b.ordered ? 'ordered' : 'unordered') as any, items: b.items!.map((text: string) => ({ text })) })
        break
      case 'disclaimer':
        layout.push({ blockType: 'callout', tone: 'warning', title: 'Medical disclaimer', text: b.text })
        break
    }
  }

  // ── 10. Build SEO object ────────────────────────────────────────────
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

  // ── 11. Build & create article ──────────────────────────────────────
  const articleData = {
    title: ARTICLE_JSON.title,
    excerpt: ARTICLE_JSON.excerpt,
    snippetAnswer: ARTICLE_JSON.snippetAnswer,
    slug,
    category: catId,
    author: authorId,
    reviewer: reviewerId,
    tags: tagIds,
    primaryTool: primaryToolId,
    relatedTools: relatedToolIds,
    relatedArticles: relatedArticleIds,
    publishDate,
    updatedDate,
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
  console.log('   Related articles:', relatedArticleIds.join(', '))
  console.log('   Tags:', tagIds.join(', '))
  console.log('   Reviewer:', reviewerId)
  console.log('   publishDate:', publishDate)
  console.log('   updatedDate:', updatedDate)

  await payload.destroy()
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
