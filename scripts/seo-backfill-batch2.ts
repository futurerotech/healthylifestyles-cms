import { getPayload } from 'payload'
import configPromise from '@payload-config'

/* ── Helper: assert char count ──────────────────────────────────────── */
function assertLen(value: string, max: number, field: string, articleId: number): void {
  const len = value.length
  if (len > max) {
    console.error(`  !! Article ${articleId} ${field}: ${len} chars EXCEEDS max ${max}!`)
  }
}

/* ── Batch 2 updates ────────────────────────────────────────────────── */

const UPDATES: {
  id: number
  seo?: Record<string, any>
  semanticEntities?: { term: string; url: string }[]
}[] = [
  // ── Article 11: Fix ogDescription (over limit), add keywords, twitter fields ─
  {
    id: 11,
    seo: {
      keywords: ['macro calculator', 'how to calculate macros', 'macro ratio', 'protein carbs fat', 'macro tracking'],
      ogDescription: 'Learn how to calculate your macros for weight loss, muscle gain, or maintenance. Get exact protein, carbs, and fat targets with our free macro calculator.',
      twitterTitle: 'Calculate Your Macros — Free Calculator',
      twitterDescription: 'Set protein by body weight, add fat, fill with carbs. Get exact macro targets for fat loss, maintenance, or muscle gain with our free calculator.',
    },
  },

  // ── Article 13: Clear canonical placeholder, fill og + twitter fields ──────
  {
    id: 13,
    seo: {
      canonical: '',
      ogTitle: 'How Much Water Should You Drink a Day?',
      ogDescription: 'The 8-glasses rule is a myth. Find out how much water you really need based on your body, activity, and climate. Free intake calculator included.',
      twitterTitle: 'How Much Water Should You Drink? Free Calculator',
      twitterDescription: 'See how much water you really need each day based on body, activity, and climate. Plus a free water intake calculator. The 8-glasses rule is a myth.',
    },
  },

  // ── Article 15: Fix over-limit metaDescription, ogTitle, twitterTitle; extend ogD, twD ─
  {
    id: 15,
    seo: {
      metaDescription: 'Use our Metabolic Age Calculator to compare your BMR to your actual age. Learn science-backed ways to build muscle and lower your metabolic age.',
      ogTitle: 'Metabolic Age Calculator: What It Says About Health',
      ogDescription: 'Compare your metabolic age to your actual age, learn what moves it, and get science-backed steps to build muscle and lower your BMR with our free tool.',
      twitterTitle: 'Metabolic Age Calculator: Check Yours Free',
      twitterDescription: 'Discover how your metabolic age compares to your chronological age, what lowers it, and practical steps to improve your basal metabolic rate today.',
    },
  },

  // ── Article 16: Extend metaDescription, ogDescription, twitterDescription; add 2 entities ─
  {
    id: 16,
    seo: {
      metaDescription: 'Calculate the calories you burn daily and during exercise. Learn about TDEE, BMR, and MET values to track your energy expenditure. Free tool.',
      ogDescription: 'Learn how your body burns energy through BMR, TDEE, and MET values. Use our free calculator to estimate calories burned during any workout.',
      twitterDescription: 'How many calories did that workout really burn? Learn the science of TDEE, BMR, and MET values — and get your exact number with our free calculator.',
    },
    semanticEntities: [
      { term: 'Basal metabolic rate', url: 'https://medlineplus.gov/ency/article/002257.htm' },
      { term: 'Thermic effect of food', url: 'https://pubmed.ncbi.nlm.nih.gov/8944667/' },
      { term: 'Metabolic equivalent of task', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4241367/' },
      { term: 'Total Daily Energy Expenditure', url: 'https://www.ncbi.nlm.nih.gov/books/NBK278991/' },
      { term: 'Physical activity', url: 'https://medlineplus.gov/ency/article/001941.htm' },
    ],
  },

  // ── Article 17: Extend ogDescription, twitterDescription; add 2 entities ────
  {
    id: 17,
    seo: {
      ogDescription: 'Find out your Lean Body Mass and learn why building muscle is the key to a healthy metabolism. Free calculator and plain-English guide included.',
      twitterDescription: 'Calculate your Lean Body Mass and see why muscle matters more than the number on the scale. Free LBM calculator with a clear, plain-English guide.',
    },
    semanticEntities: [
      { term: 'Lean body mass', url: 'https://www.ncbi.nlm.nih.gov/mesh/68001823' },
      { term: 'Body composition', url: 'https://medlineplus.gov/bodyweight.html' },
      { term: 'Skeletal muscle', url: 'https://medlineplus.gov/ency/imagepages/19841.htm' },
      { term: 'Metabolism', url: 'https://medlineplus.gov/metabolism.html' },
      { term: 'Body fat percentage', url: 'https://medlineplus.gov/ency/article/007186.htm' },
    ],
  },

  // ── Article 21: Add URLs to 3 entities that have NO URL ─────────────
  {
    id: 21,
    semanticEntities: [
      { term: 'Chronic inflammation', url: 'https://www.nia.nih.gov/health/featured/chronic-inflammation' },
      { term: 'Unsaturated fats', url: 'https://medlineplus.gov/dietaryfats.html' },
      { term: 'Dietary fiber', url: 'https://medlineplus.gov/dietaryfiber.html' },
      { term: 'Ultra-processed food', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=ultra-processed+food+health' },
      { term: 'Mediterranean diet', url: 'https://medlineplus.gov/ency/patientinstructions/000783.htm' },
    ],
  },

  // ── Article 22: Add URLs to 2 entities that have NO URL ─────────────
  {
    id: 22,
    semanticEntities: [
      { term: 'Gut microbiome', url: 'https://www.niaid.nih.gov/diseases-conditions/microbiome' },
      { term: 'Probiotics', url: 'https://medlineplus.gov/ency/article/007165.htm' },
      { term: 'Dietary fiber', url: 'https://medlineplus.gov/dietaryfiber.html' },
      { term: 'Irritable bowel syndrome', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/irritable-bowel-syndrome' },
      { term: 'Fermented foods', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=fermented+foods+gut+microbiome' },
    ],
  },

  // ── Article 23: Add URL to 1 entity that has NO URL ─────────────────
  {
    id: 23,
    semanticEntities: [
      { term: 'Food allergy', url: 'https://medlineplus.gov/foodallergy.html' },
      { term: 'Food intolerance', url: 'https://medlineplus.gov/ency/patientinstructions/000749.htm' },
      { term: 'Lactose intolerance', url: 'https://medlineplus.gov/lactoseintolerance.html' },
      { term: 'Celiac disease', url: 'https://medlineplus.gov/celiacdisease.html' },
      { term: 'GERD', url: 'https://medlineplus.gov/gerd.html' },
    ],
  },
]

/* ── Execution ──────────────────────────────────────────────────────── */

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')
  console.log('=== STEP 3 Batch 2: Writing SEO fixes for Articles 11-23 ===\n')

  // ── 0. Delete duplicate article 18 ──────────────────────────────
  console.log('--- Deleting duplicate Article ID 18 (same slug as 15) ---')
  try {
    const dup = await payload.findByID({ collection: 'articles', id: 18, depth: 0 }) as any
    console.log(`  Found: ID ${dup.id}, slug="${dup.slug}", status=${dup._status}`)
    await payload.delete({ collection: 'articles', id: 18 })
    console.log('  DELETED.')
  } catch (err) {
    console.log(`  Could not delete (may not exist): ${(err as Error).message.slice(0, 100)}`)
  }

  // ── 1. Apply SEO updates ─────────────────────────────────────────
  for (const update of UPDATES) {
    console.log(`\n--- Article ID ${update.id} ---`)
    const data: any = {}

    if (update.seo) {
      data.seo = {}
      for (const [key, value] of Object.entries(update.seo)) {
        if (key === 'canonical') {
          data.seo.canonical = value
          continue
        }
        if (typeof value === 'string' && (key.includes('Title') || key === 'metaTitle')) {
          assertLen(value, 60, key, update.id)
        }
        if (typeof value === 'string' && (key.includes('Description') || key === 'metaDescription')) {
          assertLen(value, 155, key, update.id)
        }
        data.seo[key] = value
      }
    }

    if (update.semanticEntities) {
      data.semanticEntities = update.semanticEntities
    }

    try {
      await payload.update({ collection: 'articles', id: update.id, data })
      const seoCount = update.seo ? Object.keys(update.seo).length : 0
      const entCount = update.semanticEntities ? update.semanticEntities.length : 0
      console.log(`  OK — ${seoCount} SEO fields${entCount ? ` + ${entCount} entities` : ''}`)
    } catch (err) {
      console.error(`  ERROR: ${(err as Error).message.slice(0, 200)}`)
    }
  }

  // ── 2. Verification ──────────────────────────────────────────────
  console.log('\n=== Verification: Re-fetching articles to check char counts ===\n')

  const verifyIds = [11, 13, 15, 16, 17, 19, 20, 21, 22, 23]
  for (const id of verifyIds) {
    try {
      const a = await payload.findByID({ collection: 'articles', id, depth: 0 }) as any
      const seo = a.seo || {}
      const entCount = a.semanticEntities?.length || 0
      const kwCount = seo.keywords?.length || 0

      const mt = (seo.metaTitle || '').length
      const md = (seo.metaDescription || '').length
      const ot = (seo.ogTitle || '').length
      const od = (seo.ogDescription || '').length
      const tt = (seo.twitterTitle || '').length
      const td = (seo.twitterDescription || '').length

      const ok = (n: number, max: number) => n <= max ? 'OK' : 'OVER'
      console.log(`ID ${id} [${a._status}]: metaT=${mt}/${ok(mt,60)} metaD=${md}/${ok(md,155)} ogT=${ot}/${ok(ot,60)} ogD=${od}/${ok(od,155)} twT=${tt}/${ok(tt,60)} twD=${td}/${ok(td,155)} kw=${kwCount} ent=${entCount}`)
    } catch (err) {
      console.log(`ID ${id}: ERROR fetching — ${(err as Error).message.slice(0, 80)}`)
    }
  }

  // Verify article 18 is gone
  console.log('\n--- Verify duplicate article 18 deleted ---')
  try {
    await payload.findByID({ collection: 'articles', id: 18, depth: 0 })
    console.log('  WARNING: Article 18 still exists!')
  } catch {
    console.log('  Confirmed: Article 18 deleted successfully.')
  }

  // Final article count
  const all = await payload.find({ collection: 'articles', limit: 100, depth: 0 })
  console.log(`\nFinal article count: ${all.totalDocs}`)

  await payload.destroy()
  console.log('\nBatch 2 complete. STEP 3 finished.')
}

main().catch((err) => { console.error('Script failed:', err); process.exit(1) })
