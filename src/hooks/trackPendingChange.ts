import type { CollectionAfterChangeHook } from 'payload'

/**
 * AI SEO Autopilot — track pending changes (§7.1).
 *
 * Replaces the auto-deploy Vercel hook. Each content save creates a
 * pending-deploys entry instead of triggering a build. The admin
 * Deploy button clears the queue when a manual deploy is triggered.
 */
export const trackPendingChange: CollectionAfterChangeHook = async ({
  req,
  doc,
  collection,
}) => {
  try {
    await req.payload.create({
      collection: 'pending-deploys',
      data: {
        docId: String(doc.id),
        collectionSlug: collection.slug || 'unknown',
        changedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('[trackPendingChange] Failed to log pending change:', (err as Error).message)
  }
  return doc
}
