import { getPayload } from 'payload'
import configPromise from '@payload-config'

/* ── Helper: assert char count ──────────────────────────────────────── */
function assertLen(value: string, max: number, field: string, articleId: number): void {
  const len = value.length
  if (len > max) {
    console.error(`  !! Article ${articleId} ${field}: ${len} chars EXCEEDS max ${max}!`)
  }
}

/* ── Batch 1 data (Articles 1-10) ───────────────────────────────────── */

interface ArticleUpdate {
  id: number
  // SEO fields to update (only the ones being changed)
  seo?: {
    metaTitle?: string
    metaDescription?: string
    keywords?: string[]
    ogTitle?: string
    ogDescription?: string
    twitterTitle?: string
    twitterDescription?: string
  }
  // Full semanticEntities array (replaces existing)
  semanticEntities?: { term: string; url: string }[]
}

const UPDATES: ArticleUpdate[] = [
  // ── Article 1: How Many Calories Should I Eat to Lose Weight? ──────
  {
    id: 1,
    seo: {
      keywords: ['calorie calculator', 'how many calories to lose weight', 'calorie deficit', 'tdee calculator', 'weight loss calories'],
      ogTitle: 'How Many Calories to Lose Weight? Free Calculator',
      ogDescription: 'Find your exact calorie target for safe weight loss using your TDEE and a moderate deficit. Learn why crash diets backfire and how to keep it off.',
      twitterTitle: 'How Many Calories Should I Eat to Lose Weight?',
      twitterDescription: 'Calculate your exact calorie target for weight loss using TDEE and a safe deficit, plus why crash diets backfire and how to keep weight off long-term.',
    },
    semanticEntities: [
      { term: 'Calorie', url: 'https://medlineplus.gov/ency/article/002165.htm' },
      { term: 'Weight loss', url: 'https://medlineplus.gov/weightcontrol.html' },
      { term: 'Basal metabolic rate', url: 'https://medlineplus.gov/ency/article/002257.htm' },
      { term: 'Macronutrients', url: 'https://medlineplus.gov/ency/article/002404.htm' },
      { term: 'Energy balance (biology)', url: 'https://en.wikipedia.org/wiki/Energy_balance_(biology)' },
    ],
  },

  // ── Article 2: How Much Protein Do I Really Need? ──────────────────
  {
    id: 2,
    seo: {
      metaDescription: 'How much protein do you need per day for muscle, weight loss, or general health? Daily targets in grams per kg and pound, with what the research says.',
      keywords: ['protein calculator', 'how much protein per day', 'protein intake', 'daily protein needs', 'protein for muscle'],
      ogTitle: 'How Much Protein Do You Need? Daily Guide',
      ogDescription: 'Daily protein targets for muscle, weight loss, and general health — in grams per kg and pound. See what the research says and find your number.',
      twitterTitle: 'How Much Protein Do I Really Need Each Day?',
      twitterDescription: 'Daily protein targets for muscle, weight loss, and health — in grams per kg and pound. See what the research says and find your exact number.',
    },
    // Entities: keep existing (2 .gov, 3 Wikipedia with no .gov alt)
  },

  // ── Article 3: What's a Healthy BMI by Age? ────────────────────────
  {
    id: 3,
    seo: {
      metaDescription: 'What counts as a healthy BMI, how it changes with age, and the limits of BMI for athletes and older adults — with a free BMI calculator and guide.',
      keywords: ['bmi calculator', 'healthy bmi by age', 'bmi chart', 'bmi for adults', 'body mass index meaning'],
      ogTitle: 'Healthy BMI by Age: What the Numbers Mean',
      ogDescription: 'What is a healthy BMI, how does it change with age, and what are the limits for athletes and older adults? Free BMI calculator and plain-English guide.',
      twitterTitle: "What's a Healthy BMI by Age? Free Calculator",
      twitterDescription: 'What counts as a healthy BMI, how it changes with age, and the limits for athletes and older adults. Free BMI calculator and plain-English guide.',
    },
    semanticEntities: [
      { term: 'Body mass index', url: 'https://medlineplus.gov/ency/article/007184.htm' },
      { term: 'Body composition', url: 'https://en.wikipedia.org/wiki/Body_composition' },
      { term: 'Obesity', url: 'https://medlineplus.gov/obesity.html' },
      { term: 'Adipose tissue', url: 'https://en.wikipedia.org/wiki/Adipose_tissue' },
      { term: 'Lean body mass', url: 'https://en.wikipedia.org/wiki/Lean_body_mass' },
    ],
  },

  // ── Article 4: Best Time to Stop Drinking Coffee ───────────────────
  {
    id: 4,
    seo: {
      keywords: ['caffeine curfew', 'coffee and sleep', 'when to stop caffeine', 'caffeine half life', 'coffee before bed'],
      ogTitle: 'When to Stop Drinking Coffee for Better Sleep',
      ogDescription: 'Caffeine has a 5-hour half-life and can disrupt sleep even 6 hours before bed. Find your exact last-coffee cutoff with our free caffeine curfew tool.',
      twitterTitle: 'When Should You Stop Drinking Coffee for Sleep?',
      twitterDescription: 'Caffeine has a 5-hour half-life and disrupts sleep even 6 hours before bed. Find your exact last-coffee cutoff with our free caffeine curfew tool.',
    },
    semanticEntities: [
      { term: 'Caffeine', url: 'https://medlineplus.gov/caffeine.html' },
      { term: 'Circadian rhythm', url: 'https://medlineplus.gov/ency/article/000817.htm' },
      { term: 'Adenosine receptor', url: 'https://en.wikipedia.org/wiki/Adenosine_receptor' },
      { term: 'Biological half-life', url: 'https://en.wikipedia.org/wiki/Biological_half-life' },
      { term: 'Sleep', url: 'https://medlineplus.gov/healthysleep.html' },
    ],
  },

  // ── Article 5: How to Keep Muscle While Losing Weight ──────────────
  {
    id: 5,
    seo: {
      keywords: ['muscle preservation', 'lose fat not muscle', 'calorie deficit muscle', 'protein weight loss', 'resistance training for fat loss'],
      ogTitle: 'How to Keep Muscle While Losing Weight',
      ogDescription: 'Lose fat without losing muscle: the three levers that matter most — a moderate deficit, high protein, and resistance training — explained simply, with a tool.',
    },
    // twitterTitle and twitterDescription already set — KEEP
    semanticEntities: [
      { term: 'Muscle hypertrophy', url: 'https://en.wikipedia.org/wiki/Muscle_hypertrophy' },
      { term: 'Caloric deficit', url: 'https://en.wikipedia.org/wiki/Caloric_deficit' },
      { term: 'Protein (nutrient)', url: 'https://medlineplus.gov/dietaryproteins.html' },
      { term: 'Resistance training', url: 'https://en.wikipedia.org/wiki/Strength_training' },
      { term: 'Body composition', url: 'https://en.wikipedia.org/wiki/Body_composition' },
    ],
  },

  // ── Article 6: Due Date by Conception Date ──────────────────────────
  {
    id: 6,
    seo: {
      metaDescription: 'How due dates are calculated from conception, last period (Naegele\u2019s rule), or IVF transfer — and why your ultrasound date may differ. Free calculator.',
      keywords: ['due date calculator', 'due date by conception', 'naegele rule', 'pregnancy due date', 'calculate due date'],
      ogTitle: 'Due Date by Conception Date: How It Works',
      ogDescription: 'How due dates are calculated from conception, last period, or IVF transfer — and why your ultrasound date may differ. Free due date calculator included.',
      twitterTitle: 'Due Date by Conception Date — Free Calculator',
      twitterDescription: 'How due dates are calculated from conception, last period, or IVF transfer. Free due date calculator included. Understand Naegele\u2019s rule and ultrasound dates.',
    },
    semanticEntities: [
      { term: 'Pregnancy', url: 'https://medlineplus.gov/pregnancy.html' },
      { term: 'Gestational age', url: 'https://en.wikipedia.org/wiki/Gestational_age' },
      { term: "Naegele's rule", url: "https://en.wikipedia.org/wiki/Naegele%27s_rule" },
      { term: 'Ultrasound', url: 'https://medlineplus.gov/lab-tests/ultrasound/' },
      { term: 'Trimester', url: 'https://medlineplus.gov/ency/article/002216.htm' },
    ],
  },

  // ── Article 7: Intermittent Fasting for Beginners ──────────────────
  {
    id: 7,
    seo: {
      metaDescription: 'Intermittent fasting for beginners: compare 16:8, 18:6, OMAD and 5:2, learn what breaks a fast, and find a schedule you can actually keep. Free timer tool.',
      keywords: ['intermittent fasting', '16:8 fasting', 'intermittent fasting schedule', 'fasting for beginners', 'what breaks a fast'],
      ogTitle: 'Intermittent Fasting for Beginners: Pick a Schedule',
      ogDescription: 'Compare 16:8, 18:6, OMAD, and 5:2 fasting schedules. Learn what breaks a fast, how to start, and find a schedule you can actually keep. Free timer included.',
      twitterTitle: 'Intermittent Fasting for Beginners — Free Timer',
      twitterDescription: 'Compare 16:8, 18:6, OMAD, and 5:2 fasting schedules. Learn what breaks a fast and find a schedule you can keep. Free fasting timer included.',
    },
    semanticEntities: [
      { term: 'Fasting', url: 'https://medlineplus.gov/ency/article/002454.htm' },
      { term: 'Intermittent fasting', url: 'https://en.wikipedia.org/wiki/Intermittent_fasting' },
      { term: 'Insulin', url: 'https://medlineplus.gov/ency/article/002380.htm' },
      { term: 'Ketosis', url: 'https://medlineplus.gov/ency/article/002407.htm' },
      { term: 'Autophagy', url: 'https://en.wikipedia.org/wiki/Autophagy' },
    ],
  },

  // ── Article 8: Sleep Chronotypes ───────────────────────────────────
  {
    id: 8,
    seo: {
      metaDescription: 'Lion, Bear, Wolf, or Dolphin? Learn the four sleep chronotypes, how to find yours, and how to schedule sleep and focus around your body clock. Free quiz.',
      keywords: ['sleep chronotype', 'chronotype quiz', 'lion bear wolf dolphin', 'sleep schedule', 'body clock types'],
      ogTitle: 'Sleep Chronotypes: Lion, Bear, Wolf or Dolphin?',
      ogDescription: 'Are you a Lion, Bear, Wolf, or Dolphin? Learn the four sleep chronotypes, find yours with our free quiz, and schedule your day around your body clock.',
      twitterTitle: "What's Your Sleep Chronotype? Free Quiz",
      twitterDescription: 'Lion, Bear, Wolf, or Dolphin? Take our free chronotype quiz and learn how to schedule sleep, focus, and exercise around your natural body clock.',
    },
    semanticEntities: [
      { term: 'Circadian rhythm', url: 'https://medlineplus.gov/ency/article/000817.htm' },
      { term: 'Chronotype', url: 'https://en.wikipedia.org/wiki/Chronotype' },
      { term: 'Sleep', url: 'https://medlineplus.gov/healthysleep.html' },
      { term: 'Melatonin', url: 'https://medlineplus.gov/druginfo/meds/a699017.html' },
      { term: 'Cortisol', url: 'https://medlineplus.gov/ency/article/003694.htm' },
    ],
  },

  // ── Article 9: How to Build a High-Protein Meal Plan ────────────────
  {
    id: 9,
    seo: {
      keywords: ['meal plan', 'high protein meal plan', 'meal plan generator', 'protein meal plan', 'how to build a meal plan'],
      ogTitle: 'How to Build a High-Protein Meal Plan (Free)',
      ogDescription: 'Build a meal plan that actually works: set calories, lock in protein, and keep it flexible. A simple 5-step framework, sample day, and free generator.',
      twitterTitle: 'Build a High-Protein Meal Plan — Free Generator',
      twitterDescription: 'Build a meal plan that works: set calories, lock in protein, keep it flexible. Simple 5-step framework, sample day, and a free meal plan generator.',
    },
    semanticEntities: [
      { term: 'Protein (nutrient)', url: 'https://medlineplus.gov/dietaryproteins.html' },
      { term: 'MyPlate', url: 'https://www.myplate.gov/' },
      { term: 'Satiety', url: 'https://en.wikipedia.org/wiki/Satiety' },
      { term: 'Macronutrients', url: 'https://medlineplus.gov/ency/article/002404.htm' },
      { term: 'Dietary Reference Intakes', url: 'https://www.nal.usda.gov/programs/fnic' },
    ],
  },

  // ── Article 10: How Long Does It Take to Lose Weight? ──────────────
  {
    id: 10,
    seo: {
      metaTitle: 'How Long Does It Take to Lose Weight? Realistic Timeline',
      metaDescription: 'A realistic weight-loss timeline by goal (10, 20, 50 lb), why the scale stalls, and how to keep it off at a safe, sustainable pace. Free timeline tool.',
      keywords: ['weight loss timeline', 'how long to lose weight', 'weight loss pace', 'safe weight loss rate', 'weight loss calculator'],
      ogTitle: 'How Long Does It Take to Lose Weight? Timeline',
      ogDescription: 'A realistic weight-loss timeline by goal (10, 20, 50 lb). Learn why the scale stalls, how to keep it off, and what a safe, sustainable pace looks like.',
      twitterTitle: 'How Long Does It Take to Lose Weight? Free Tool',
      twitterDescription: 'Realistic weight-loss timelines by goal (10, 20, 50 lb). Why the scale stalls, how to keep it off, and what a safe pace looks like. Free calculator.',
    },
    semanticEntities: [
      { term: 'Weight Loss', url: 'https://medlineplus.gov/weightcontrol.html' },
      { term: 'Basal Metabolic Rate', url: 'https://medlineplus.gov/ency/article/002257.htm' },
      { term: 'Adipose Tissue', url: 'https://en.wikipedia.org/wiki/Adipose_tissue' },
      { term: 'Body Mass Index', url: 'https://medlineplus.gov/ency/article/007184.htm' },
      { term: 'Calorie', url: 'https://medlineplus.gov/ency/article/002165.htm' },
    ],
  },
]

/* ── Execution ──────────────────────────────────────────────────────── */

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')
  console.log('=== STEP 3 Batch 1: Writing SEO backfill for Articles 1-10 ===\n')

  for (const update of UPDATES) {
    console.log(`--- Article ID ${update.id} ---`)

    // Build the update data — only include fields being changed
    const data: any = {}

    if (update.seo) {
      data.seo = {}
      const s = update.seo

      if (s.metaTitle !== undefined) {
        assertLen(s.metaTitle, 60, 'metaTitle', update.id)
        data.seo.metaTitle = s.metaTitle
      }
      if (s.metaDescription !== undefined) {
        assertLen(s.metaDescription, 155, 'metaDescription', update.id)
        data.seo.metaDescription = s.metaDescription
      }
      if (s.keywords !== undefined) {
        data.seo.keywords = s.keywords
      }
      if (s.ogTitle !== undefined) {
        assertLen(s.ogTitle, 60, 'ogTitle', update.id)
        data.seo.ogTitle = s.ogTitle
      }
      if (s.ogDescription !== undefined) {
        assertLen(s.ogDescription, 155, 'ogDescription', update.id)
        data.seo.ogDescription = s.ogDescription
      }
      if (s.twitterTitle !== undefined) {
        assertLen(s.twitterTitle, 60, 'twitterTitle', update.id)
        data.seo.twitterTitle = s.twitterTitle
      }
      if (s.twitterDescription !== undefined) {
        assertLen(s.twitterDescription, 155, 'twitterDescription', update.id)
        data.seo.twitterDescription = s.twitterDescription
      }
    }

    if (update.semanticEntities !== undefined) {
      data.semanticEntities = update.semanticEntities
    }

    try {
      await payload.update({ collection: 'articles', id: update.id, data })
      console.log(`  OK — updated ${Object.keys(data.seo || {}).length} SEO fields${update.semanticEntities ? ` + ${update.semanticEntities.length} entities` : ''}`)
    } catch (err) {
      console.error(`  ERROR: ${(err as Error).message.slice(0, 200)}`)
    }
  }

  // ── Verification ───────────────────────────────────────────────────
  console.log('\n=== Verification: Re-fetching articles to check char counts ===\n')

  for (const update of UPDATES) {
    const a = await payload.findByID({ collection: 'articles', id: update.id, depth: 0 }) as any
    const seo = a.seo || {}
    const entCount = a.semanticEntities?.length || 0
    const kwCount = seo.keywords?.length || 0

    const mt = (seo.metaTitle || '').length
    const md = (seo.metaDescription || '').length
    const ot = (seo.ogTitle || '').length
    const od = (seo.ogDescription || '').length
    const tt = (seo.twitterTitle || '').length
    const td = (seo.twitterDescription || '').length

    const mtOk = mt <= 60 ? 'OK' : 'OVER'
    const mdOk = md <= 155 ? 'OK' : 'OVER'
    const otOk = ot <= 60 ? 'OK' : 'OVER'
    const odOk = od <= 155 ? 'OK' : 'OVER'
    const ttOk = tt <= 60 ? 'OK' : 'OVER'
    const tdOk = td <= 155 ? 'OK' : 'OVER'

    console.log(`ID ${update.id}: metaT=${mt}/${mtOk} metaD=${md}/${mdOk} ogT=${ot}/${otOk} ogD=${od}/${odOk} twT=${tt}/${ttOk} twD=${td}/${tdOk} kw=${kwCount} ent=${entCount}`)
  }

  await payload.destroy()
  console.log('\nBatch 1 complete.')
}

main().catch((err) => { console.error('Script failed:', err); process.exit(1) })
