import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';
import { seoField } from '../fields/seo';

export const PseoTemplates: CollectionConfig = {
  slug: 'pseo-templates',
  admin: {
    group: 'pSEO',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'status', 'updatedAt'],
    description: 'Page templates for programmatic SEO pages. Use {{variable}} placeholders.',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Template name' },
    { name: 'slug', type: 'text', required: true, unique: true, admin: { description: 'Used as prefix for generated page slugs.' } },
    {
      name: 'status', type: 'select', defaultValue: 'draft', options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Page Content',
          fields: [
            {
              name: 'headlineTemplate', type: 'text', required: true,
              admin: { description: 'H1 template — e.g. "{{keyword}} Calculator for {{audience}}"' },
            },
            {
              name: 'subheadlineTemplate', type: 'text',
              admin: { description: 'H2 subtitle template.' },
            },
            {
              name: 'bodyTemplate', type: 'textarea', required: true,
              admin: { description: 'Main body HTML. Supports {{variable}} placeholders. Use standard HTML.' },
            },
            {
              name: 'ctaTemplate', type: 'text',
              admin: { description: 'Call-to-action text template — e.g. "Try the {{keyword}} Calculator Now"' },
            },
            {
              name: 'ctaLink', type: 'text',
              admin: { description: 'Where the CTA goes. Use {{slug}} to link to the target calculator.' },
            },
          ],
        },
        {
          label: 'SEO Templates',
          fields: [
            {
              name: 'metaTitleTemplate', type: 'text', required: true,
              admin: { description: 'Meta title — e.g. "{{keyword}} Calculator: Free {{audience}} Tool ({{year}})"' },
            },
            {
              name: 'metaDescTemplate', type: 'text', required: true,
              admin: { description: 'Meta description — e.g. "Use our free {{keyword}} calculator for {{audience}}. Check your {{healthGoal}} in minutes."' },
            },
            {
              name: 'h1Template', type: 'text',
              admin: { description: 'H1 override for the rendered page. Falls back to headlineTemplate.' },
            },
            {
              name: 'slugTemplate', type: 'text', required: true,
              admin: { description: 'Slug pattern — e.g. "{{keyword}}-calculator-{{audience}}". Auto-slugified.' },
            },
          ],
        },
      ],
    },
  ],
};
