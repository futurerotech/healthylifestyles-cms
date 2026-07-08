const API_KEY = process.env.USDA_FDC_API_KEY
const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1'

async function debugNutrients(query: string) {
  const url = `${FDC_BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(query)}&dataType=SR%20Legacy,Foundation&pageSize=3&sortBy=dataType.keyword`
  console.log(`\nSearching: "${query}"`)
  const res = await fetch(url)
  const data = await res.json()
  if (data.foods) {
    for (const food of data.foods.slice(0, 3)) {
      const cal = food.foodNutrients?.find((n: any) => n.nutrientId === 1008)
      const protein = food.foodNutrients?.find((n: any) => n.nutrientId === 1003)
      const fat = food.foodNutrients?.find((n: any) => n.nutrientId === 1004)
      console.log(`  ${food.description} [${food.dataType}]`)
      console.log(`    cal(1008): ${cal ? cal.value : 'MISSING'}  protein(1003): ${protein ? protein.value : 'MISSING'}  fat(1004): ${fat ? fat.value : 'MISSING'}`)
    }
  }
}

async function main() {
  await debugNutrients('olive oil')
  await debugNutrients('oil olive')
  await debugNutrients('eggs whole')
  await debugNutrients('egg whole')
}

main().catch(console.error)
