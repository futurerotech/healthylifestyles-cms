import type { CollectionAfterChangeHook } from 'payload'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { recordPublishedPendingChange } from '../lib/indexnow-pending-queue'

/**
 * Publish-only queue, serialized by document identity on PostgreSQL.
 * Never queue an autosaved draft or silently remove historical entries.
 */
export const trackPendingChange: CollectionAfterChangeHook = async ({ req, doc, collection }) => {
  if ((doc as { _status?: string })?._status !== 'published') return doc
  const slug = collection.slug
  if (slug !== 'articles' && slug !== 'tools') return doc

  try {
    const db = req.payload.db as unknown as PostgresAdapter
    await recordPublishedPendingChange(db.pool, {
      collectionSlug: slug,
      docId: String(doc.id),
      changedAt: new Date().toISOString(),
    })
  } catch (err) {
    // Preserve publishing behavior on queue failure, but report the failure.
    // Operator must inspect missing queued changes before IndexNow acceptance.
    console.error('[trackPendingChange] Failed to record pending change:', (err as Error).message)
  }
  return doc
}
