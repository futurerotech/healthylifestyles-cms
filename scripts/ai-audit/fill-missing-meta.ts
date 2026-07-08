import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })

  const fixes: { id: number; name: string; slug: string; oldDesc: string; newDesc: string }[] = []

  // ID 54: Body Fat Percentage Calculator — missing meta description
  const t54 = await payload.findByID({ collection: 'tools', id: 54, depth: 0 }) as any
  const new54 = 'Estimate your body fat percentage with the U.S. Navy method using waist, neck, and hip measurements. Free, no signup. Educational only.'
  if (new54.length <= 155) {
    await payload.update({
      collection: 'tools',
      id: 54,
      data: { seo: { ...t54.seo, metaDescription: new54 } } as any,
    })
    fixes.push({ id: 54, name: t54.name, slug: t54.slug, oldDesc: '(empty)', newDesc: new54 })
    console.log(`✅ ID 54 "${t54.name}": ${new54.length} chars`)
  }

  // ID 55: How Much Protein Do I Need — missing meta description
  const t55 = await payload.findByID({ collection: 'tools', id: 55, depth: 0 }) as any
  const new55 = 'Calculate your daily protein needs based on body weight and activity level. See grams per kg and pound for muscle, weight loss, or general health.'
  if (new55.length <= 155) {
    await payload.update({
      collection: 'tools',
      id: 55,
      data: { seo: { ...t55.seo, metaDescription: new55 } } as any,
    })
    fixes.push({ id: 55, name: t55.name, slug: t55.slug, oldDesc: '(empty)', newDesc: new55 })
    console.log(`✅ ID 55 "${t55.name}": ${new55.length} chars`)
  }

  // Log
  if (fixes.length > 0) {
    await payload.create({
      collection: 'audit-log',
      data: {
        runId: `tools-meta-missing-${new Date().toISOString().slice(0, 10)}`,
        type: 'meta-description',
        status: 'completed',
        scannedCount: 2,
        issueCount: fixes.length,
        findings: fixes as any,
        summary: `Filled ${fixes.length} missing tool meta descriptions with deterministic copy.`,
      } as any,
    })
    console.log(`\n${fixes.length} missing meta descriptions filled. Audit log created.`)
  }

  await payload.destroy()
}

main().catch((err) => { console.error('Failed:', err); process.exit(1) })
