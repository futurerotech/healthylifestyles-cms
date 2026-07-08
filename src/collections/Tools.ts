import type { CollectionConfig } from 'payload';
import { isAdminOrEditor, publishedPublicRead } from '../access/roles';
import { slugField } from '../fields/slug';
import { seoField } from '../fields/seo';
import { validateFormula } from '../lib/formula';
import { afterChangeIndexingHook } from '../lib/indexing';
import { trackPendingChange } from '../hooks/trackPendingChange';
/** Lucide icon names used by the public tiles — a select "picker" for editors. */
const ICON_OPTIONS = [
  'flame', 'pie-chart', 'egg', 'wheat', 'droplet', 'scale', 'percent', 'target',
  'dumbbell', 'ruler', 'person-standing', 'trending-down', 'trending-up', 'weight',
  'calendar-clock', 'calendar-days', 'calendar-heart', 'baby', 'heart', 'heart-pulse',
  'activity', 'gauge', 'moon', 'moon-star', 'bed', 'alarm-clock', 'clock', 'coffee',
  'wine', 'beer', 'hourglass', 'utensils', 'beef', 'cookie', 'footprints', 'timer',
  'wind', 'armchair', 'cigarette', 'battery-low', 'flask',
].map((v) => ({ label: v, value: v }));

const GRADIENT_OPTIONS = [
  'orange', 'amber', 'cyan', 'blue', 'purple', 'indigo', 'red', 'pink', 'green', 'teal', 'brown', 'sky',
].map((v) => ({ label: v[0].toUpperCase() + v.slice(1), value: v }));

/**
 * THE CORE: every calculator is a data record. Formula tools are rendered by a
 * single generic engine (see src/lib/calculate.ts) — no per-tool code. Complex
 * tools that can't be a formula set `toolType: coded` and name a registered
 * component; the admin still owns their metadata, SEO, content and enable/disable.
 */
export const Tools: CollectionConfig = {
  slug: 'tools',
  admin: {
    useAsTitle: 'name',
    group: 'Content',
    defaultColumns: ['name', 'category', 'enabled', 'featured', 'updatedAt'],
    listSearchableFields: ['name', 'slug'],
    description: 'Create and edit calculators with no code. Formula tools use safe math expressions.',
    preview: (doc) => (doc?.slug ? `https://www.healthylifesstyles.com/tools/${doc.slug}` : null),
  },
  // Anonymous readers only see PUBLISHED tools (all 70 existing tools were
  // bulk-published 2026-07-06); future draft tools stay hidden until published.
  access: { read: publishedPublicRead, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdminOrEditor },
  versions: { drafts: { autosave: { interval: 800 } }, maxPerDoc: 50 },

  hooks: {
    afterChange: [afterChangeIndexingHook, trackPendingChange],
    beforeValidate: [
      ({ data }) => {
        // Enforce safe, valid formulas at save time for formula tools.
        if (data?.toolType !== 'coded' && Array.isArray(data?.outputs)) {
          for (const o of data.outputs) {
            if (!o?.expression) continue;
            const r = validateFormula(o.expression);
            if (!r.ok) throw new Error(`Output "${o.key || o.label || '?'}": ${r.error}`);
          }
        }

        // YMYL safety gate. High risk ALWAYS requires medical review, and a
        // review-required tool cannot go live (enabled + published) until a
        // human ticks "Medically reviewed". Save it as draft/disabled instead —
        // the review flag is a human attestation, never set automatically.
        if (data) {
          if (data.riskLevel === 'high') data.medicalReviewRequired = true;
          const goingLive = data.enabled === true && data._status !== 'draft';
          if (data.medicalReviewRequired && !data.medicallyReviewed && goingLive) {
            throw new Error(
              'This tool requires medical review before it can be enabled and published. ' +
                'Save it as a draft (or untick "Enabled") until a qualified reviewer has checked it, ' +
                'then tick "Medically reviewed".',
            );
          }
        }
        return data;
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Basics',
          fields: [
            { name: 'name', type: 'text', required: true },
            {
              type: 'row',
              fields: [
                { name: 'category', type: 'relationship', relationTo: 'categories', required: true, admin: { width: '50%' } },
                {
                  name: 'toolType', type: 'select', defaultValue: 'formula', required: true, admin: { width: '50%' },
                  options: [
                    { label: 'Formula (no code)', value: 'formula' },
                    { label: 'Coded component', value: 'coded' },
                  ],
                },
              ],
            },
            {
              name: 'codedComponent', type: 'text',
              admin: { condition: (data) => data?.toolType === 'coded', description: 'Registered component key (e.g. "BreathingTimer", "MealGenerator").' },
            },
            {
              type: 'row',
              fields: [
                { name: 'icon', type: 'select', options: ICON_OPTIONS, admin: { width: '50%', description: 'Lucide icon for the gradient tile.' } },
                { name: 'gradient', type: 'select', defaultValue: 'blue', options: GRADIENT_OPTIONS, admin: { width: '50%', description: 'Gradient tile color family.' } },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'accentColor', type: 'text', admin: { width: '50%', description: 'Hex, e.g. #16a34a.' } },
                { name: 'minutesBadge', type: 'text', admin: { width: '50%', description: 'e.g. "Under 1 min".' } },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'enabled', type: 'checkbox', defaultValue: true,
                  admin: {
                    width: '50%',
                    description: 'On = live. Off = "Coming soon" (hidden from the public site).',
                    components: { Cell: '@/components/admin/StatusCell#StatusCell' },
                  },
                },
                { name: 'featured', type: 'checkbox', defaultValue: false, admin: { width: '50%', description: 'Feature on the homepage / hubs.' } },
              ],
            },
          ],
        },
        {
          label: 'Calculator',
          description: 'Inputs the user fills in, and the formula(s) that produce the result. Formulas are validated for safety on save.',
          fields: [
            {
              name: 'inputs', type: 'array', labels: { singular: 'Input', plural: 'Inputs' },
              admin: { initCollapsed: true },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'label', type: 'text', required: true, admin: { width: '50%' } },
                    { name: 'key', type: 'text', required: true, admin: { width: '50%', description: 'Variable name used in formulas (letters/numbers, no spaces).' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'type', type: 'select', defaultValue: 'number', admin: { width: '50%' },
                      options: [
                        { label: 'Number', value: 'number' },
                        { label: 'Select (dropdown)', value: 'select' },
                        { label: 'Radio', value: 'radio' },
                        { label: 'Toggle (on/off)', value: 'toggle' },
                      ],
                    },
                    { name: 'required', type: 'checkbox', defaultValue: true, admin: { width: '50%' } },
                  ],
                },
                {
                  name: 'unit', type: 'group', admin: { description: 'Optional metric/imperial unit pair (number inputs).' },
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'metricLabel', type: 'text', admin: { width: '50%', description: 'e.g. kg, cm' } },
                        { name: 'imperialLabel', type: 'text', admin: { width: '50%', description: 'e.g. lb, in' } },
                      ],
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'min', type: 'number', admin: { width: '25%' } },
                    { name: 'max', type: 'number', admin: { width: '25%' } },
                    { name: 'step', type: 'number', admin: { width: '25%' } },
                    { name: 'defaultValue', type: 'number', admin: { width: '25%' } },
                  ],
                },
                { name: 'help', type: 'text', admin: { description: 'Helper text shown under the field.' } },
                {
                  name: 'options', type: 'array', labels: { singular: 'Option', plural: 'Options' },
                  admin: { condition: (_, sib) => sib?.type === 'select' || sib?.type === 'radio' },
                  fields: [
                    { type: 'row', fields: [
                      { name: 'label', type: 'text', admin: { width: '50%' } },
                      { name: 'value', type: 'text', admin: { width: '50%', description: 'Numeric value used in formulas.' } },
                    ] },
                  ],
                },
              ],
            },
            {
              name: 'outputs', type: 'array', labels: { singular: 'Output', plural: 'Outputs' },
              minRows: 1,
              admin: {
                condition: (data) => data?.toolType !== 'coded',
                initCollapsed: false,
                description: 'Each output is a safe math expression (e.g. weight / (height/100)^2). Use a ? b : c for conditions; later outputs can reference earlier output keys.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'key', type: 'text', required: true, admin: { width: '50%', description: 'Output variable name.' } },
                    { name: 'label', type: 'text', required: true, admin: { width: '50%' } },
                  ],
                },
                { name: 'expression', type: 'textarea', required: true, admin: { description: 'Safe math over the input variables. No JavaScript — arithmetic & math functions only.' } },
                {
                  type: 'row',
                  fields: [
                    { name: 'unit', type: 'text', admin: { width: '50%', description: 'e.g. kg, %, bpm' } },
                    { name: 'decimals', type: 'number', defaultValue: 1, admin: { width: '50%' } },
                  ],
                },
                {
                  name: 'bands', type: 'array', labels: { singular: 'Band', plural: 'Band' },
                  admin: { description: 'Optional ranges → category badge + coloured gauge.' },
                  fields: [
                    { type: 'row', fields: [
                      { name: 'upTo', type: 'number', required: true, admin: { width: '34%', description: 'Inclusive upper bound.' } },
                      { name: 'label', type: 'text', required: true, admin: { width: '33%' } },
                      { name: 'color', type: 'text', required: true, admin: { width: '33%', description: 'Hex.' } },
                    ] },
                  ],
                },
              ],
            },
            {
              name: 'formulaTester',
              type: 'ui',
              admin: {
                condition: (data) => data?.toolType !== 'coded',
                components: { Field: '@/components/admin/FormulaTester#FormulaTester' },
              },
            },
          ],
        },
        {
          label: 'Content',
          fields: [
            { name: 'whatItIs', type: 'richText', label: 'What it is' },
            { name: 'howCalculated', type: 'richText', label: "How it's calculated" },
            { name: 'howToRead', type: 'richText', label: 'How to read your result' },
            {
              name: 'faq', type: 'array', labels: { singular: 'FAQ', plural: 'FAQs' },
              admin: { description: 'Emits FAQPage structured data automatically.' },
              fields: [
                { name: 'question', type: 'text', required: true },
                { name: 'answer', type: 'textarea', required: true },
              ],
            },
            {
              name: 'sources', type: 'array', labels: { singular: 'Source', plural: 'Sources' },
              fields: [
                { type: 'row', fields: [
                  { name: 'title', type: 'text', required: true, admin: { width: '60%' } },
                  { name: 'url', type: 'text', admin: { width: '40%' } },
                ] },
              ],
            },
            { name: 'related', type: 'relationship', relationTo: 'tools', hasMany: true, admin: { description: '3–4 related tools to cross-link.' } },
          ],
        },
        {
          label: 'SEO',
          fields: [
            seoField,
            // Identical to Articles.semanticEntities — same names, flags, admin
            // UI — so editors get the same Add-row experience on both.
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
          label: 'Usage & Analytics',
          fields: [
            {
              name: 'toolAnalytics',
              type: 'ui',
              admin: {
                components: { Field: '@/components/admin/ToolAnalytics#ToolAnalytics' },
              },
            },
          ],
        },
      ],
    },
    // ---- Sidebar fields ----
    slugField('name'),
    { name: 'sortOrder', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
    {
      name: 'riskLevel',
      type: 'select',
      required: true,
      defaultValue: 'low',
      options: [
        { label: 'Low (lifestyle/informational)', value: 'low' },
        { label: 'Medium (health guidance)', value: 'medium' },
        { label: 'High (medical/risk assessment)', value: 'high' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'YMYL risk tier. High = mandatory medical review before the tool can go live, and the public page shows the prominent disclaimer.',
      },
    },
    {
      name: 'medicalReviewRequired',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Forced on for high-risk tools. While required and unreviewed, the tool cannot be enabled + published.',
      },
    },
    {
      name: 'medicallyReviewed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Human attestation — tick ONLY after a qualified reviewer checked the formula, bands, and copy.',
      },
    },
    {
      name: 'reviewedBy',
      type: 'text',
      admin: {
        position: 'sidebar',
        condition: (data) => Boolean(data?.medicallyReviewed),
        description: 'Reviewer name/credential (shown nowhere publicly yet; audit trail).',
      },
    },
  ],
};
