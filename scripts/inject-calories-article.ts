import { getPayload } from 'payload'
import configPromise from '@payload-config'

const ARTICLE_JSON = {
  tool: 'calories-burned-calculator',
  title: 'How Are Calories Burned Calculated? A Guide to Energy Expenditure',
  excerpt: 'Discover how your body burns energy throughout the day, the role of MET values in exercise, and how to accurately track your daily calorie burn.',
  snippetAnswer: 'Your total daily energy expenditure (TDEE) is calculated by adding your Basal Metabolic Rate (BMR), the energy used to digest food, and physical activity. For specific exercises, experts use Metabolic Equivalent of Task (MET) values, which estimate the calories you burn based on your body weight and the duration of the activity.',
  category: 'fitness-and-metabolism',
  author: 'editorial-team',
  primaryTool: 'calories-burned-calculator',
  relatedTools: ['metabolic-age-calculator', 'steps-to-calories-calculator', 'walk-it-off-calculator'],
  layoutBlocks: [
    { type: 'paragraph', text: 'Whether you are aiming to lose weight, maintain your current physique, or fuel athletic performance, understanding how your body burns calories is the foundation of metabolic health. Most people assume the calories they burn come entirely from sweating it out in the gym. That is the part most guides skip: your workout only accounts for 5% to 10% of your daily energy expenditure. The vast majority of your calorie burn happens automatically.' },
    { type: 'toolEmbed', toolSlug: 'calories-burned-calculator' },
    { type: 'heading', level: 2, text: 'The Components of Total Daily Energy Expenditure (TDEE)' },
    { type: 'paragraph', text: 'To accurately calculate calories burned, you must look at your Total Daily Energy Expenditure (TDEE). This is the sum of all the calories your body uses in a 24-hour period, broken down into three main pillars:' },
    { type: 'list', ordered: false, items: ['Basal Metabolic Rate (BMR): The energy required to keep you alive (breathing, circulating blood, cell function). This makes up 60-70% of your total daily burn.', 'Thermic Effect of Food (TEF): The energy your body uses to digest and process the food you eat. Protein takes the most energy to digest, accounting for about 10% of your daily burn.', 'Activity Energy Expenditure (AEE): This includes both intentional exercise (EAT) and Non-Exercise Activity Thermogenesis (NEAT)—the calories burned walking, fidgeting, and doing chores.'] },
    { type: 'heading', level: 2, text: 'How Do MET Values Estimate Calories Burned During Exercise?' },
    { type: 'paragraph', text: 'When you use a calculator or fitness watch to track a specific workout, it relies on MET values (Metabolic Equivalent of Task). One MET is defined as the energy you use when you are resting quietly. An activity with a MET value of 5 means you are burning five times as many calories as you would at rest.' },
    { type: 'table', headers: ['Activity Type', 'Average MET Value', 'Intensity Level'], rows: [['Sitting quietly', '1.0', 'Resting'], ['Brisk walking (3 mph)', '3.5 - 4.0', 'Moderate'], ['Running (6 mph)', '9.8', 'Vigorous'], ['Heavy weight lifting', '6.0', 'Vigorous']] },
    { type: 'heading', level: 2, text: 'Why Your Fitness Tracker Might Be Inaccurate' },
    { type: 'paragraph', text: 'While wrist-worn fitness trackers are excellent motivational tools, they frequently overestimate calories burned by up to 20-30%. This happens because algorithms cannot perfectly account for your unique muscle mass, metabolic efficiency, or form during exercise. For the most accurate estimations, rely on your heart rate zones combined with standardized MET calculations, rather than just the generic calorie readout on a cardio machine.' },
    { type: 'disclaimer', text: 'This article and calculator are for educational purposes only and do not constitute medical advice. Consult a healthcare provider or a registered dietitian for personalized guidance regarding your diet and exercise regimen.' },
  ],
  faq: [
    { question: 'Do I burn calories while I sleep?', answer: 'Yes. Your body continues to perform essential functions like breathing, repairing cells, and pumping blood while you sleep. Most people burn between 40 to 80 calories per hour of sleep, depending on their BMR.' },
    { question: 'Does sweating mean I am burning more calories?', answer: 'Not directly. Sweating is your body\'s cooling mechanism, not an indicator of energy expenditure. You may sweat heavily in a sauna while burning very few calories, but burn a high amount of calories swimming in cool water without noticing any sweat.' },
    { question: 'How can I increase the amount of calories I burn daily?', answer: 'The most sustainable way is to increase your Non-Exercise Activity Thermogenesis (NEAT) by taking more steps throughout the day, and building lean muscle mass through resistance training, which permanently raises your Basal Metabolic Rate.' },
  ],
  sources: [
    { label: 'Centers for Disease Control and Prevention (CDC) — Physical Activity', url: 'https://www.cdc.gov/physicalactivity/basics/index.htm' },
    { label: 'MedlinePlus — Exercise and Physical Fitness (2022)', url: 'https://medlineplus.gov/exerciseandphysicalfitness.html' },
  ],
  semanticEntities: [
    { term: 'Basal metabolic rate', url: 'https://medlineplus.gov/ency/article/002257.htm' },
    { term: 'Thermic effect of food', url: 'https://pubmed.ncbi.nlm.nih.gov/8944667/' },
    { term: 'Metabolic equivalent of task', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4241367/' },
  ],
  seo: {
    metaTitle: 'Calories Burned Calculator & Guide to Energy Expenditure',
    metaDescription: 'Calculate the calories you burn daily and during exercise. Learn about TDEE, BMR, and MET values to accurately track your energy expenditure.',
    slug: 'calories-burned-calculator-guide',
    canonical: '',
    keywords: ['calories burned calculator', 'how to calculate calories burned', 'MET values exercise', 'TDEE calculation', 'track energy expenditure'],
  },
  ogTitle: 'Calories Burned Calculator: Track Your Energy Expenditure',
  ogDescription: 'Learn how your body burns energy and use our calculator to estimate the calories burned during your workouts.',
  twitterTitle: 'Calories Burned Calculator: Track Your Energy Expenditure',
  twitterDescription: 'Learn how your body burns energy and use our calculator to estimate workout calories.',
  aiGenerated: true,
  reviewedByHuman: false,
}

function scoreRelevance(title: string): number {
  const lower = title.toLowerCase()
  let score = 0
  const weightLossTerms = ['weight loss', 'lose weight', 'losing weight', 'weight']
  const calorieTerms = ['calorie', 'calories', 'caloric']
  const muscleTerms = ['muscle', 'protein', 'macro', 'meal']
  const metabolismTerms = ['metabol', 'fat', 'energy', 'tdde', 'bmr', 'diet', 'nutrition']
  for (const t of weightLossTerms) { if (lower.includes(t)) score += 3 }
  for (const t of calorieTerms) { if (lower.includes(t)) score += 5 }
  for (const t of muscleTerms) { if (lower.includes(t)) score += 2 }
  for (const t of metabolismTerms) { if (lower.includes(t)) score += 1 }
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

  // ── 3. Ensure primary tool ──────────────────────────────────────────
  const primaryToolId = await ensureTool(payload, ARTICLE_JSON.primaryTool, catId)

  // ── 4. Ensure related tools ─────────────────────────────────────────
  const relatedToolIds: number[] = []
  for (const slug of ARTICLE_JSON.relatedTools) {
    const id = await ensureTool(payload, slug, catId)
    relatedToolIds.push(id)
  }

  // ── 5. Fetch existing articles & select top 3 related by relevance ──
  const existing = await payload.find({ collection: 'articles', limit: 50, depth: 0 })
  const scored = existing.docs
    .map((d: any) => ({ id: d.id as number, title: d.title || '', score: scoreRelevance(d.title || '') }))
    .sort((a, b) => b.score - a.score)
  const top3 = scored.slice(0, 3)
  const relatedArticleIds = top3.map((a) => a.id)

  console.log('\nRelevant existing articles for relatedArticles:')
  for (const a of scored) {
    const selected = top3.includes(a)
    console.log(`  ${selected ? '→' : ' '} ID ${a.id} (score ${a.score}): "${a.title}"`)
  }

  if (relatedArticleIds.length === 0) {
    console.log('No existing articles found — skipping relatedArticles linkage.')
  } else {
    console.log(`\nLinking ${relatedArticleIds.length} related article(s): ${relatedArticleIds.join(', ')}`)
  }

  // ── 6. Build layout blocks ──────────────────────────────────────────
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
        layout.push({ blockType: 'toolEmbed', tool: primaryToolId, label: 'Try the Calories Burned Calculator' })
        break
      case 'table':
        layout.push({ blockType: 'table', caption: '', headers: b.headers, rows: b.rows!.map((cells: string[]) => ({ cells })) })
        break
      case 'list':
        layout.push({ blockType: 'list', style: (b.ordered ? 'ordered' : 'unordered') as any, items: b.items!.map((text: string) => ({ text })) })
        break
      case 'disclaimer':
        layout.push({ blockType: 'callout', tone: 'warning', title: 'Medical disclaimer', text: b.text })
        break
    }
  }

  // ── 7. Build SEO object ─────────────────────────────────────────────
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

  // ── 8. Build & create article ───────────────────────────────────────
  const articleData = {
    title: ARTICLE_JSON.title,
    excerpt: ARTICLE_JSON.excerpt,
    snippetAnswer: ARTICLE_JSON.snippetAnswer,
    slug,
    category: catId,
    author: authorId,
    primaryTool: primaryToolId,
    relatedTools: relatedToolIds,
    relatedArticles: relatedArticleIds,
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
  console.log('   Related articles linked:', relatedArticleIds.length > 0 ? relatedArticleIds.join(', ') : '(none)')

  await payload.destroy()
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
