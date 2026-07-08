import type { CollectionConfig } from 'payload';
import { isAdmin, publicRead } from '../access/roles';
import { slugField } from '../fields/slug';
import { seoField } from '../fields/seo';
import { pageBlocks } from '../blocks';
import { afterChangeIndexingHook } from '../lib/indexing';
import { trackPendingChange } from '../hooks/trackPendingChange';

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', '_status', 'updatedAt'],
    preview: (doc) => (doc?.slug ? `${process.env.SITE_BASE_URL || 'https://www.healthylifesstyles.com'}/${doc.slug}` : null),
  },
  access: { read: publicRead, create: isAdmin, update: isAdmin, delete: isAdmin },
  versions: { drafts: { autosave: { interval: 800 } }, maxPerDoc: 50 },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'heroImage', type: 'upload', relationTo: 'media', admin: { description: 'Page-level hero image.' } },
    {
      name: 'layout',
      type: 'blocks',
      blocks: pageBlocks,
      required: true,
      minRows: 1,
      admin: { description: 'Build the page with modular blocks.' },
    },
    seoField,
    {
      name: 'schemaGenerator',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/SchemaGenerator#SchemaGenerator' } },
    },
    slugField('title'),
    { name: 'publishDate', type: 'date', admin: { description: 'Used for ordering and scheduling.' } },
  ],
  hooks: {
    afterChange: [afterChangeIndexingHook, trackPendingChange],
  },
};
