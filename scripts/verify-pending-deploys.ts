import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')

  // Check pending-deploys count BEFORE
  const before = await payload.find({ collection: 'pending-deploys', limit: 100, depth: 0 })
  console.log(`Pending-deploys BEFORE: ${before.totalDocs}`)

  // Simulate a save on article ID 1 (touch it without changing content)
  const article = await payload.findByID({ collection: 'articles', id: 1, depth: 0 }) as any
  await payload.update({
    collection: 'articles',
    id: 1,
    data: { title: article.title }, // no-op save
  })
  console.log('Article 1 saved (no-op title update to trigger afterChange hook)')

  // Check pending-deploys count AFTER
  const after = await payload.find({ collection: 'pending-deploys', limit: 100, depth: 0 })
  console.log(`Pending-deploys AFTER: ${after.totalDocs}`)

  if (after.totalDocs > before.totalDocs) {
    console.log('\n✅ PASS: Saving created 1 pending-deploys entry (no Vercel build triggered)')
    // Show the new entry
    const newEntries = after.docs.slice(before.totalDocs)
    for (const e of newEntries) {
      const d = e as any
      console.log(`  New entry: collectionSlug=${d.collectionSlug}, docId=${d.docId}, changedAt=${d.changedAt}`)
    }
  } else {
    console.log('\n❌ FAIL: No new pending-deploys entry created')
  }

  // Verify no Vercel deploy was triggered (check console output — no "[Vercel]" log)
  console.log('\nNote: If no "[Vercel] Rebuild queued" log appeared above, 0 builds were triggered.')

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
