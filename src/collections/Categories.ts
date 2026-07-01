import type { CollectionConfig } from 'payload';
import { isAdminOrEditor, publicRead } from '../access/roles';
import { slugField } from '../fields/slug';
import { seoField } from '../fields/seo';
import { afterChangeIndexingHook } from '../lib/indexing';
/**
 * Categories AND content sections. New entries flow into the nav, hub pages and
 * sitemap automatically (the public site reads this collection at build time).
 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'name', group: 'Content', defaultColumns: ['name', 'kind', 'order'], listSearchableFields: ['name', 'slug'] },
  access: { read: publicRead, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdminOrEditor },
  versions: { drafts: false, maxPerDoc: 20 },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'tool',
      options: [
        { label: 'Tool category', value: 'tool' },
        { label: 'Content section', value: 'section' },
      ],
    },
    { name: 'description', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'icon', type: 'text', admin: { width: '33%', description: 'Icon key (e.g. "leaf", "heart-pulse").' } },
        { name: 'accentColor', type: 'text', admin: { width: '33%', description: 'Hex accent, e.g. #16a34a.' } },
        { name: 'accent', type: 'text', admin: { width: '34%', description: 'CSS variable or hex for dynamic theming (e.g. var(--c-nutrition)). Falls back to accentColor.' } },
      ],
    },
    { name: 'order', type: 'number', defaultValue: 0, admin: { position: 'sidebar', description: 'Sort order in nav and grids.' } },
    seoField,
  ],
  hooks: {
    afterChange: [afterChangeIndexingHook],
  },
};
