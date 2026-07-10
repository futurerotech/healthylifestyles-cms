import type { CollectionAfterChangeHook } from 'payload';
import { queueIndexNowPing } from '../lib/indexnow';

/**
 * Phase 14 P1 — IndexNow ping on the EXACT draft→published transition.
 *
 * Fires ONLY when a doc becomes published now and was NOT published before
 * (previousDoc._status !== 'published') — so autosaves, draft edits, bulk
 * republishes of already-published docs (backfills), and unpublishes never
 * ping. Migrations run raw SQL (no hooks); for Local-API seed scripts set
 * INDEXNOW_DISABLE=true. Enqueue is synchronous + try/caught: a ping can
 * never block or fail the save (the network happens later, debounced).
 */
const PATH_BUILDERS: Record<string, (slug: string) => string> = {
  articles: (s) => `/wellness-hub/${s}`,
  tools: (s) => `/tools/${s}`,
};

export const notifyIndexNow: CollectionAfterChangeHook = ({ doc, previousDoc, collection }) => {
  try {
    const isPublished = (doc as { _status?: string })?._status === 'published';
    const wasPublished = (previousDoc as { _status?: string })?._status === 'published';
    if (!isPublished || wasPublished) return doc;

    const build = PATH_BUILDERS[collection?.slug || ''];
    const slug = (doc as { slug?: unknown })?.slug;
    if (build && typeof slug === 'string' && slug) {
      queueIndexNowPing([build(slug)]);
    }
  } catch {
    // Never block the save.
  }
  return doc;
};
