import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';
import { seoField } from '../fields/seo';

export const PseoPages: CollectionConfig = {
  slug: 'pseo-pages',
  admin: {
    group: 'pSEO',
    useAsTitle: 'slug',
    defaultColumns: ['slug', 'template', 'dataset', 'keyword', 'status', 'updatedAt'],
    description: 'Generated programmatic SEO pages. One per CSV row.',
    listSearchableFields: ['slug', 'keyword'],
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'status', type: 'select', defaultValue: 'published',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
    { name: 'template', type: 'relationship', relationTo: 'pseo-templates', required: true },
    { name: 'dataset', type: 'relationship', relationTo: 'pseo-datasets', required: true },
    { name: 'keyword', type: 'text', admin: { description: 'Primary keyword from the CSV row.' } },
    {
      name: 'variables', type: 'json',
      admin: { description: 'All column values from the CSV row stored as key-value pairs.', readOnly: true },
    },
    { name: 'headline', type: 'text', admin: { readOnly: true } },
    { name: 'subheadline', type: 'text', admin: { readOnly: true } },
    { name: 'bodyHtml', type: 'textarea', admin: { readOnly: true, description: 'Rendered page body HTML.' } },
    { name: 'ctaText', type: 'text', admin: { readOnly: true } },
    { name: 'ctaUrl', type: 'text', admin: { readOnly: true } },
    {
      name: 'seo', type: 'group', admin: { readOnly: true, description: 'Rendered SEO metadata.' },
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea' },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
        { name: 'noIndex', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.slug) {
          data.slug = data.slug.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
        }
        return data;
      },
    ],
  },
};
