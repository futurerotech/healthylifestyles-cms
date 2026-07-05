import { parseRecipe, isParseConfigured } from '../src/lib/parseRecipe'
import { searchFood, isUsdaConfigured } from '../src/lib/usda'

async function main() {
  console.log('=== Recipe Nutrition Analyzer Test ===\n')

  console.log('Config check:')
  console.log('  NaraRouter configured:', isParseConfigured())
  console.log('  USDA configured:', isUsdaConfigured())
  console.log('  AI_PARSE_MODEL:', process.env.AI_PARSE_MODEL || 'claude-sonnet-4.6 (default)')
  console.log('')

  const testText = '1 cup white rice (raw)\n1 tbsp olive oil\n2 large eggs\n1 medium onion'
  console.log('Test recipe:', testText.replace(/\n/g, ' | '))
  console.log('')

  // 1. Parse
  console.log('--- Step 1: AI Parse ---')
  let parsed
  try {
    parsed = await parseRecipe(testText)
    console.log(`Parsed ${parsed.length} ingredients:`)
    for (const p of parsed) {
      const conv = p.unitConverted ? ' (converted)' : ''
      console.log(`  "${p.raw}" -> ${p.name}, ${p.quantity}g${conv}`)
    }
  } catch (err) {
    console.error('Parse failed:', (err as Error).message)
    process.exit(1)
  }

  // 2. USDA search per ingredient
  console.log('\n--- Step 2: USDA Search ---')
  const totals: Record<string, number | null> = {
    calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0,
  }
  const matched: any[] = []
  const unmatched: any[] = []

  for (const ing of parsed) {
    if (ing.quantity <= 0 || ing.unit === 'unknown') {
      unmatched.push(ing)
      console.log(`  SKIP: "${ing.raw}" (no quantity)`)
      continue
    }
    const usda = await searchFood(ing.name)
    if (!usda || usda.matchConfidence === 'none') {
      unmatched.push(ing)
      console.log(`  NO MATCH: "${ing.raw}" -> "${ing.name}"`)
      continue
    }
    const factor = ing.quantity / 100
    const ingNutrients: Record<string, number | null> = {}
    for (const [key, val] of Object.entries(usda.nutrients)) {
      ingNutrients[key] = val != null ? val * factor : null
      if (val != null) {
        totals[key] = (totals[key] ?? 0) + val * factor
      }
    }
    matched.push({ ing, usda, ingNutrients })
    console.log(`  MATCH: "${ing.raw}" -> USDA: ${usda.name} (${usda.matchConfidence})`)
    console.log(`    ${ing.quantity}g x per-100g = ${Math.round(ingNutrients.calories ?? 0)} kcal`)
  }

  // 3. Compute per recipe + per serving
  console.log('\n--- Step 3: Compute ---')
  const servings = 4
  console.log(`Servings: ${servings}`)
  console.log('\nPer RECIPE:')
  for (const [key, val] of Object.entries(totals)) {
    const unit = key === 'calories' ? 'kcal' : key === 'sodium' ? 'mg' : 'g'
    console.log(`  ${key}: ${val != null ? Math.round(val * 10) / 10 : '---'} ${unit}`)
  }
  console.log('\nPer SERVING:')
  for (const [key, val] of Object.entries(totals)) {
    const unit = key === 'calories' ? 'kcal' : key === 'sodium' ? 'mg' : 'g'
    const perServ = val != null ? Math.round((val / servings) * 10) / 10 : null
    console.log(`  ${key}: ${perServ != null ? perServ : '---'} ${unit}`)
  }

  // Sanity check: 1 tbsp olive oil ≈ 119 kcal, 14g fat
  const oilIng = matched.find((m) => m.ing.name.includes('olive oil'))
  if (oilIng) {
    console.log('\n--- Sanity Check: 1 tbsp olive oil ---')
    console.log(`  Calories: ${Math.round(oilIng.ingNutrients.calories ?? 0)} kcal (expect ~119)`)
    console.log(`  Fat: ${Math.round((oilIng.ingNutrients.fat ?? 0) * 10) / 10}g (expect ~14g)`)
  }

  if (unmatched.length > 0) {
    console.log(`\nUnmatched: ${unmatched.map((u) => u.raw).join(', ')}`)
  }

  console.log('\n=== Test complete ===')
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
