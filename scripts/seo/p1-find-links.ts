import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })

  // Fetch article 17 with layout field
  const article = await payload.findByID({ collection: 'articles', id: 17, depth: 0 }) as any
  console.log('Article 17:', article.title)
  console.log('Fields:', Object.keys(article).join(', '))

  // Check layout field
  const layout = article.layout
  if (layout && Array.isArray(layout)) {
    console.log(`\nLayout: ${layout.length} blocks`)
    const bodyStr = JSON.stringify(layout)
    
    // Search for dead links
    const deadLinks = ['body-fat-percentage-calculator', 'how-much-protein-do-i-need']
    for (const dl of deadLinks) {
      if (bodyStr.includes(dl)) {
        console.log(`\nFOUND "${dl}" in layout:`)
        // Find all occurrences
        let idx = 0
        while ((idx = bodyStr.indexOf(dl, idx)) !== -1) {
          const ctx = bodyStr.slice(Math.max(0, idx - 100), idx + dl.length + 50)
          console.log(`  ...${ctx}...`)
          idx += dl.length
        }
      } else {
        console.log(`\n"${dl}" NOT found in layout`)
      }
    }
  } else {
    console.log('\nLayout field:', typeof layout, layout ? JSON.stringify(layout).slice(0, 200) : 'null')
    // Check all string fields for the dead links
    const allStr = JSON.stringify(article)
    for (const dl of deadLinks) {
      if (allStr.includes(dl)) {
        console.log(`FOUND "${dl}" somewhere in article`)
        let idx = allStr.indexOf(dl)
        console.log('  Context:', allStr.slice(Math.max(0, idx - 80), idx + 80))
      }
    }
  }

  // Check if the tools are enabled/live
  console.log('\n--- Tool status ---')
  for (const slug of ['body-fat-percentage-calculator', 'how-much-protein-do-i-need']) {
    const res = await payload.find({ collection: 'tools', where: { slug: { equals: slug } }, limit: 1 })
    if (res.docs.length) {
      const t = res.docs[0] as any
      console.log(`  ${slug}: enabled=${t.enabled}, _status=${t._status}`)
    }
  }

  await payload.destroy()
}

const deadLinks = ['body-fat-percentage-calculator', 'how-much-protein-do-i-need']

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
