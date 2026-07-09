/**
 * Phase 9 — single source of truth for deriving the advanced-schema booleans
 * (`isHowTo` / `isHealthTopic`) from article content.
 *
 * Used by:
 *  - the AI generation flow (src/endpoints/generateArticle.ts) to flag new
 *    drafts at creation, and
 *  - the one-time backfill (scripts/seo/backfill-schema-flags.ts).
 *
 * The Astro frontend NO LONGER computes these — it reads the stored CMS
 * booleans. This mirrors the exact heuristic the frontend used before Phase 9
 * (title + "Step N" headings for HowTo; "what is / how do you know / signs /
 * symptoms / explained / guide" or a condition-like semantic entity for
 * HealthTopic) so nothing regresses when the render path switches to booleans.
 *
 * Params are intentionally loose (`unknown[]`) so callers can pass raw Payload
 * blocks / entities without casts; each element is narrowed defensively.
 */
type SchemaFlagBlock = { blockType?: string; style?: string; text?: string | null };
type SchemaFlagEntity = { term?: string | null };

export function computeIsHowTo(title: string | null | undefined, layout?: readonly unknown[] | null): boolean {
  if (/^how\s+to\b/i.test(title || '')) return true;
  return (layout || []).some((raw) => {
    const b = (raw ?? {}) as SchemaFlagBlock;
    return b.blockType === 'text' && b.style === 'h2' && /^step\s+\d/i.test(b.text || '');
  });
}

export function computeIsHealthTopic(
  title: string | null | undefined,
  semanticEntities?: readonly unknown[] | null,
): boolean {
  const t = title || '';
  if (/^what is\b/i.test(t) || /^how do you know\b/i.test(t) || /\b(signs|symptoms|explained|guide)\b/i.test(t)) {
    return true;
  }
  return (semanticEntities || []).some((raw) => /syndrome|condition|disease|disorder|deficiency/i.test(((raw ?? {}) as SchemaFlagEntity).term || ''));
}
