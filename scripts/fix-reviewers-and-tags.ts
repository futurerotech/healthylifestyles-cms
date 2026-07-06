import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.\n')

  // ── 1. Assign reviewers ─────────────────────────────────────────
  const medicalReview = 2   // HealthyLifeStyles Medical Review Board
  const editorialTeam = 1   // HealthyLifeStyles Editorial Team

  const assignMedical = [6, 7, 9, 18, 19, 20, 21, 22, 23]
  const assignEditorial = [8]

  console.log('=== STEP 1a: Reviewer Assignments ===\n')

  for (const id of assignMedical) {
    const before = await payload.findByID({ collection: 'articles', id, depth: 1 }) as any
    const oldReviewer = before.reviewer ? (typeof before.reviewer === 'object' ? before.reviewer.name : before.reviewer) : 'NONE'
    await payload.update({ collection: 'articles', id, data: { reviewer: medicalReview } as any })
    console.log(`  Article ID ${id}: reviewer "${oldReviewer}" -> "HealthyLifeStyles Medical Review Board" (ID ${medicalReview})`)
  }

  for (const id of assignEditorial) {
    const before = await payload.findByID({ collection: 'articles', id, depth: 1 }) as any
    const oldReviewer = before.reviewer ? (typeof before.reviewer === 'object' ? before.reviewer.name : before.reviewer) : 'NONE'
    await payload.update({ collection: 'articles', id, data: { reviewer: editorialTeam } as any })
    console.log(`  Article ID ${id}: reviewer "${oldReviewer}" -> "HealthyLifeStyles Editorial Team" (ID ${editorialTeam})`)
  }

  console.log(`\nAssigned ${assignMedical.length + assignEditorial.length} reviewers total.`)

  // ── 2. Merge duplicate Hydration tag ────────────────────────────
  console.log('\n=== STEP 1b: Merge Duplicate Hydration Tag ===\n')

  const KEEP_ID = 1    // Surviving tag
  const DELETE_ID = 6  // Duplicate to delete

  // Find all articles that have tag ID 6
  const allArticles = await payload.find({ collection: 'articles', limit: 100, depth: 1 })
  let reassigned = 0

  for (const doc of allArticles.docs) {
    const a = doc as any
    const tagIds: number[] = (a.tags || []).map((t: any) => typeof t === 'object' ? t.id : t)

    if (tagIds.includes(DELETE_ID)) {
      // Merge: ensure KEEP_ID is in the list, remove DELETE_ID
      const merged = [...new Set([...tagIds.filter((id) => id !== DELETE_ID), KEEP_ID])]
      await payload.update({ collection: 'articles', id: a.id, data: { tags: merged } as any })
      console.log(`  Article ID ${a.id} ("${a.title?.slice(0, 50)}"): tags ${JSON.stringify(tagIds)} -> ${JSON.stringify(merged)}`)
      reassigned++
    }
  }

  console.log(`\nReassigned ${reassigned} article(s) from tag ID ${DELETE_ID} to tag ID ${KEEP_ID}.`)

  // Verify tag ID 6 has no articles left
  const remaining = await payload.find({ collection: 'articles', limit: 100, depth: 1 })
  const stillHasDeleted = remaining.docs.filter((d: any) => {
    const ids: number[] = (d.tags || []).map((t: any) => typeof t === 'object' ? t.id : t)
    return ids.includes(DELETE_ID)
  })

  if (stillHasDeleted.length > 0) {
    console.log(`WARNING: ${stillHasDeleted.length} articles still reference tag ID ${DELETE_ID}. Aborting delete.`)
  } else {
    console.log(`Tag ID ${DELETE_ID} has zero articles. Safe to delete.`)
    await payload.delete({ collection: 'tags', id: DELETE_ID })
    console.log(`Deleted tag ID ${DELETE_ID} ("Hydration" duplicate).`)
  }

  // Verify final state
  console.log('\n=== Verification ===\n')
  const finalTags = await payload.find({ collection: 'tags', limit: 50, sort: 'name', depth: 0 })
  console.log(`Tags remaining: ${finalTags.totalDocs}`)
  for (const t of finalTags.docs) {
    const tag = t as any
    console.log(`  ID ${tag.id}: ${tag.name} (slug: ${tag.slug})`)
  }

  const finalArticles = await payload.find({ collection: 'articles', limit: 100, depth: 1 })
  const withoutReviewer = finalArticles.docs.filter((d: any) => !d.reviewer)
  console.log(`\nArticles without reviewer: ${withoutReviewer.length}`)
  if (withoutReviewer.length === 0) {
    console.log('ALL articles now have a reviewer assigned.')
  }

  await payload.destroy()
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
