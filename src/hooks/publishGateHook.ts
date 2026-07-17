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
  payload: { find: (a: never) => Promise<{ docs: { slug?: string }[] }>; findByID: (a: never) => Promise<{ alt?: string | null }> },
  heroImageId: number | string | null | undefined,
): Promise<GateContext> {
  const slugs = async (collection: string, limit: number): Promise<Set<string>> => {
    try {
      const r = await payload.find({ collection, limit, depth: 0, select: { slug: true } } as never);
      return new Set(r.docs.map((d) => d.slug).filter((s): s is string => typeof s === 'string'));
    } catch {
      return new Set(); // fail safe: unknown sets — but see fail-safe note below
    }
  };
  const [toolSlugs, articleSlugs, categorySlugs] = await Promise.all([
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
  return { toolSlugs, articleSlugs, categorySlugs, heroImageAlt };
}

export const publishGateHook: CollectionBeforeValidateHook = async ({ data, originalDoc, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return data;
  const context = req?.context as { reseedVersions?: boolean; seoAuditFix?: boolean } | undefined;
  if (context?.reseedVersions || context?.seoAuditFix) return data;

  // Partial updates (e.g. data:{} republish) must be judged on the merged doc.
  const merged = { ...(originalDoc ?? {}), ...(data ?? {}) } as GateDoc & { _status?: string; heroImage?: number | { id?: number } };
  if (merged._status !== 'published') return data; // drafts are free

  const heroId = typeof merged.heroImage === 'object' && merged.heroImage !== null ? merged.heroImage.id : merged.heroImage;
  const ctx = await buildGateContext(req.payload as never, heroId ?? null);

  // FAIL SAFE (spec principle 1): if the slug indexes could not be loaded at
  // all, we cannot PROVE a link is broken — skip B4 rather than false-block.
  if (ctx.toolSlugs.size === 0 && ctx.articleSlugs.size === 0) {
    ctx.toolSlugs.add('__unavailable__');
    req?.payload?.logger?.warn?.('[publish-gate] slug indexes unavailable — broken-link check skipped (fail safe)');
    const { blocks } = runPublishGate(merged, ctx);
    const nonLink = blocks.filter((b) => b.code !== 'B4');
    if (nonLink.length) throw new Error(`Publish blocked by the SEO quality gate:\n${nonLink.map((b) => `• ${b.message}`).join('\n')}`);
    return data;
  }

  const { blocks } = runPublishGate(merged, ctx);
  if (blocks.length) {
    throw new Error(`Publish blocked by the SEO quality gate:\n${blocks.map((b) => `• ${b.message}`).join('\n')}\n(Fix the above, or keep the article as a draft.)`);
  }
  return data;
};
