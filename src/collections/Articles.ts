import type { CollectionConfig } from 'payload';
import { isAdminOrEditor, publicRead } from '../access/roles';
import { slugField } from '../fields/slug';
import { seoField } from '../fields/seo';
import { pageBlocks } from '../blocks';
import { afterChangeIndexingHook } from '../lib/indexing';
import { afterPublishPushHook } from '../lib/push';

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', '_status', 'featured', 'category', 'author', 'updatedAt'],
    listSearchableFields: ['title', 'excerpt'],
    preview: (doc) => (doc?.slug ? `https://www.healthylifestyles.com/wellness-hub/${doc.slug}` : null),
  },
  access: { read: publicRead, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdminOrEditor },
  versions: { drafts: { autosave: { interval: 800 }, schedulePublish: true }, maxPerDoc: 50 },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'excerpt', type: 'textarea', admin: { description: 'Short summary for cards and the article lead.' } },
            { name: 'heroImage', type: 'upload', relationTo: 'media', admin: { description: 'Featured image.' } },
            {
              name: 'layout',
              type: 'blocks',
              blocks: pageBlocks,
              admin: { description: 'Build the page with modular blocks.' },
            },
            {
              name: 'faq', type: 'array', labels: { singular: 'FAQ', plural: 'FAQs' },
              admin: { description: 'People-also-ask questions. Emits FAQPage structured data.' },
              fields: [
                { name: 'question', type: 'text', required: true },
                { name: 'answer', type: 'textarea', required: true },
              ],
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
        { label: 'SEO', fields: [seoField] },
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
    slugField('title'),
    { name: 'category', type: 'relationship', relationTo: 'categories', admin: { position: 'sidebar' } },
    { name: 'author', type: 'relationship', relationTo: 'authors', admin: { position: 'sidebar', description: 'Written by.' } },
    { name: 'reviewer', type: 'relationship', relationTo: 'authors', admin: { position: 'sidebar', description: 'Medically reviewed by.' } },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true, admin: { position: 'sidebar' } },
    { name: 'publishDate', type: 'date', admin: { position: 'sidebar', description: 'Used for ordering and scheduling.' } },
    { name: 'updatedDate', type: 'date', admin: { position: 'sidebar', description: 'Last substantive update for YMYL freshness signals.' } },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Show as the featured/hero article on the Wellness Hub.' } },
    { name: 'primaryTool', type: 'relationship', relationTo: 'tools', admin: { position: 'sidebar', description: 'The primary tool to embed inline within the article.' } },
    { name: 'relatedArticles', type: 'relationship', relationTo: 'articles', hasMany: true, admin: { position: 'sidebar', description: 'Explicitly link related articles (auto-fallback to same-category when empty).' } },
    { name: 'requestIndexing', type: 'ui', admin: { position: 'sidebar', components: { Field: '@/components/admin/RequestIndexing#RequestIndexing' } } },
    { name: 'sendPushButton', type: 'ui', admin: { position: 'sidebar', components: { Field: '@/components/admin/SendPushButton#SendPushButton' } } },
  ],
  hooks: {
    afterChange: [afterChangeIndexingHook, afterPublishPushHook],
  },
};
