import type { CollectionAfterChangeHook } from 'payload'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { recordPublishedPendingChange } from '../lib/indexnow-pending-queue'

/**
 * Publish-only queue, serialized by document identity on PostgreSQL.
 * Never queue an autosaved draft or silently remove historical entries.
 */
export const trackPendingChange: CollectionAfterChangeHook = async ({ req, doc, collection }) => {
  // A Payload draft version of an already-published parent may still expose
  // parent _status='published'. Do not queue a future deployment for that save.
  const draft = (req?.query as { draft?: unknown } | undefined)?.draft
  // Isolated staging may exercise publishing but must never queue production work.
  if (draft === true || draft === 'true' || process.env.HLS_ISOLATED_STAGING === 'true') return doc
  if ((doc as { _status?: string })?._status !== 'published') return doc
  const slug = collection.slug
  if (slug !== 'articles' && slug !== 'tools') return doc

  try {
    const db = req.payload.db as unknown as PostgresAdapter
    await recordPublishedPendingChange(db, {
      collectionSlug: slug,
      docId: String(doc.id),
      changedAt: new Date().toISOString(),
    }, req.transactionID)
  } catch (err) {
    // A published revision without a queued change may never be reconciled
    // after Vercel deployment. Fail the content transaction rather than
    // silently lose the notification; Payload can roll back an active save.
    // Never print the document or database connection details in logs.
    req.payload.logger?.error?.('[trackPendingChange] Pending queue write failed; publication aborted')
    throw err
  }
  return doc
}
