import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.')

  const catResult = await payload.find({
    collection: 'categories',
    where: { slug: { equals: 'heart-vitals' } },
    limit: 1,
  })

  if (!catResult.docs.length) {
    console.log('Category heart-vitals not found.')
    await payload.destroy()
    return
  }

  const cat = catResult.docs[0] as any
  console.log(`Found: ${cat.slug} (ID ${cat.id}), kind=${cat.kind}`)

  if (cat.kind === 'tool') {
    console.log('Already kind=tool. No change needed.')
    await payload.destroy()
    return
  }

  await payload.update({
    collection: 'categories',
    id: cat.id,
    data: { kind: 'tool' },
  } as any)

  console.log(`Updated heart-vitals (ID ${cat.id}) kind: section -> tool`)

  await payload.destroy()
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
