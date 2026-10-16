import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook, PayloadRequest } from 'payload';

/** Keep draft-only edits quiet; publication, unpublication and public metadata changes need a build. */
export function affectsPublicContent(doc: Record<string, any>, previous?: Record<string, any>): boolean {
  if ('_status' in doc || previous && '_status' in previous) return doc._status === 'published' || previous?._status === 'published';
  if ('status' in doc || previous && 'status' in previous) return doc.status === 'published' || previous?.status === 'published';
  return true;
}

async function enqueue(req: PayloadRequest, collectionSlug: string, doc: Record<string, any>, deleted = false) {
  if (req.context?.reseedVersions) return;
  // Immutable queue entries avoid races between concurrent saves and deploy acknowledgements.
  await req.payload.create({ collection: 'pending-deploys' as any, overrideAccess: true, req, data: {
    collectionSlug, docId: String(doc.id ?? collectionSlug),
    changedAt: deleted ? new Date().toISOString() : doc.updatedAt || new Date().toISOString(),
  } });
}

export const trackPendingChange: CollectionAfterChangeHook = async ({ req, doc, previousDoc, collection }) => {
  if (affectsPublicContent(doc, previousDoc)) await enqueue(req, collection.slug, doc);
  return doc;
};
export const trackPendingDelete: CollectionAfterDeleteHook = async ({ req, doc, collection }) => {
  if (affectsPublicContent(doc)) await enqueue(req, collection.slug, doc, true);
  return doc;
};
export const trackGlobalChange: GlobalAfterChangeHook = async ({ req, doc, global }) => {
  await enqueue(req, `global:${global.slug}`, doc);
  return doc;
};
