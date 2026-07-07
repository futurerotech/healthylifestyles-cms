import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })

  // ── Category B: fitness (ID 12) → "fitness tips", "fitness guide" ──
  const fitName = 'Fitness Training'
  const fitMetaTitle = 'Fitness Tips & Training Guides for All Levels'
  const fitMetaDesc = 'Practical fitness tips and training guides — workouts, strength, cardio, and recovery for beginners to advanced. Free fitness calculators included.'

  console.log(`Category B (fitness, ID 12):`)
  console.log(`  name (H1): "Fitness" -> "${fitName}"`)
  console.log(`  metaTitle: "${fitMetaTitle}" [${fitMetaTitle.length}/60]`)
  console.log(`  metaDescription: "${fitMetaDesc}" [${fitMetaDesc.length}/155]`)
  console.log(`  keywords: ["fitness tips", "fitness guide"]`)

  await payload.update({
    collection: 'categories',
    id: 12,
    data: {
      name: fitName,
      description: 'Training, strength, cardio, and recovery — practical fitness tips and free calculators for every level.',
      seo: {
        metaTitle: fitMetaTitle,
        metaDescription: fitMetaDesc,
        keywords: ['fitness tips', 'fitness guide'],
      },
    } as any,
  })
  console.log('  WRITTEN.')

  // ── Category A: fitness-and-metabolism (ID 17) → "fitness and metabolism", "metabolism boost exercises" ──
  const famName = 'Fitness & Metabolism'
  const famMetaTitle = 'Fitness & Metabolism: How Exercise Shapes Your Metabolism'
  const famMetaDesc = 'Learn how fitness affects your metabolism — metabolism boost exercises, calorie burn, metabolic age, and the science of energy expenditure. Free tools.'

  console.log(`\nCategory A (fitness-and-metabolism, ID 17):`)
  console.log(`  name (H1): "Fitness And Metabolism" -> "${famName}"`)
  console.log(`  description: "" -> "How exercise shapes your metabolism..."`)
  console.log(`  metaTitle: "${famMetaTitle}" [${famMetaTitle.length}/60]`)
  console.log(`  metaDescription: "${famMetaDesc}" [${famMetaDesc.length}/155]`)
  console.log(`  keywords: ["fitness and metabolism", "metabolism boost exercises"]`)

  await payload.update({
    collection: 'categories',
    id: 17,
    data: {
      name: famName,
      description: 'How exercise shapes your metabolism — calorie burn, metabolic age, energy expenditure, and metabolism-boosting workouts.',
      seo: {
        metaTitle: famMetaTitle,
        metaDescription: famMetaDesc,
        keywords: ['fitness and metabolism', 'metabolism boost exercises'],
      },
    } as any,
  })
  console.log('  WRITTEN.')

  // ── Token overlap check ──
  const tokensA = new Set(fitMetaTitle.toLowerCase().split(/\s+/).filter(t => t.length > 2))
  const tokensB = new Set(famMetaTitle.toLowerCase().split(/\s+/).filter(t => t.length > 2))
  const shared = [...tokensA].filter(t => tokensB.has(t))
  const overlap = shared.length / Math.max(tokensA.size, tokensB.size)

  console.log(`\n=== TOKEN OVERLAP CHECK ===`)
  console.log(`Title A tokens: ${[...tokensA].join(', ')}`)
  console.log(`Title B tokens: ${[...tokensB].join(', ')}`)
  console.log(`Shared: ${shared.join(', ')} (${shared.length})`)
  console.log(`Overlap: ${shared.length}/${Math.max(tokensA.size, tokensB.size)} = ${(overlap * 100).toFixed(1)}%`)
  console.log(`< 40%? ${overlap < 0.4 ? 'YES ✅' : 'NO ❌'}`)

  // ── Verification ──
  console.log(`\n=== VERIFICATION ===`)
  const vA = await payload.findByID({ collection: 'categories', id: 12, depth: 0 }) as any
  const vB = await payload.findByID({ collection: 'categories', id: 17, depth: 0 }) as any
  console.log(`Category 12: name="${vA.name}", metaTitle="${vA.seo?.metaTitle}", kw=${JSON.stringify(vA.seo?.keywords)}`)
  console.log(`Category 17: name="${vB.name}", metaTitle="${vB.seo?.metaTitle}", kw=${JSON.stringify(vB.seo?.keywords)}`)
  console.log(`  desc 12: "${vA.description}"`)
  console.log(`  desc 17: "${vB.description}"`)

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
