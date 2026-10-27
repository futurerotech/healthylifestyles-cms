/** Draft-only policy for the isolated ChatGPT / Payload gateway.
 * This module has no secrets, network calls, or Payload imports.
 */
export type DraftObject = Record<string, unknown>;
export type DraftCheck = { ok: true; data: DraftObject } | { ok: false; errors: string[] };

const DRAFT_KEYS = new Set([
  'title', 'slug', 'excerpt', 'category', 'author', 'tags', 'primaryTool',
  'relatedTools', 'relatedArticles', 'layout', 'takeaways', 'sources',
  'semanticEntities', 'seo', 'aiImagePrompt', 'hasFAQ', 'isHowTo',
  'isHealthTopic',
]);
const BLOCKS = new Set(['text', 'toolEmbed', 'list', 'table', 'callout', 'peopleAlsoAsk']);
const safeId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const asRecord = (x: unknown): DraftObject | null =>
  x !== null && typeof x === 'object' && !Array.isArray(x) ? x as DraftObject : null;
const safeText = (x: unknown, max: number): x is string =>
  typeof x === 'string' && x.trim().length > 0 && x.length <= max;
const ids = (x: unknown, max: number): x is number[] =>
  Array.isArray(x) && x.length <= max && x.every(safeId) && new Set(x).size === x.length;

export function validateDraftInput(input: unknown): DraftCheck {
  const errors: string[] = [];
  const a = asRecord(input);
  if (!a) return { ok: false, errors: ['Article must be a JSON object.'] };
  for (const key of Object.keys(a)) {
    if (!DRAFT_KEYS.has(key)) errors.push('Forbidden field: ' + key);
  }
  if (!safeText(a.title, 60)) errors.push('Title must contain 1-60 characters.');
  if (typeof a.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug) || a.slug.length > 120) {
    errors.push('Slug must be a lowercase hyphenated segment, max 120 characters.');
  }
  if (!safeText(a.excerpt, 500)) errors.push('Excerpt is required (max 500 characters).');
  for (const name of ['category', 'author', 'primaryTool']) {
    if (!safeId(a[name])) errors.push('Invalid ' + name + ' relationship ID.');
  }
  if (!ids(a.tags, 6) || (a.tags as number[]).length < 1) errors.push('1-6 existing tag IDs required.');
  for (const name of ['relatedTools', 'relatedArticles']) {
    if (!ids(a[name], 6)) errors.push('Invalid ' + name + ' IDs.');
  }
  if (a.hasFAQ !== true) errors.push('Article must flag visible FAQ.');
  if (typeof a.isHowTo !== 'boolean' || typeof a.isHealthTopic !== 'boolean') errors.push('Explicit schema flags are required.');
  if (a.aiImagePrompt != null && (typeof a.aiImagePrompt !== 'string' || a.aiImagePrompt.length > 8000)) errors.push('Invalid hero image prompt.');

  const layout = a.layout;
  if (!Array.isArray(layout) || layout.length < 14 || layout.length > 90) {
    errors.push('Layout must contain 14-90 structured blocks.');
  }
  let embeds = 0;
  let faqItems = 0;
  let paragraphs = '';
  let headings = 0;
  if (Array.isArray(layout)) {
    for (const [index, block] of layout.entries()) {
      const b = asRecord(block);
      if (!b || !BLOCKS.has(String(b.blockType))) {
        errors.push('Unsupported block at index ' + index + '.');
        continue;
      }
      if (b.blockType === 'toolEmbed') {
        embeds++;
        if (b.tool !== a.primaryTool) errors.push('Embedded calculator must match primaryTool ID.');
      } else if (b.blockType === 'text') {
        if (!['p', 'h2', 'h3'].includes(String(b.style)) || !safeText(b.text, 9500)) errors.push('Invalid text block at ' + index);
        if (b.style === 'p' && typeof b.text === 'string') paragraphs += ' ' + b.text;
        if (b.style === 'h2') headings++;
      } else if (b.blockType === 'peopleAlsoAsk') {
        if (!Array.isArray(b.items) || b.items.length < 4 || b.items.length > 5 || !b.items.every((i: unknown) => {
          const q = asRecord(i);
          return q && safeText(q.question, 300) && safeText(q.answer, 1500);
        })) errors.push('FAQ must contain 4-5 valid question-answer pairs.');
        else faqItems += b.items.length;
      } else if (b.blockType === 'list') {
        if (!Array.isArray(b.items) || b.items.length < 2 || b.items.length > 20 || !b.items.every((i: unknown) => safeText(asRecord(i)?.text, 2500))) errors.push('Invalid list block at ' + index);
      } else if (b.blockType === 'table') {
        if (!Array.isArray(b.headers) || b.headers.length < 2 || b.headers.length > 8 || !b.headers.every((s: unknown) => safeText(s, 300))) errors.push('Invalid table headers at ' + index);
        if (!Array.isArray(b.rows) || b.rows.length < 2 || b.rows.length > 25 || !b.rows.every((row: unknown) => {
          const r = asRecord(row);
          return r && Array.isArray(r.cells) && r.cells.length === (Array.isArray(b.headers) ? b.headers.length : -1) && r.cells.every((s: unknown) => safeText(s, 1800));
        })) errors.push('Invalid table rows at ' + index);
      } else if (b.blockType === 'callout') {
        if (!safeText(b.title, 300) || !safeText(b.text, 1800) || !['info', 'tip', 'warning', 'success'].includes(String(b.tone))) errors.push('Invalid callout at ' + index);
      }
    }
  }
  if (embeds !== 1) errors.push('Exactly one real primary toolEmbed is required.');
  if (faqItems < 4) errors.push('Visible FAQ required.');
  if (headings < 6) errors.push('At least 6 substantive H2 sections required.');
  const internal = new Set<string>();
  const external = new Set<string>();
  for (const m of paragraphs.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
    const url = m[1];
    if (/^\/(?:tools|wellness-hub)\/[a-z0-9-]+$/.test(url)) internal.add(url);
    else if (/^https:\/\//.test(url)) {
      try {
        const parsed = new URL(url);
        if (parsed.username || parsed.password || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(parsed.hostname)) errors.push('Invalid outbound URL.');
        else external.add(url);
      } catch { errors.push('Malformed outbound URL.'); }
    } else errors.push('Unsafe or invalid paragraph link.');
  }
  if (internal.size < 5 || [...internal].filter(x => x.startsWith('/tools/')).length < 3 || [...internal].filter(x => x.startsWith('/wellness-hub/')).length < 2) errors.push('Require 3 contextual tool links and 2 article links.');
  if (external.size < 2) errors.push('Require at least two contextual HTTPS evidence links.');
  if (!Array.isArray(a.takeaways) || a.takeaways.length !== 3 || !a.takeaways.every((i: unknown) => safeText(asRecord(i)?.text, 800))) errors.push('Exactly three takeaways required.');
  if (!Array.isArray(a.sources) || a.sources.length < 3 || a.sources.length > 5 || !a.sources.every((i: unknown) => {
    const s = asRecord(i);
    return s && safeText(s.label, 350) && typeof s.url === 'string' && /^https:\/\//.test(s.url);
  })) errors.push('Require 3-5 source records with HTTPS URLs.');
  if (!Array.isArray(a.semanticEntities) || a.semanticEntities.length < 5 || a.semanticEntities.length > 7 || !a.semanticEntities.every((i: unknown) => {
    const e = asRecord(i);
    return e && safeText(e.term, 180) && typeof e.url === 'string' && /^https:\/\//.test(e.url);
  })) errors.push('Require 5-7 semantic entities with HTTPS links.');
  const seo = asRecord(a.seo);
  if (!seo || !safeText(seo.metaTitle, 60) || !safeText(seo.metaDescription, 160) || String(seo.metaDescription).length < 110 || !safeText(seo.ogTitle, 100) || !safeText(seo.ogDescription, 250) || !safeText(seo.twitterTitle, 100) || !safeText(seo.twitterDescription, 250) || seo.noIndex !== false || seo.canonical !== '' || !Array.isArray(seo.keywords) || seo.keywords.length < 3 || seo.keywords.length > 12 || !seo.keywords.every((s: unknown) => safeText(s, 100))) errors.push('SEO metadata is incomplete or exceeds limits.');
  if (errors.length) return { ok: false, errors };
  // Never trust client-supplied status/reviewer/publish flags. They are not in DRAFT_KEYS.
  return { ok: true, data: {
    ...a, _status: 'draft', featured: false, aiGenerated: true,
    reviewedByHuman: false, reviewer: null, heroImage: null,
    publishDate: null, updatedDate: null,
  } };
}
