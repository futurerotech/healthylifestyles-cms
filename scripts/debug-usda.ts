const API_KEY = process.env.USDA_FDC_API_KEY
const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1'

async function debugSearch(query: string) {
  const preferredTypes = 'SR%20Legacy,Foundation'
  const url = `${FDC_BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(query)}&dataType=${preferredTypes}&pageSize=2`
  console.log(`\nSearching: "${query}"`)
  const res = await fetch(url)
  console.log(`Status: ${res.status}`)
  const data = await res.json()
  if (data.foods && data.foods.length > 0) {
    const food = data.foods[0]
    console.log(`Match: ${food.description} (dataType: ${food.dataType})`)
    console.log(`foodNutrients count: ${food.foodNutrients?.length ?? 0}`)
    if (food.foodNutrients && food.foodNutrients.length > 0) {
      console.log('First 5 nutrients:')
      food.foodNutrients.slice(0, 5).forEach((n: any) => {
        console.log(`  ${JSON.stringify(n)}`)
      })
    }
  } else {
    console.log('No foods found')
    console.log('Full response:', JSON.stringify(data).slice(0, 500))
  }
}

async function main() {
  console.log('API key:', API_KEY ? `${API_KEY.slice(0, 8)}...` : 'NOT SET')
  await debugSearch('olive oil')
  await debugSearch('white rice raw')
  await debugSearch('eggs large')
}

main().catch(console.error)
