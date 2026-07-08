import type { CollectionAfterChangeHook } from 'payload'

/**
 * AI SEO Autopilot — track pending changes (§7.1).
 *
 * Replaces the auto-deploy Vercel hook. Creates a pending-deploys entry
 * only when a document is PUBLISHED (not on every 800ms autosave draft).
 * Mirrors the old triggerVercelDeploy publish-only behavior.
 *
 * Dedupes by doc id: if a pending entry already exists for this doc,
 * it updates the timestamp instead of creating a duplicate.
 */
export const trackPendingChange: CollectionAfterChangeHook = async ({
  req,
  doc,
  collection,
  operation,
}) => {
  // Only queue on publish — skip autosave/draft saves
  // doc._status is 'published' when the doc is live, 'draft' when it's not
  // operation is 'create' or 'update'
  const status = (doc as any)?._status
  if (status !== 'published') return doc

  try {
    // Check if a pending entry already exists for this doc (dedupe)
    const existing = await req.payload.find({
      collection: 'pending-deploys',
      where: {
        and: [
          { docId: { equals: String(doc.id) } },
          { collectionSlug: { equals: collection.slug || 'unknown' } },
        ],
      },
      limit: 1,
    })

    if (existing.totalDocs > 0) {
      // Update timestamp on existing entry instead of creating a duplicate
      await req.payload.update({
        collection: 'pending-deploys',
        id: (existing.docs[0] as any).id,
        data: {
          changedAt: new Date().toISOString(),
        },
      })
    } else {
      // Create new pending entry
      await req.payload.create({
        collection: 'pending-deploys',
        data: {
          docId: String(doc.id),
          collectionSlug: collection.slug || 'unknown',
          changedAt: new Date().toISOString(),
        },
      })
    }
  } catch (err) {
    console.error('[trackPendingChange] Failed to log pending change:', (err as Error).message)
  }
  return doc
}
