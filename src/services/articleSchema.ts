import { z } from 'zod';

/**
 * Strict contract for AI-generated articles.
 *
 * Two representations, kept in lock-step:
 *  - `articleSchema` (Zod) — validates the model's JSON on the server. The
 *    source of truth; if the model output fails this, we ask it to fix once.
 *  - `ARTICLE_TOOL_SCHEMA` (JSON Schema) — handed to Claude as a tool
 *    `input_schema` so the model is forced to emit matching structured JSON
 *    (we never parse free text). Hand-written to mirror the Zod shape.
 */

/* ----------------------------- helpers ----------------------------- */

const httpUrl = z
  .string()
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'Must be a valid http(s) URL');

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* ------------------------------ blocks ----------------------------- */

export const bodyBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), level: z.union([z.literal(2), z.literal(3)]), text: z.string().min(1) }),
  z.object({ type: z.literal('paragraph'), text: z.string().min(1) }),
  z.object({ type: z.literal('list'), ordered: z.boolean(), items: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('table'), headers: z.array(z.string()).min(1), rows: z.array(z.array(z.string())).min(1) }),
  z.object({ type: z.literal('toolEmbed'), toolSlug: z.string().min(1) }),
  z.object({ type: z.literal('disclaimer'), text: z.string().min(1) }),
]);

export type BodyBlock = z.infer<typeof bodyBlockSchema>;

/* --------------------------- full article -------------------------- */

export const articleSchema = z.object({
  metaTitle: z.string().min(1).max(60),
  metaDescription: z.string().min(1).max(155),
  slug: z.string().regex(SLUG_RE, 'Must be a lowercase kebab-case slug'),
  h1: z.string().min(1),
  // Spec asks for 40–60 words; allow a small tolerance so we don't trigger the
  // repair loop on an otherwise-good answer that lands a word or two outside.
  snippetAnswer: z.string().refine((s) => {
    const w = wordCount(s);
    return w >= 35 && w <= 70;
  }, 'snippetAnswer should be roughly 40–60 words'),
  body: z.array(bodyBlockSchema).min(1),
  faq: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).min(4).max(6),
  sources: z.array(z.object({ label: z.string().min(1), url: httpUrl })).min(2).max(3),
  semanticEntities: z.array(z.object({ term: z.string().min(1), url: httpUrl })).length(5),
  relatedToolSlugs: z.array(z.string()),
  suggestedImagePrompt: z.string().min(1),
});

export type GeneratedArticle = z.infer<typeof articleSchema>;

/* --------------------- single-section regenerate ------------------- */

export const REGEN_SECTIONS = ['snippet', 'meta', 'faq', 'intro'] as const;
export type RegenSection = (typeof REGEN_SECTIONS)[number];

export const sectionSchemas = {
  snippet: z.object({ snippetAnswer: articleSchema.shape.snippetAnswer }),
  meta: z.object({ metaTitle: articleSchema.shape.metaTitle, metaDescription: articleSchema.shape.metaDescription }),
  faq: z.object({ faq: articleSchema.shape.faq }),
  intro: z.object({ body: z.array(bodyBlockSchema).min(1).max(4) }),
} satisfies Record<RegenSection, z.ZodTypeAny>;

export type SectionResult<S extends RegenSection> = z.infer<(typeof sectionSchemas)[S]>;

/* ----------- JSON Schema handed to Claude as a tool ---------------- */
/* Mirrors the Zod shape. Anthropic uses this as `input_schema` and is forced
 * (via tool_choice) to return JSON matching it. Zod still validates strictly. */

export const ARTICLE_TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    metaTitle: { type: 'string', maxLength: 60, description: 'SEO title, ≤60 chars, includes the primary keyword.' },
    metaDescription: { type: 'string', maxLength: 155, description: 'SEO meta description, ≤155 chars.' },
    slug: { type: 'string', description: 'Lowercase kebab-case URL slug, e.g. "how-to-calculate-bmi".' },
    h1: { type: 'string', description: 'The on-page H1 (human title).' },
    snippetAnswer: { type: 'string', description: 'A direct, 40–60 word answer to the page\'s core question (for featured snippets).' },
    body: {
      type: 'array',
      minItems: 1,
      description: 'Ordered content blocks. Each block MUST set "type" and only the fields for that type.',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['heading', 'paragraph', 'list', 'table', 'toolEmbed', 'disclaimer'] },
          level: { type: 'integer', enum: [2, 3], description: 'For heading: 2 or 3.' },
          text: { type: 'string', description: 'For heading/paragraph/disclaimer.' },
          ordered: { type: 'boolean', description: 'For list: true=numbered, false=bulleted.' },
          items: { type: 'array', items: { type: 'string' }, description: 'For list: the line items.' },
          headers: { type: 'array', items: { type: 'string' }, description: 'For table: column headers.' },
          rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'For table: rows of cells.' },
          toolSlug: { type: 'string', description: 'For toolEmbed: the slug of a tool to embed inline.' },
        },
        required: ['type'],
      },
    },
    faq: {
      type: 'array',
      minItems: 4,
      maxItems: 6,
      items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] },
    },
    sources: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      description: 'Reputable references (WHO/CDC/AHA/NIH/peer-reviewed). Real URLs only.',
      items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } }, required: ['label', 'url'] },
    },
    semanticEntities: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      description: 'Exactly 5 medical/physiological entities with authoritative URLs (prefer .gov/.edu/peer-reviewed).',
      items: { type: 'object', properties: { term: { type: 'string' }, url: { type: 'string' } }, required: ['term', 'url'] },
    },
    relatedToolSlugs: { type: 'array', items: { type: 'string' }, description: 'Slugs of related tools to cross-link (from the provided list only).' },
    suggestedImagePrompt: { type: 'string', description: 'A vivid prompt for a hero image generator.' },
  },
  required: [
    'metaTitle', 'metaDescription', 'slug', 'h1', 'snippetAnswer', 'body',
    'faq', 'sources', 'semanticEntities', 'relatedToolSlugs', 'suggestedImagePrompt',
  ],
} as const;

/* --------------------- "Generate from tool": titles --------------- */

export const titlesSchema = z.object({
  titles: z.array(z.object({ title: z.string().min(1), intent: z.string().min(1) })).length(5),
});
export type SuggestedTitles = z.infer<typeof titlesSchema>;

export const TITLES_TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    titles: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A natural, click-worthy article title for this tool.' },
          intent: { type: 'string', description: 'The distinct search intent it targets (e.g. informational / how-to / comparison / mistakes / beginner).' },
        },
        required: ['title', 'intent'],
      },
    },
  },
  required: ['titles'],
} as const;

/* ----------------- "Find & verify sources": claims --------------- */

export const claimsSchema = z.object({
  claims: z.array(z.object({ claim: z.string().min(1), query: z.string().min(1) })).min(1).max(8),
});
export type ExtractedClaims = z.infer<typeof claimsSchema>;

export const CLAIMS_TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    claims: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      description: 'The key checkable factual claims and specific numbers stated in the article.',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string', description: 'A specific factual claim or number from the article that a reader would expect to be sourced.' },
          query: { type: 'string', description: 'A concise web-search query to verify it against a health authority (WHO/CDC/AHA/ACOG/NHS/NIH).' },
        },
        required: ['claim', 'query'],
      },
    },
  },
  required: ['claims'],
} as const;
