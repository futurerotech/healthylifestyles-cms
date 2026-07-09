/**
 * find-dead-links.ts
 *
 * Finds the exact CMS document containing the dead link strings and prints
 * the field/path where they occur.
 */
const CMS_URL = process.env.CMS_URL || 'https://cms.healthylifesstyles.com'

const DEAD_LINKS = [
  '/tools/body-fat-percentage-calculator',
  '/tools/how-much-protein-do-i-need',
]

async function main() {
  const res = await fetch(`${CMS_URL}/api/articles?limit=1000&depth=2&where[_status][equals]=published`)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  const data = await res.json()
  const docs = data.docs || []

  for (const doc of docs) {
    const str = JSON.stringify(doc)
    const found = DEAD_LINKS.filter((link) => str.includes(link))
    if (found.length > 0) {
      console.log(`\nFound in article: ${doc.title} (slug: ${doc.slug}, id: ${doc.id})`)
      console.log(`Dead links: ${found.join(', ')}`)
      // Try to pinpoint the field
      for (const link of found) {
        findPaths(doc, link, [])
      }
    }
  }
}

function findPaths(obj: any, target: string, path: string[]) {
  if (typeof obj === 'string') {
    if (obj.includes(target)) {
      console.log(`  Path: ${path.join('.')} = "${obj.slice(0, 120)}..."`)
    }
    return
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => findPaths(item, target, [...path, `[${i}]`]))
    return
  }
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      findPaths(value, target, [...path, key])
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
