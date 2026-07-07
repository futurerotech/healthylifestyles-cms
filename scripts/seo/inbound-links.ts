/**
 * SEO inbound-links checker — counts how many source content files
 * contain internal links to a given tag page.
 *
 * Usage: npx tsx --env-file=.env scripts/seo/inbound-links.ts --page=<tag-slug>
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const tag = process.argv.find((a) => a.startsWith('--page='))?.split('=')[1]
if (!tag) {
  console.error('Usage: inbound-links.ts --page=<tag-slug>')
  process.exit(1)
}

const targetUrl = `/wellness-hub/tag/${tag}`
const dataDir = join(process.cwd(), '..', 'src', 'data')
const componentsDir = join(process.cwd(), '..', 'src', 'components')

let count = 0
const sources: string[] = []

// Scan all content .ts files in src/data/
if (existsSync(dataDir)) {
  const files = readdirSync(dataDir).filter((f) => f.endsWith('-content.ts'))
  for (const file of files) {
    const content = readFileSync(join(dataDir, file), 'utf8')
    // Count occurrences of the tag URL in this file
    const matches = content.split(targetUrl).length - 1
    if (matches > 0) {
      // Count how many tool entries contain the link
      // Each tool entry starts with '  \'<slug>\': {'
      // We need to count how many tool sections contain the link
      const sections = content.split(/^  '/m)
      let toolCount = 0
      for (const section of sections) {
        if (section.includes(targetUrl)) toolCount++
      }
      count += toolCount
      sources.push(`${file}: ${toolCount} tool(s)`)
    }
  }
}

// Scan .astro components for sidebar/component links
if (existsSync(componentsDir)) {
  const astroFiles = readdirSync(componentsDir).filter((f) => f.endsWith('.astro'))
  for (const file of astroFiles) {
    const content = readFileSync(join(componentsDir, file), 'utf8')
    if (content.includes(targetUrl)) {
      count++
      sources.push(`${file}: sidebar/component link`)
    }
  }
}

console.log(`Inbound links to ${targetUrl}:`)
for (const s of sources) console.log(`  ${s}`)
console.log(`Total: ${count}`)
console.log(tag === 'heart-health' || tag === 'mental-wellness'
  ? (count >= 3 ? `>= 3: PASS` : `< 3: FAIL`)
  : '')
process.exit(count >= 3 ? 0 : 1)
