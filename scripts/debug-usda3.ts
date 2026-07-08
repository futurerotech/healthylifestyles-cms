const API_KEY = process.env.USDA_FDC_API_KEY
const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1'

async function searchType(query: string, dataType: string) {
  const url = `${FDC_BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(query)}&dataType=${dataType}&pageSize=3`
  const res = await fetch(url)
  const data = await res.json()
  console.log(`\n${dataType} for "${query}":`)
  if (data.foods) {
    for (const food of data.foods.slice(0, 3)) {
      const cal = food.foodNutrients?.find((n: any) => n.nutrientId === 1008)
      console.log(`  ${food.description} [${food.dataType}] cal: ${cal ? cal.value : 'MISSING'}`)
    }
  }
}

async function main() {
  await searchType('olive oil', 'SR%20Legacy')
  await searchType('olive oil', 'Foundation')
  await searchType('olive oil', 'Branded')
}

main().catch(console.error)
