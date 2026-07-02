import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrEditor } from '../access/roles';

/**
 * Reusable outreach email templates with merge fields. Four defaults are seeded
 * on first boot (guest post, free calculator, broken link, data study) — see
 * onInit in payload.config. Copy the rendered text into your own email client:
 * outreach must stay personal and manual; nothing here auto-sends.
 *
 * Merge fields: {{siteName}} {{contactName}} {{pageUrl}} {{toolName}} {{toolUrl}} {{myName}}
 */
export const OutreachTemplates: CollectionConfig = {
  slug: 'outreach-templates',
  labels: { singular: 'Email Template', plural: 'Email Templates' },
  admin: {
    group: 'Link Building',
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'updatedAt'],
    description:
      'Merge fields you can use anywhere: {{siteName}}, {{contactName}}, {{pageUrl}}, {{toolName}}, {{toolUrl}}, {{myName}}. Replace them before sending.',
  },
  access: { read: isAdminOrEditor, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdmin },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, admin: { width: '60%' } },
        {
          name: 'type',
          type: 'select',
          required: true,
          defaultValue: 'custom',
          options: [
            { label: 'Guest post pitch', value: 'guest-post' },
            { label: '“We made a free calculator”', value: 'free-calculator' },
            { label: 'Broken-link outreach', value: 'broken-link' },
            { label: 'Data-study pitch', value: 'data-study' },
            { label: 'Custom', value: 'custom' },
          ],
          admin: { width: '40%' },
        },
      ],
    },
    { name: 'subject', type: 'text', required: true, admin: { description: 'Email subject line (merge fields allowed).' } },
    { name: 'body', type: 'textarea', required: true, admin: { rows: 14, description: 'Email body (merge fields allowed). Personalize every send — template + no personalization = spam folder.' } },
    { name: 'notes', type: 'textarea', admin: { description: 'When to use this template; what response rate you see.' } },
  ],
  timestamps: true,
};
