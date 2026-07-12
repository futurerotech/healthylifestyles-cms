import type { CollectionConfig, SelectField } from 'payload';
import { isAdminOrEditor, publishedPublicRead } from '../access/roles';
import { slugField } from '../fields/slug';
import { seoField } from '../fields/seo';
import { pageBlocks } from '../blocks';
import { afterChangeIndexingHook } from '../lib/indexing';
import { afterPublishPushHook } from '../lib/push';
import { trackPendingChange } from '../hooks/trackPendingChange';
import { notifyIndexNow } from '../hooks/notifyIndexNow';

/** Which AI model generates this article (read per-request by the generator). */
const aiProviderField: SelectField = {
  name: 'aiProvider',
  type: 'select',
  defaultValue: 'gemini',
  required: false,
  admin: {
    position: 'sidebar',
    description: 'Which AI model drafts this article. Falls back to Gemini if unset.',
  },
  options: [
    { label: 'Google Gemini (Free)', value: 'gemini' },
    { label: 'NaraRouter (7M Free)', value: 'nararouter' },
    { label: 'Mimo v2.5 Free', value: 'mimo-v2.5-free' },
    { label: 'Mimo v2.5 Pro Free', value: 'mimo-v2.5-pro-free' },
    { label: 'Mistral Large', value: 'mistral-large' },
    { label: 'Mistral Medium 3.5', value: 'mistral-medium-3-5' },
    { label: 'DeepSeek Chat', value: 'deepseek' },
    { label: 'Z.ai (GLM-5.2)', value: 'zai' },
    { label: 'Local AI (Gemma 31B)', value: 'local' },
    { label: 'Anthropic Claude', value: 'anthropic' },
  ],
};

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', '_status', 'featured', 'category', 'author', 'updatedAt'],
    listSearchableFields: ['title', 'excerpt'],
    preview: (doc) => (doc?.slug ? `${process.env.SITE_BASE_URL || 'https://www.healthylifesstyles.com'}/wellness-hub/${doc.slug}` : null),
  },
  access: { read: publishedPublicRead, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdminOrEditor },
  versions: { drafts: { autosave: { interval: 800 }, schedulePublish: true }, maxPerDoc: 50 },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'aiDraftBanner',
              type: 'ui',
              admin: { components: { Field: '@/components/admin/AiDraftBanner#AiDraftBanner' } },
            },
            { name: 'title', type: 'text', required: true, localized: true },
            { name: 'excerpt', type: 'textarea', localized: true, admin: { description: 'Short summary for cards and the article lead.' } },
            {
              name: 'heroImage', type: 'upload', relationTo: 'media',
              admin: { description: 'Featured image. Must be ≥1200px wide (Google Discover large-image requirement).' },
              // P16-H — Discover eligibility gate at the source: block heroes
              // provably narrower than 1200px. Unverifiable dimensions (missing
              // width, transient lookup failure) never block a save (SD5).
              validate: async (value: unknown, { req }: { req: { payload?: { findByID: (a: { collection: 'media'; id: number | string; depth?: number }) => Promise<{ width?: number | null }> } } }) => {
                if (value == null) return true;
                const id = typeof value === 'object' && value !== null ? (value as { id?: number | string }).id : (value as number | string);
                if (id == null || !req?.payload) return true;
                try {
                  const media = await req.payload.findByID({ collection: 'media', id, depth: 0 });
                  if (typeof media?.width === 'number' && media.width < 1200) {
                    return `Hero image is ${media.width}px wide — Google Discover needs ≥1200px. Upload a larger image.`;
                  }
                } catch {
                  /* lookup failure must never block editorial saves */
                }
                return true;
              },
            },
            {
              name: 'layout',
              type: 'blocks',
              blocks: pageBlocks,
              localized: true,
              admin: { description: 'Build the page with modular blocks.' },
            },
            {
              name: 'faq', type: 'array', labels: { singular: 'FAQ', plural: 'FAQs' }, localized: true,
              admin: { description: 'Legacy FAQ field. The PUBLISHED FAQ (and its FAQPage schema) comes from the "People also ask" content block, not this field.' },
              fields: [
                { name: 'question', type: 'text', required: true },
                { name: 'answer', type: 'textarea', required: true },
              ],
            },
            {
              // P15-P7c — the exact shape AI Overviews/Perplexity quote and cite.
              name: 'takeaways', type: 'array', labels: { singular: 'Key takeaway', plural: 'Key takeaways' }, localized: true,
              admin: { description: 'EXACTLY 3 editorial takeaways (≈40–60 words total). Server-rendered as the "Key takeaways" box near the top and referenced by speakable schema. Leave empty to omit the box.' },
              validate: (value: unknown) => {
                if (Array.isArray(value) && value.length > 0 && value.length !== 3) {
                  return 'Key takeaways must be exactly 3 items (or none to omit the box).';
                }
                return true;
              },
              fields: [{ name: 'text', type: 'text', required: true }],
            },
            {
              name: 'sources', type: 'array', labels: { singular: 'Source', plural: 'Sources' },
              admin: { description: '2–3 reputable references.' },
              fields: [
                { type: 'row', fields: [
                  { name: 'label', type: 'text', required: true, admin: { width: '60%' } },
                  { name: 'url', type: 'text', admin: { width: '40%' } },
                ] },
              ],
            },
            { name: 'relatedTools', type: 'relationship', relationTo: 'tools', hasMany: true, admin: { description: '2–3 tools to cross-link.' } },
          ],
        },
        {
          label: 'SEO',
          fields: [
            seoField,
            {
              name: 'semanticEntities',
              type: 'array',
              labels: { singular: 'Entity', plural: 'Semantic SEO Entities' },
              admin: {
                description:
                  'Deep, machine-readable medical/physiological entities (e.g. "insulin resistance", "basal metabolic rate equation"). Emitted into the article JSON-LD `about` + keywords for Google E-E-A-T and AI citation.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'term', type: 'text', required: true, admin: { width: '60%' } },
                    { name: 'url', type: 'text', admin: { width: '40%', description: 'Optional authoritative URL (NIH / MeSH / Wikipedia) used as sameAs.' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Schema',
          fields: [
            {
              name: 'schemaGenerator',
              type: 'ui',
              admin: { components: { Field: '@/components/admin/SchemaGenerator#SchemaGenerator' } },
            },
          ],
        },
        {
          label: 'AI Writing Assistant',
          fields: [
            {
              name: 'aiWritingAssistant',
              type: 'ui',
              admin: { components: { Field: '@/components/admin/AiWritingAssistant#AiWritingAssistant' } },
            },
          ],
        },
      ],
    },
    aiProviderField,
    {
      name: 'autoGenerate',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '@/components/admin/AutoGenerateButton#AutoGenerateButton' } },
    },
    {
      name: 'aiGenerated',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', readOnly: true, description: 'Set automatically when AI drafts this article.' },
    },
    {
      name: 'reviewedByHuman',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Tick once a human has reviewed the AI draft — hides the “AI draft” banner.' },
    },
    {
      name: 'aiImagePrompt',
      type: 'textarea',
      admin: { position: 'sidebar', readOnly: true, description: 'Suggested hero-image prompt from the last AI generation.' },
    },
    slugField('title'),
    { name: 'category', type: 'relationship', relationTo: 'categories', admin: { position: 'sidebar' } },
    { name: 'author', type: 'relationship', relationTo: 'authors', admin: { position: 'sidebar', description: 'Written by.' } },
    { name: 'reviewer', type: 'relationship', relationTo: 'authors', admin: { position: 'sidebar', description: 'Medically reviewed by.' } },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true, admin: { position: 'sidebar' } },
    { name: 'publishDate', type: 'date', admin: { position: 'sidebar', description: 'Used for ordering and scheduling.' } },
    { name: 'updatedDate', type: 'date', admin: { position: 'sidebar', description: 'Last substantive update for YMYL freshness signals.' } },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Show as the featured/hero article on the Wellness Hub.' } },
    {
      name: 'isHowTo',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Emit HowTo (step-by-step) structured data. Explicit replacement for title heuristics — tick for how-to guides.' },
    },
    {
      name: 'isHealthTopic',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Emit HealthTopicContent (MedicalCondition) structured data. Explicit replacement for title heuristics — tick for "what is / signs / symptoms" explainers.' },
    },
    {
      // P15-P7a — the ONLY switch for FAQPage emission (SD4: boolean-flag-driven
      // schema, never title/content heuristics). Validated against the VISIBLE
      // source: FAQPage JSON-LD is built from the "People also ask" block, so
      // this flag may only be enabled when such a block actually has Q&A items.
      name: 'hasFAQ',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Emit FAQPage schema from the article\'s "People also ask" block. The frontend never infers FAQs — this flag is the single source of truth.' },
      validate: (value: unknown, { data }: { data?: { layout?: { blockType?: string; items?: unknown[] }[] } }) => {
        if (!value) return true;
        const paa = (data?.layout || []).find((b) => b?.blockType === 'peopleAlsoAsk');
        const hasItems = !!paa && Array.isArray(paa.items) && paa.items.length > 0;
        return hasItems
          ? true
          : 'Enable FAQ only when the article has a "People also ask" block with at least one question — that block is the visible content the FAQPage schema is built from.';
      },
    },
    {
      // Phase 10 — live "what will this article emit" panel under the two flags.
      name: 'schemaEmissionHint',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '@/components/admin/SchemaEmissionHint#SchemaEmissionHint' } },
    },
    { name: 'primaryTool', type: 'relationship', relationTo: 'tools', admin: { position: 'sidebar', description: 'The primary tool to embed inline within the article.' } },
    { name: 'relatedArticles', type: 'relationship', relationTo: 'articles', hasMany: true, admin: { position: 'sidebar', description: 'Explicitly link related articles (auto-fallback to same-category when empty).' } },
    { name: 'requestIndexing', type: 'ui', admin: { position: 'sidebar', components: { Field: '@/components/admin/RequestIndexing#RequestIndexing' } } },
    { name: 'sendPushButton', type: 'ui', admin: { position: 'sidebar', components: { Field: '@/components/admin/SendPushButton#SendPushButton' } } },
  ],
  hooks: {
    afterChange: [afterChangeIndexingHook, afterPublishPushHook, trackPendingChange, notifyIndexNow],
  },
};
