/**
 * SEO Quality Gate Phase 2 — publish enforcement (BLOCKS ONLY).
 *
 * Runs on Articles beforeValidate. Drafts/autosaves pass untouched; only a
 * PUBLISH (merged _status === 'published') is gated, and only on the narrow
 * deterministic block set in src/lib/publishGate.ts. Warnings are NOT enforced
 * here — the editor sees them in the PublishGatePanel sidebar and decides.
 *
 * Bulk maintenance runs (reseed-versions, seo-audit-fix) bypass via context,
 * same convention as afterChangeIndexingHook.
 */
import type { CollectionBeforeValidateHook } from 'payload';
import { runPublishGate, type GateContext, type GateDoc } from '../lib/publishGate';

export async function buildGateContext(
  payload: { find: (a: never) => Promise<{
    docs: { slug?: string }[]; hasNextPage?: boolean; totalPages?: number; totalDocs?: number;
  }>; findByID: (a: never) => Promise<{ alt?: string | null }> },
  heroImageId: number | string | null | undefined,
): Promise<GateContext> {
  const slugs = async (collection: string, limit: number): Promise<{ values: Set<string>; complete: boolean }> => {
    try {
      const r = await payload.find({ collection, limit, depth: 0, select: { slug: true } } as never);
      if (!Array.isArray(r.docs)) throw new Error('Missing slug lookup docs');
      // A missing pagination receipt is not evidence of a complete catalog.
      // Contradictory positive "more pages" evidence takes precedence.
      const hasMore = r.hasNextPage === true ||
        (typeof r.totalPages === 'number' && r.totalPages > 1) ||
        (typeof r.totalDocs === 'number' && r.totalDocs > r.docs.length);
      const terminal = r.hasNextPage === false ||
        (typeof r.totalPages === 'number' && r.totalPages >= 0 && r.totalPages <= 1) ||
        (typeof r.totalDocs === 'number' && r.totalDocs === r.docs.length);
      const complete = !hasMore && terminal;
      return {
        values: new Set(r.docs.map((d) => d.slug).filter((s): s is string => typeof s === 'string')),
        complete,
      };
    } catch {
      return { values: new Set<string>(), complete: false };
    }
  };
  const [tools, articles, categories] = await Promise.all([
    slugs('tools', 500),
    slugs('articles', 1000),
    slugs('categories', 100),
  ]);
  let heroImageAlt: string | null | undefined; // undefined = unknown (no W5)
  if (heroImageId != null) {
    try {
      const media = await payload.findByID({ collection: 'media', id: heroImageId, depth: 0 } as never);
      heroImageAlt = (media?.alt ?? null) as string | null;
    } catch {
      heroImageAlt = undefined;
    }
  }
  return {
    toolSlugs: tools.values, articleSlugs: articles.values,
    categorySlugs: categories.values,
    toolSlugsComplete: tools.complete, articleSlugsComplete: articles.complete,
    categorySlugsComplete: categories.complete, heroImageAlt,
  };
}

export const publishGateHook: CollectionBeforeValidateHook = async ({ data, originalDoc, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return data;
  // An explicit Payload draft version of a published article can inherit its
  // parent's _status=published. Draft edits must not trigger publish checks.
  const draft = (req?.query as { draft?: unknown } | undefined)?.draft;
  if (draft === true || draft === 'true') return data;
  const context = req?.context as { reseedVersions?: boolean; seoAuditFix?: boolean } | undefined;
  if (context?.reseedVersions || context?.seoAuditFix) return data;

  // Partial updates (e.g. data:{} republish) must be judged on the merged doc.
  const merged = { ...(originalDoc ?? {}), ...(data ?? {}) } as GateDoc & { _status?: string; heroImage?: number | { id?: number } };
  // A partial Payload SEO group update may omit noIndex. Merge its known
  // siblings for validation so the previous robots directive is not lost.
  // An explicitly submitted noIndex:false still clears the old flag.
  const oldSeo = (originalDoc as GateDoc | undefined)?.seo;
  const incomingSeo = (data as GateDoc | undefined)?.seo;
  if (oldSeo && typeof oldSeo === 'object' && incomingSeo !== undefined) {
    if (incomingSeo && typeof incomingSeo === 'object') {
      merged.seo = { ...oldSeo, ...incomingSeo };
      // Only an explicit boolean false may clear an inherited noIndex=true.
      // Null/undefined checkbox values are not proof of an editorial decision.
      if (oldSeo.noIndex === true && incomingSeo.noIndex !== false) {
        merged.seo.noIndex = true;
      }
    } else if (oldSeo.noIndex === true) {
      // A null/invalid replacement SEO group must not silently undo noindex.
      merged.seo = { noIndex: true };
    }
  }
  if (merged._status !== 'published') return data; // drafts are free

  const heroId = typeof merged.heroImage === 'object' && merged.heroImage !== null ? merged.heroImage.id : merged.heroImage;
  const ctx = await buildGateContext(req.payload as never, heroId ?? null);

  // Only incomplete catalogs are unknown; unrelated verified links retain
  // their original broken-link protection without false blocks.
  if (ctx.toolSlugsComplete === false || ctx.articleSlugsComplete === false ||
      ctx.categorySlugsComplete === false) {
    req?.payload?.logger?.warn?.('[publish-gate] slug lookup incomplete; unknown targets not blocked');
  }

  const { blocks } = runPublishGate(merged, ctx);
  if (blocks.length) {
    throw new Error(`Publish blocked by the SEO quality gate:\n${blocks.map((b) => `• ${b.message}`).join('\n')}\n(Fix the above, or keep the article as a draft.)`);
  }
  return data;
};
