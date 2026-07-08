import type { CollectionConfig } from 'payload';
import { isAdminOrEditor, publicRead } from '../access/roles';
import { slugField } from '../fields/slug';
import { trackPendingChange } from '../hooks/trackPendingChange';
const isHex = (v: string | null | undefined) =>
  v ? /^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v) : true;

/** Article bylines with bio + credentials for E-E-A-T. */
export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: { useAsTitle: 'name', group: 'Content', defaultColumns: ['name', 'role', 'credential', 'schemaType'], listSearchableFields: ['name', 'credential', 'role'] },
  access: { read: publicRead, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdminOrEditor },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'role', type: 'text', admin: { description: 'e.g. "Research & Writing" or "Medical Review Board".' } },
    { name: 'credential', type: 'text', admin: { description: 'e.g. "RD, MSc Nutrition" or "Medical reviewer".' } },
    { name: 'bio', type: 'textarea', admin: { description: 'Short professional bio shown on articles.' } },
    {
      name: 'initials',
      type: 'text',
      maxLength: 2,
      admin: { description: '1-2 character monogram for avatar fallback (e.g. "HE", "MR").' },
    },
    {
      name: 'color',
      type: 'text',
      admin: { description: 'Hex background color for the avatar fallback, e.g. #16a34a.' },
      validate: (v: string | null | undefined) =>
        isHex(v) ? true : 'Must be a valid hex color (e.g. #16a34a).',
    },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    {
      name: 'schemaType',
      type: 'select',
      defaultValue: 'Organization',
      options: [
        { label: 'Organization', value: 'Organization' },
        { label: 'Person', value: 'Person' },
      ],
      admin: { description: 'Schema.org type for structured data.' },
    },
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
  // Author pages (/author/[slug]) are site-rendered and their bios appear on
  // every article byline, so a change must queue a rebuild like other content.
  hooks: {
    afterChange: [trackPendingChange],
  },
};
