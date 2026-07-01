import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized, schema pushed.')

  // ── 1. Upsert category ──────────────────────────────────────────────
  let cat = await payload.find({ collection: 'categories', where: { slug: { equals: 'nutrition' } }, limit: 1 })
  let catId: number
  if (cat.docs.length) {
    catId = cat.docs[0].id as number
    console.log('Category found:', catId)
  } else {
    const created = await payload.create({ collection: 'categories', data: { name: 'Nutrition', slug: 'nutrition', kind: 'tool' } })
    catId = created.id
    console.log('Category created:', catId)
  }

  // ── 2. Upsert author ────────────────────────────────────────────────
  let auth = await payload.find({ collection: 'authors', where: { slug: { equals: 'editorial-team' } }, limit: 1 })
  let authorId: number
  if (auth.docs.length) {
    authorId = auth.docs[0].id as number
    console.log('Author found:', authorId)
  } else {
    const created = await payload.create({ collection: 'authors', data: { name: 'Editorial Team', slug: 'editorial-team', schemaType: 'Organization' } })
    authorId = created.id
    console.log('Author created:', authorId)
  }

  // ── 3. Upsert tools ────────────────────────────────────────────────
  const toolSlugs = ['water-intake-calculator', 'caffeine-intake-calculator', 'calorie-calculator']
  const toolNames: Record<string, string> = {
    'water-intake-calculator': 'Water Intake Calculator',
    'caffeine-intake-calculator': 'Caffeine Intake Calculator',
    'calorie-calculator': 'Calorie Calculator',
  }
  const toolIds: Record<string, number> = {}
  for (const slug of toolSlugs) {
    const existing = await payload.find({ collection: 'tools', where: { slug: { equals: slug } }, limit: 1 })
    if (existing.docs.length) {
      toolIds[slug] = existing.docs[0].id as number
      console.log('Tool found:', slug, toolIds[slug])
    } else {
      const created = await payload.create({
        collection: 'tools',
        data: {
          name: toolNames[slug],
          slug,
          category: catId,
          toolType: 'coded',
          codedComponent: 'GenericCalculator',
          enabled: true,
          featured: false,
        } as any,
      })
      toolIds[slug] = created.id
      console.log('Tool created:', slug, toolIds[slug])
    }
  }

  // ── 4. Build layout blocks ──────────────────────────────────────────
  const layout = [
    { blockType: 'text', style: 'p', text: `You've probably heard \"drink eight glasses a day.\" It's a decent nudge to sip more, but it isn't where the evidence actually points. Most healthy adults need roughly 2.7 litres (women) to 3.7 litres (men) of total water daily — and about a fifth of that arrives in your food. Your real target moves with your body size, how hard you sweat, and the weather. Here's how to find yours.` },
    { blockType: 'toolEmbed', tool: toolIds['water-intake-calculator'] },
    { blockType: 'text', style: 'h2', text: 'How much water do you actually need?' },
    { blockType: 'text', style: 'p', text: 'The most-cited benchmark comes from the U.S. National Academies of Sciences, Engineering, and Medicine: an Adequate Intake of about 3.7 litres (125 oz) of total water a day for men and 2.7 litres (91 oz) for women. "Total water" is the key phrase — it counts everything you drink plus the water in food, which supplies roughly 20%. Take out food and you land near 13 cups of fluid a day for men and 9 for women. Pregnancy nudges the target to about 3 litres, and breastfeeding to around 3.8.' },
    {
      blockType: 'table',
      caption: 'Daily water intake recommendations by group',
      headers: ['Group', 'Total water/day (food + drinks)', 'From drinks (approx.)'],
      rows: [
        { cells: ['Adult women', '~2.7 L (91 oz)', '~9 cups'] },
        { cells: ['Adult men', '~3.7 L (125 oz)', '~13 cups'] },
        { cells: ['Pregnant', '~3.0 L (101 oz)', '~10 cups'] },
        { cells: ['Breastfeeding', '~3.8 L (128 oz)', '~13 cups'] },
      ],
    },
    { blockType: 'text', style: 'h2', text: "Is the '8 glasses a day' rule actually real?" },
    { blockType: 'text', style: 'p', text: `Not really — and that's the part most guides skip. There's no strong evidence behind the exact 8×8 figure (eight 8-oz glasses). It's a memorable rule of thumb, not a clinical guideline. Health authorities give ranges rather than a single number precisely because a 60-kg office worker in a mild climate and a 90-kg runner in July have very different needs. Use 8 glasses as a floor to aim past if it helps you remember — just don't treat it as a finish line.` },
    { blockType: 'text', style: 'h2', text: 'What changes how much water you need?' },
    {
      blockType: 'list',
      style: 'unordered',
      items: [
        { text: 'Heat and humidity — you lose more through sweat, sometimes a litre or more per hour of hard effort.' },
        { text: 'Exercise — drink before, during, and after; long or intense sessions may also need electrolytes.' },
        { text: 'Pregnancy and breastfeeding — needs rise to support blood volume and milk production.' },
        { text: 'Illness with fever, vomiting, or diarrhoea — replace the extra fluids you\'re losing.' },
        { text: 'Altitude above about 2,500 m — faster breathing and more urination increase losses.' },
        { text: 'Body size and a high-protein or high-fibre diet — larger bodies and those diets ask for a bit more.' },
      ],
    },
    { blockType: 'text', style: 'h2', text: 'Do coffee, tea, and food count?' },
    { blockType: 'text', style: 'p', text: 'Yes to all three. Coffee and tea are mildly diuretic, but at normal intakes the fluid they contains still leaves you net-hydrated, so your morning cup counts — you can sanity-check your caffeine with the caffeine intake calculator. Milk, juice, and most foods count too: soups, yoghurt, and produce like cucumber and watermelon are more than 80% water. Only heavy alcohol works against you. If you\'re also watching intake, pairing hydration with a realistic target from the calorie calculator keeps both honest.' },
    { blockType: 'text', style: 'h2', text: "How do you know if you're drinking enough?" },
    { blockType: 'text', style: 'p', text: 'Skip the math and read your body. Pale, straw-coloured urine and rarely feeling thirsty are the two most practical green lights. Dark yellow urine, a dry mouth, headache, or afternoon fatigue often mean you\'re behind. For most healthy people with easy access to water, thirst is a reliable guide. The main exception is older adults, whose thirst signal dulls with age — they do better drinking on a light schedule rather than waiting to feel it.' },
    { blockType: 'text', style: 'h2', text: 'Can you drink too much water?' },
    { blockType: 'text', style: 'p', text: 'Rarely, but yes. Drinking far more than your kidneys can excrete dilutes blood sodium and causes hyponatremia — seen most often in endurance athletes who down litres of plain water during long races. Symptoms include nausea, headache, confusion, and, in severe cases, seizures. The lesson isn\'t to fear water; it\'s to drink to thirst and need rather than forcing a fixed number of litres, and to add electrolytes during very long, sweaty efforts.' },
    { blockType: 'callout', tone: 'warning', title: 'Medical disclaimer', text: 'This article is for general education, not medical advice. Fluid needs vary, and some conditions — kidney, heart, or liver disease — require specific limits. Ask a qualified clinician about the right amount for you.' },
  ]

  // ── 5. Build article data ──────────────────────────────────────────
  const articleData = {
    title: 'How Much Water Should You Drink a Day?',
    excerpt: `Forget the 8-glasses rule. How much water you really need depends on your size, activity, and climate — here's how to find a target that fits your body.`,
    slug: 'how-much-water-should-you-drink-a-day',
    category: catId,
    author: authorId,
    primaryTool: toolIds['water-intake-calculator'],
    relatedTools: [toolIds['water-intake-calculator'], toolIds['caffeine-intake-calculator'], toolIds['calorie-calculator']],
    layout,
    faq: [
      { question: 'How much water should I drink a day?', answer: `For most healthy adults, aim for the National Academies' Adequate Intake: about 2.7 litres (roughly 9 cups of fluid) a day for women and 3.7 litres (about 13 cups) for men, including the water in food. Needs rise with heat, exercise, pregnancy, and body size.` },
      { question: 'Is the 8 glasses a day rule true?', answer: `It's a memory aid, not science. There's no strong evidence for the exact eight-glasses figure. Health authorities give ranges based on body size, activity, and climate, so treat 8 glasses as a rough floor rather than a precise target.` },
      { question: 'Do coffee and tea count toward my water intake?', answer: 'Yes. Despite a mild diuretic effect, caffeinated drinks are net-hydrating at normal amounts, so coffee and tea count. Milk, juice, and water-rich foods count too — only heavy alcohol works against hydration.' },
      { question: 'How much extra water do I need when exercising?', answer: 'Drink before, during, and after activity. You can lose a litre or more of sweat per hour in hard or hot sessions, so replace it gradually. For efforts longer than about an hour, add electrolytes rather than relying on plain water alone.' },
      { question: "What are the signs I'm not drinking enough?", answer: 'Dark yellow urine, dry mouth, headache, and fatigue are common early signs. Pale, straw-coloured urine and rarely feeling thirsty usually mean you\'re well hydrated.' },
      { question: 'Can drinking too much water be harmful?', answer: 'Occasionally. Drinking far more than your kidneys can clear can dilute blood sodium (hyponatremia), mainly in endurance athletes. Drink to thirst and need instead of forcing a fixed number of litres.' },
    ],
    sources: [
      { label: 'U.S. National Academies of Sciences, Engineering, and Medicine — Dietary Reference Intakes for Water, Potassium, Sodium, Chloride, and Sulfate (2004)', url: 'https://www.nationalacademies.org/news/2004/02/report-sets-dietary-intake-levels-for-water-salt-and-potassium-to-maintain-health-and-reduce-chronic-disease-risk' },
      { label: 'CDC — Water and Healthier Drinks', url: 'https://www.cdc.gov/healthyweight/healthy_eating/water-and-healthier-drinks.html' },
      { label: 'NHS — Water, drinks and your health', url: 'https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/' },
    ],
    semanticEntities: [
      { term: 'Dehydration', url: 'https://medlineplus.gov/dehydration.html' },
      { term: 'Fluid and Electrolyte Balance', url: 'https://medlineplus.gov/fluidandelectrolytebalance.html' },
      { term: 'Hyponatremia', url: 'https://medlineplus.gov/ency/article/000394.htm' },
      { term: 'Antidiuretic hormone', url: 'https://medlineplus.gov/lab-tests/antidiuretic-hormone-adh-test/' },
      { term: 'Sodium', url: 'https://medlineplus.gov/sodium.html' },
    ],
    seo: {
      metaTitle: 'How Much Water Should You Drink a Day?',
      metaDescription: 'The 8-glasses rule is a myth. See how much water you really need each day based on your body, activity, and climate — plus a free intake calculator.',
      canonical: '',
      keywords: ['how much water should i drink a day', 'daily water intake', 'how much water per day', 'water intake calculator', 'hydration guide'],
      ogTitle: '',
      ogDescription: '',
      twitterTitle: '',
      twitterDescription: '',
    },
    aiGenerated: true,
    reviewedByHuman: false,
    _status: 'draft',
  } as any

  // ── 6. Create article ──────────────────────────────────────────────
  const article = await payload.create({
    collection: 'articles',
    data: articleData,
  })

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
