import type { Endpoint, PayloadRequest } from 'payload';
import { generateArticle, regenerateSection, suggestTitles, extractClaims, coerceProvider, AIError } from '../services/ai';
import { REGEN_SECTIONS, type RegenSection, type GeneratedArticle } from '../services/articleSchema';
import { generateHeroImage, isImageConfigured } from '../services/image';
import { searchReputable, isSearchConfigured, type SearchResult } from '../services/search';
import { computeIsHowTo, computeIsHealthTopic } from '../lib/schemaFlags';

/**
 * POST /api/generate-article  and  POST /api/regenerate-section
 *
 * Editor-only, rate-limited endpoints that build tailored context from the
 * selected Tool + Category (+ the catalogue of existing tools & published
 * articles for accurate internal linking) via the Payload Local API, call the
 * AI service, validate the structured result, map it onto our Payload fields,
 * and SAVE it as a DRAFT (aiGenerated=true, reviewedByHuman=false). Never
 * publishes; never silently overwrites human edits (see `mode`).
 */

const isEditor = (req: PayloadRequest): boolean =>
  req.user?.role === 'admin' || req.user?.role === 'editor';

/* ------------------------- tiny rate limiter ----------------------- */
/* Best-effort in-memory limiter (per user, per process). Generation is
 * expensive, so a low ceiling protects the API key + spend. */
const RATE_MAX = 6;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

/* ------------------------------ helpers ---------------------------- */

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
}

/** Map AI `body` blocks → Payload `layout` blocks (slug + field names). */
function mapBody(body: GeneratedArticle['body'], toolSlugToId: Map<string, number | string>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const b of body) {
    switch (b.type) {
      case 'heading':
        out.push({ blockType: 'text', style: b.level === 3 ? 'h3' : 'h2', text: b.text });
        break;
      case 'paragraph':
        out.push({ blockType: 'text', style: 'p', text: b.text });
        break;
      case 'list':
        out.push({ blockType: 'list', style: b.ordered ? 'ordered' : 'unordered', items: b.items.map((t) => ({ text: t })) });
        break;
      case 'table':
        out.push({ blockType: 'table', headers: b.headers, rows: b.rows.map((cells) => ({ cells })) });
        break;
      case 'toolEmbed': {
        const id = toolSlugToId.get(b.toolSlug);
        if (id != null) out.push({ blockType: 'toolEmbed', tool: id });
        break; // unknown slug → skip rather than insert a broken embed
      }
      case 'disclaimer':
        out.push({ blockType: 'callout', tone: 'warning', title: 'Important', text: b.text });
        break;
    }
  }
  return out;
}

/* ---------------------- internal-link validation ------------------- */
/* Drop any [label](/tools/…|/wellness-hub/…) link whose slug doesn't resolve
 * in the DB (keep the visible text); collect resolved tool slugs so the article
 * is cross-linked back from those tool pages. Other site paths are left as-is. */

const LINK_RE = /\[([^\]]+)\]\((\/[^)\s]+)\)/g;

function cleanLinkText(text: string, toolSlugToId: Map<string, number | string>, articleSlugs: Set<string>, linkedTools: Set<string>): string {
  return text.replace(LINK_RE, (full, label: string, path: string) => {
    const tool = /^\/tools\/([a-z0-9-]+)\/?$/.exec(path);
    if (tool) {
      if (toolSlugToId.has(tool[1])) {
        linkedTools.add(tool[1]);
        return full;
      }
      return label; // unknown tool slug → unlink, keep text
    }
    const art = /^\/wellness-hub\/([a-z0-9-]+)\/?$/.exec(path);
    if (art) return articleSlugs.has(art[1]) ? full : label;
    return full; // other internal pages (/about, /methodology, …) left intact
  });
}

function cleanInternalLinks(
  body: GeneratedArticle['body'],
  toolSlugToId: Map<string, number | string>,
  articleSlugs: Set<string>,
  linkedTools: Set<string>,
): GeneratedArticle['body'] {
  return body.map((b) => {
    if ((b.type === 'paragraph' || b.type === 'disclaimer' || b.type === 'heading') && typeof b.text === 'string') {
      return { ...b, text: cleanLinkText(b.text, toolSlugToId, articleSlugs, linkedTools) };
    }
    if (b.type === 'list') {
      return { ...b, items: b.items.map((it) => cleanLinkText(it, toolSlugToId, articleSlugs, linkedTools)) };
    }
    if (b.type === 'table') {
      return { ...b, rows: b.rows.map((row) => row.map((cell) => cleanLinkText(cell, toolSlugToId, articleSlugs, linkedTools))) };
    }
    return b;
  });
}

/** Flatten saved Payload `layout` blocks to plain text (for claim extraction). */
function layoutToText(layout: unknown): string {
  if (!Array.isArray(layout)) return '';
  const parts: string[] = [];
  for (const b of layout as Record<string, unknown>[]) {
    if (typeof b?.text === 'string') parts.push(b.text);
    if (Array.isArray(b?.items)) parts.push((b.items as Record<string, unknown>[]).map((i) => str(i?.text)).join(' '));
    if (Array.isArray(b?.headers)) parts.push((b.headers as string[]).join(' '));
    if (Array.isArray(b?.rows)) parts.push((b.rows as Record<string, unknown>[]).map((r) => (Array.isArray(r?.cells) ? (r.cells as string[]).join(' ') : '')).join(' '));
    if (typeof b?.title === 'string') parts.push(b.title);
  }
  return parts.filter(Boolean).join('\n');
}

/* ----------------------------- prompts ----------------------------- */

const SYSTEM = `You are a senior health writer and editor for HealthyLifeStyles, writing for US/UK/CA/AU readers. You produce DRAFTS that a human editor reviews before publishing.

Return ONLY the requested structured fields as a single JSON object — no extra text, no preamble, no prose.

VOICE (write like an expert human, not AI):
- Lead with the answer. Use specific numbers, concrete examples, second person ("you"), and plain English. Vary sentence length. Include one genuine insight competitors miss.
- BANNED phrases — never use any of these: "In today's fast-paced world", "It's important to note", "When it comes to", "Look no further", "delve", "navigating", "tapestry", "testament to", "Whether you're...", "In conclusion". Do NOT open with an intro that restates the title.

SAFETY (mandatory, overrides everything):
- Educational only. NEVER diagnose or give medication/dosage advice. Do not invent statistics — if unsure of a number, state the established range and cite the source rather than guessing.
- Weight/diet topics: keep it body-positive and safe — no extreme-deficit or disordered-eating framing, no crash dieting, never endorse <~1200 kcal/day (women) / ~1500 (men) or >~1% body-weight loss per week; flag faster loss as something to discuss with a doctor.
- Mental-health topics: supportive and non-diagnostic; encourage professional support and include crisis resources for distress.
- Pregnancy/heart/disease-risk: point to ACOG/AHA/CDC/WHO and the reader's own clinician.
- Always frame tool results as estimates, not medical advice.
- Only use internal-link slugs that appear in the provided lists; never invent tools, slugs, URLs, or citations. American spelling.`;

interface ToolCtx {
  id: number | string;
  name: string;
  slug: string;
  category?: string;
  inputs: string[];
  formula: string[];
}

function buildUserPrompt(args: {
  title: string;
  tool: ToolCtx;
  categoryName: string;
  toolList: { slug: string; name: string }[];
  articleList: { slug: string; title: string }[];
}): string {
  const tools = args.toolList.map((t) => `- ${t.slug} — ${t.name}`).join('\n') || '(none)';
  const articles = args.articleList.map((a) => `- /wellness-hub/${a.slug} — ${a.title}`).join('\n') || '(none)';
  const whatItDoes = args.tool.formula.length ? `computes ${args.tool.formula.join('; ')}` : 'a health calculator';
  return `Write a Wellness Hub article for the tool below. Return ONLY the structured fields as a single JSON object — no extra text.

CONTEXT (use it):
- Article title / target keyword: ${args.title}
- Tool: ${args.tool.name} — ${whatItDoes} (slug: ${args.tool.slug})
- Inputs the user provides: ${args.tool.inputs.join(', ') || '(n/a)'}
- Category: ${args.categoryName}
- Tools you may internally link to (use exact slugs):
${tools}
- Published articles you may link to:
${articles}

REQUIREMENTS:
- h1 = the target keyword phrased naturally. snippetAnswer = a direct, complete 40–60 word answer.
- body: comprehensive, well-structured blocks; H2 headings phrased as real questions people search; include one table OR a short ordered list only where it genuinely helps; include a toolEmbed block for "${args.tool.slug}"; and insert 2–4 PRECISE contextual hyperlinks in the prose to the MOST relevant items above — written as [label](/tools/<exact-slug>) or [label](/wellness-hub/<exact-slug>) inside paragraph text, using EXACT slugs from the lists only. Never invent a URL or slug.
- faq: 4–6 genuinely useful Q/A. sources: 2–3 reputable (WHO/CDC/AHA/ACOG/NHS/peer-reviewed) with real, well-known URLs. semanticEntities: exactly 5 key terms with authoritative (.gov/.edu) references.
- End the body with a disclaimer block: educational, not medical advice.`;
}

/* --------------------------- context fetch ------------------------- */

async function loadContext(
  payload: PayloadRequest['payload'],
  opts: { toolId?: string; toolSlug?: string; categoryId?: string; categorySlug?: string },
): Promise<{ tool: ToolCtx; categoryName: string; toolList: { slug: string; name: string }[]; articleList: { slug: string; title: string }[]; toolSlugToId: Map<string, number | string> }> {
  // Resolve the primary tool by id or slug.
  let toolDoc: Record<string, unknown> | undefined;
  if (opts.toolId) {
    toolDoc = (await payload.findByID({ collection: 'tools', id: opts.toolId, depth: 1 }).catch(() => null)) as any;
  }
  if (!toolDoc && opts.toolSlug) {
    const r = await payload.find({ collection: 'tools', where: { slug: { equals: opts.toolSlug } }, limit: 1, depth: 1 });
    toolDoc = r.docs[0] as any;
  }
  if (!toolDoc) throw new AIError('invalid_output', 'Selected tool not found.', 400);

  // Resolve category name.
  let categoryName = '';
  const catRel = (toolDoc as any).category;
  if (opts.categoryId || opts.categorySlug) {
    const catDoc = opts.categoryId
      ? await payload.findByID({ collection: 'categories', id: opts.categoryId, depth: 0 }).catch(() => null)
      : (await payload.find({ collection: 'categories', where: { slug: { equals: opts.categorySlug } }, limit: 1, depth: 0 })).docs[0];
    categoryName = str((catDoc as any)?.name);
  }
  if (!categoryName && catRel && typeof catRel === 'object') categoryName = str((catRel as any).name);

  // Catalogue for internal linking.
  const [toolsRes, articlesRes] = await Promise.all([
    payload.find({ collection: 'tools', limit: 300, depth: 0, pagination: false }),
    payload.find({ collection: 'articles', where: { _status: { equals: 'published' } }, limit: 200, depth: 0, pagination: false }),
  ]);

  const toolList: { slug: string; name: string }[] = [];
  const toolSlugToId = new Map<string, number | string>();
  for (const t of toolsRes.docs as any[]) {
    const slug = str(t.slug);
    if (!slug) continue;
    toolList.push({ slug, name: str(t.name) });
    toolSlugToId.set(slug, t.id);
  }
  const articleList = (articlesRes.docs as any[])
    .map((a) => ({ slug: str(a.slug), title: str(a.title) }))
    .filter((a) => a.slug && a.title);

  const inputs = Array.isArray((toolDoc as any).inputs)
    ? (toolDoc as any).inputs.map((i: any) => str(i?.label)).filter(Boolean)
    : [];
  const formula = Array.isArray((toolDoc as any).outputs)
    ? (toolDoc as any).outputs.map((o: any) => `${str(o?.label) || str(o?.key)} = ${str(o?.expression)}`).filter((s: string) => s !== ' = ')
    : [];

  const tool: ToolCtx = {
    id: (toolDoc as any).id,
    name: str((toolDoc as any).name),
    slug: str((toolDoc as any).slug),
    category: categoryName,
    inputs,
    formula,
  };

  return { tool, categoryName, toolList, articleList, toolSlugToId };
}

/* ------------------------------ guards ----------------------------- */

function preflight(req: PayloadRequest): Response | null {
  if (!req.user) return Response.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
  if (!isEditor(req)) return Response.json({ success: false, error: 'Editors only.' }, { status: 403 });
  if (rateLimited(String(req.user.id))) {
    return Response.json({ success: false, error: 'Too many requests — wait a minute and retry.' }, { status: 429 });
  }
  return null;
}

function handleError(req: PayloadRequest, err: unknown): Response {
  if (err instanceof AIError) {
    req.payload?.logger?.warn(`[generate-article] ${err.code}: ${err.message}`);
    return Response.json({ success: false, error: err.message, code: err.code }, { status: err.status });
  }
  req.payload?.logger?.error(`[generate-article] ${(err as Error)?.message}`);
  return Response.json({ success: false, error: 'Unexpected error generating content.' }, { status: 500 });
}

/* --------------------------- the endpoints ------------------------- */

export const generateArticleEndpoint: Endpoint = {
  path: '/generate-article',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const blocked = preflight(req);
    if (blocked) return blocked;

    let body: any = {};
    try {
      body = req.json ? await req.json() : {};
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
    }

    const title = str(body.title);
    const docId = body.docId != null ? String(body.docId) : '';
    const mode: 'replace' | 'fillEmpty' = body.mode === 'replace' ? 'replace' : 'fillEmpty';
    if (!title) return Response.json({ success: false, error: 'A title is required.' }, { status: 400 });
    if (!docId) return Response.json({ success: false, error: 'Save the article as a draft first, then generate.' }, { status: 400 });
    if (!body.toolId && !body.toolSlug) return Response.json({ success: false, error: 'A tool is required.' }, { status: 400 });

    const payload = req.payload;

    try {
      const ctx = await loadContext(payload, {
        toolId: body.toolId != null ? String(body.toolId) : undefined,
        toolSlug: str(body.toolSlug) || undefined,
        categoryId: body.categoryId != null ? String(body.categoryId) : undefined,
        categorySlug: str(body.categorySlug) || undefined,
      });

      const article = await generateArticle({
        provider: coerceProvider(body.aiProvider),
        system: SYSTEM,
        prompt: buildUserPrompt({ title, tool: ctx.tool, categoryName: ctx.categoryName, toolList: ctx.toolList, articleList: ctx.articleList }),
      });

      // Validate internal links against the DB (drop unresolved, keep text) and
      // collect the tool slugs the body actually links to.
      const articleSlugs = new Set(ctx.articleList.map((a) => a.slug));
      const linkedTools = new Set<string>();
      const cleanedBody = cleanInternalLinks(article.body, ctx.toolSlugToId, articleSlugs, linkedTools);
      const layout = mapBody(cleanedBody, ctx.toolSlugToId);

      // relatedTools = AI suggestions + tools linked in the body + the primary
      // tool. The reverse lookup then lists this article on each of those tool
      // pages ("auto-add as related article on the linked tool pages").
      const relatedSlugs = new Set<string>([...article.relatedToolSlugs, ...linkedTools]);
      const relatedTools = [...relatedSlugs]
        .map((s) => ctx.toolSlugToId.get(s))
        .filter((v): v is number | string => v != null);
      if (ctx.tool.id != null && !relatedTools.includes(ctx.tool.id)) relatedTools.unshift(ctx.tool.id);

      // Current doc → merge target (never silently overwrite human edits).
      const current = (await payload.findByID({ collection: 'articles', id: docId, depth: 0, draft: true }).catch(() => null)) as any;
      const keepIfFilling = (field: string, next: unknown): boolean =>
        mode === 'replace' || isEmpty(current?.[field]);

      const data: Record<string, unknown> = {
        aiGenerated: true,
        reviewedByHuman: false,
        aiImagePrompt: article.suggestedImagePrompt,
      };

      // seo group — merge sub-fields so we don't drop other seo keys.
      const seo = { ...(current?.seo || {}) } as Record<string, unknown>;
      if (mode === 'replace' || isEmpty(seo.metaTitle)) seo.metaTitle = article.metaTitle;
      if (mode === 'replace' || isEmpty(seo.metaDescription)) seo.metaDescription = article.metaDescription;
      data.seo = seo;

      if (keepIfFilling('slug', article.slug)) data.slug = article.slug;
      if (keepIfFilling('excerpt', article.snippetAnswer)) data.excerpt = article.snippetAnswer;
      if (keepIfFilling('layout', layout)) {
        data.layout = layout;
        // Advanced-schema flags follow the (re)generated body so new AI drafts are
        // flagged at creation. The Astro frontend reads these booleans directly
        // (Phase 9 — no render-time heuristics), so setting them here keeps the
        // content pipeline fully hands-off.
        const flagTitle = str((mode === 'replace' ? article.h1 : current?.title) || article.h1);
        data.isHowTo = computeIsHowTo(flagTitle, layout);
        data.isHealthTopic = computeIsHealthTopic(flagTitle, article.semanticEntities);
      }
      if (keepIfFilling('faq', article.faq)) data.faq = article.faq;
      if (keepIfFilling('sources', article.sources)) data.sources = article.sources;
      if (keepIfFilling('semanticEntities', article.semanticEntities)) data.semanticEntities = article.semanticEntities;
      if (keepIfFilling('relatedTools', relatedTools)) data.relatedTools = relatedTools;
      // Title: only set the H1 on replace (the human chose the topic title).
      if (mode === 'replace') data.title = article.h1;
      else if (isEmpty(current?.title)) data.title = article.h1;

      // Optional hero image (opt-in). Never overwrites a human-picked hero, and
      // never fails the draft — a missing key or failed render just returns a note.
      const wantImage = body.generateImage === true;
      const willSetHero = wantImage && (mode === 'replace' || isEmpty(current?.heroImage));
      const image: { generated: boolean; mediaId?: string | number; error?: string } = { generated: false };
      if (wantImage && !willSetHero) {
        image.error = 'Skipped: a hero image is already set (use Replace mode to overwrite).';
      } else if (willSetHero && !isImageConfigured()) {
        image.error = 'Image provider not configured (set OPENAI_API_KEY or FAL_KEY).';
      } else if (willSetHero) {
        try {
          const img = await generateHeroImage(article.suggestedImagePrompt);
          const alt = (article.suggestedImagePrompt || article.h1 || 'Wellness illustration').trim().slice(0, 125);
          const base = (article.slug || 'article').replace(/[^a-z0-9-]/gi, '-').slice(0, 60) || 'article';
          const media = await payload.create({
            collection: 'media',
            data: { alt, credit: 'AI-generated illustration' },
            file: { data: img.data, mimetype: img.contentType, name: `${base}-hero.${img.ext}`, size: img.data.length },
          });
          data.heroImage = media.id;
          image.generated = true;
          image.mediaId = media.id;
        } catch (imgErr) {
          image.error = imgErr instanceof AIError ? imgErr.message : `Image generation failed: ${(imgErr as Error)?.message ?? 'unknown'}`;
          req.payload?.logger?.warn(`[generate-article] hero image: ${image.error}`);
        }
      }

      await payload.update({ collection: 'articles', id: docId, data, draft: true });

      return Response.json({ success: true, mode, article, image, message: 'AI draft generated. Review before publishing.' });
    } catch (err) {
      return handleError(req, err);
    }
  },
};

export const regenerateSectionEndpoint: Endpoint = {
  path: '/regenerate-section',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const blocked = preflight(req);
    if (blocked) return blocked;

    let body: any = {};
    try {
      body = req.json ? await req.json() : {};
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
    }

    const section = body.section as RegenSection;
    const title = str(body.title);
    if (!REGEN_SECTIONS.includes(section)) {
      return Response.json({ success: false, error: `section must be one of: ${REGEN_SECTIONS.join(', ')}.` }, { status: 400 });
    }
    if (!title || (!body.toolId && !body.toolSlug)) {
      return Response.json({ success: false, error: 'title and a tool are required.' }, { status: 400 });
    }

    try {
      const ctx = await loadContext(req.payload, {
        toolId: body.toolId != null ? String(body.toolId) : undefined,
        toolSlug: str(body.toolSlug) || undefined,
        categoryId: body.categoryId != null ? String(body.categoryId) : undefined,
        categorySlug: str(body.categorySlug) || undefined,
      });

      const prompt = `${buildUserPrompt({ title, tool: ctx.tool, categoryName: ctx.categoryName, toolList: ctx.toolList, articleList: ctx.articleList })}

Regenerate ONLY the "${section}" section. ${str(body.instruction) ? `Editor note: ${str(body.instruction)}` : ''} Return only the JSON for that section.`;

      const result = await regenerateSection({ provider: coerceProvider(body.aiProvider), section, system: SYSTEM, prompt });

      // When editing a saved draft, apply the regenerated section server-side
      // (reliable for arrays/blocks) and flag it for re-review.
      const docId = body.docId != null ? String(body.docId) : '';
      if (docId) {
        const current = (await req.payload.findByID({ collection: 'articles', id: docId, depth: 0, draft: true }).catch(() => null)) as any;
        const data: Record<string, unknown> = { aiGenerated: true, reviewedByHuman: false };
        const r = result as Record<string, unknown>;
        if (section === 'snippet' && typeof r.snippetAnswer === 'string') data.excerpt = r.snippetAnswer;
        if (section === 'meta') data.seo = { ...(current?.seo || {}), metaTitle: r.metaTitle, metaDescription: r.metaDescription };
        if (section === 'faq' && Array.isArray(r.faq)) data.faq = r.faq;
        if (section === 'intro' && Array.isArray(r.body)) data.layout = mapBody(r.body as GeneratedArticle['body'], ctx.toolSlugToId);
        await req.payload.update({ collection: 'articles', id: docId, data, draft: true });
      }

      return Response.json({ success: true, section, result, applied: Boolean(docId) });
    } catch (err) {
      return handleError(req, err);
    }
  },
};

/* ------------------- "Generate from tool": titles ------------------ */

export const suggestTitlesEndpoint: Endpoint = {
  path: '/suggest-titles',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const blocked = preflight(req);
    if (blocked) return blocked;

    let body: any = {};
    try {
      body = req.json ? await req.json() : {};
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
    }
    if (!body.toolId && !body.toolSlug) {
      return Response.json({ success: false, error: 'A tool is required.' }, { status: 400 });
    }

    try {
      const ctx = await loadContext(req.payload, {
        toolId: body.toolId != null ? String(body.toolId) : undefined,
        toolSlug: str(body.toolSlug) || undefined,
        categoryId: body.categoryId != null ? String(body.categoryId) : undefined,
        categorySlug: str(body.categorySlug) || undefined,
      });

      const existing = ctx.articleList.map((a) => `- ${a.title}`).join('\n') || '(none)';
      const whatItDoes = ctx.tool.formula.length ? `computes ${ctx.tool.formula.join('; ')}` : 'a health calculator';
      const prompt = `Suggest exactly 5 Wellness Hub article titles for the tool below, each targeting a DIFFERENT search intent (e.g. core informational, how-to, comparison, common mistakes, beginner/getting-started). Make them specific and natural — not clickbait, no medical claims, no banned phrases. Avoid duplicating the angles of existing articles.

Tool: ${ctx.tool.name} (slug: ${ctx.tool.slug}) — ${whatItDoes}
Category: ${ctx.categoryName}
Existing articles (avoid these angles):
${existing}

Return only the JSON object of 5 titles.`;

      const { titles } = await suggestTitles({ provider: coerceProvider(body.aiProvider), system: SYSTEM, prompt });
      return Response.json({ success: true, titles });
    } catch (err) {
      return handleError(req, err);
    }
  },
};

/* ---------------- "Find & verify sources" (assistive) -------------- */
/* Surfaces suggested authority sources for the draft's key claims. It ASSISTS a
 * human reviewer: it does NOT certify accuracy, never auto-publishes, and never
 * edits medical numbers or writes to the article. A qualified human signs off. */

export const verifySourcesEndpoint: Endpoint = {
  path: '/verify-sources',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const blocked = preflight(req);
    if (blocked) return blocked;

    let body: any = {};
    try {
      body = req.json ? await req.json() : {};
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
    }
    const docId = body.docId != null ? String(body.docId) : '';
    if (!docId) return Response.json({ success: false, error: 'Save the draft first.' }, { status: 400 });

    try {
      const doc = (await req.payload.findByID({ collection: 'articles', id: docId, depth: 0, draft: true }).catch(() => null)) as any;
      if (!doc) return Response.json({ success: false, error: 'Article not found.' }, { status: 404 });

      const faqText = Array.isArray(doc.faq) ? doc.faq.map((f: any) => `${str(f?.question)} ${str(f?.answer)}`).join(' ') : '';
      const text = [str(doc.title), str(doc.excerpt), layoutToText(doc.layout), faqText].filter(Boolean).join('\n\n').slice(0, 12000);
      if (!text.trim()) {
        return Response.json({ success: false, error: 'Nothing to verify yet — generate or write the draft first.' }, { status: 400 });
      }

      const { claims } = await extractClaims({
        provider: coerceProvider(body.aiProvider),
        system: SYSTEM,
        prompt: `From the DRAFT health article below, list the key factual claims and specific numbers a careful editor should verify against a health authority (prefer concrete numbers, thresholds, and physiological/medical statements). For each, give a concise verification search query.\n\nDRAFT:\n${text}`,
      });

      const searchOn = isSearchConfigured();
      const checked: { claim: string; query: string; suggestedSources: SearchResult[]; matched: boolean; check: boolean }[] = [];
      for (const c of claims) {
        let sources: SearchResult[] = [];
        if (searchOn) {
          try {
            sources = await searchReputable(c.query);
          } catch {
            sources = [];
          }
        }
        checked.push({ claim: c.claim, query: c.query, suggestedSources: sources, matched: sources.length > 0, check: sources.length === 0 });
      }

      return Response.json({
        success: true,
        searchConfigured: searchOn,
        disclaimer:
          'These are SUGGESTIONS to assist human review — NOT a certification of medical accuracy. Nothing is auto-applied. A qualified reviewer must verify every claim and number and sign off before publishing.',
        claims: checked,
      });
    } catch (err) {
      return handleError(req, err);
    }
  },
};
