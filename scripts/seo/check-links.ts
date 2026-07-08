/**
 * SEO link checker — scans an article for internal /tools/ and /wellness-hub/
 * links and verifies each target exists in the CMS.
 *
 * Usage: npx tsx --env-file=.env scripts/seo/check-links.ts --page=<slug>
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const slug = process.argv.find((a) => a.startsWith('--page='))?.split('=')[1]
if (!slug) {
  console.error('Usage: check-links.ts --page=<article-slug>')
  process.exit(1)
}

async function main() {
  const payload = await getPayload({ config: configPromise })

  const res = await payload.find({
    collection: 'articles',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })

  if (!res.docs.length) {
    console.log(`Article "${slug}" not found.`)
    process.exit(1)
  }

  const article = res.docs[0] as any
  console.log(`Checking article: "${article.title}" (slug: ${article.slug})`)

  const layoutStr = JSON.stringify(article.layout || [])
  const linkRegex = /\/(tools|wellness-hub)\/[a-z0-9-]+/g
  const found = [...new Set(layoutStr.match(linkRegex) || [])]

  console.log(`\nFound ${found.length} unique internal links in content:`)
  for (const link of found) console.log(`  ${link}`)

  let broken = 0
  console.log('\n--- Link verification ---')
  for (const link of found) {
    const parts = link.split('/')
    const collection = parts[1] === 'tools' ? 'tools' : 'articles'
    const targetSlug = parts[2]
    const targetRes = await payload.find({ collection, where: { slug: { equals: targetSlug } }, limit: 1 })
    if (targetRes.docs.length) {
      const t = targetRes.docs[0] as any
      console.log(`  ${link} -> OK (ID ${t.id})`)
    } else {
      console.log(`  ${link} -> BROKEN`)
      broken++
    }
  }

  // Task-specified links
  console.log('\n--- Task-specified links ---')
  for (const link of ['/tools/body-fat-percentage-calculator', '/tools/how-much-protein-do-i-need']) {
    const ts = link.split('/').pop()!
    const tr = await payload.find({ collection: 'tools', where: { slug: { equals: ts } }, limit: 1 })
    if (tr.docs.length) {
      const t = tr.docs[0] as any
      console.log(`  ${link} -> OK (ID ${t.id}, enabled=${t.enabled}, ${t._status})`)
    } else {
      console.log(`  ${link} -> BROKEN`)
      broken++
    }
  }

  console.log(`\nResult: ${broken} broken`)
  await payload.destroy()
  process.exit(broken > 0 ? 1 : 0)
}

main().catch((err) => { console.error('Script failed:', err); process.exit(1) })
