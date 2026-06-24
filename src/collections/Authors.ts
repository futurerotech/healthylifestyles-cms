import type { CollectionConfig } from 'payload';
import { isAdminOrEditor, publicRead } from '../access/roles';
import { slugField } from '../fields/slug';

/** Article bylines with bio + credentials for E-E-A-T. */
export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: { useAsTitle: 'name', group: 'Content', defaultColumns: ['name', 'credential'], listSearchableFields: ['name', 'credential'] },
  access: { read: publicRead, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdminOrEditor },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'credential', type: 'text', admin: { description: 'e.g. "RD, MSc Nutrition" or "Medical reviewer".' } },
    { name: 'bio', type: 'textarea', admin: { description: 'Short professional bio shown on articles.' } },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    {
      name: 'links',
      type: 'array',
      labels: { singular: 'Link', plural: 'Links' },
      fields: [
        { name: 'label', type: 'text' },
        { name: 'url', type: 'text' },
      ],
    },
  ],
};
