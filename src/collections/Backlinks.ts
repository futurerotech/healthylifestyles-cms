import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrEditor } from '../access/roles';

/**
 * Earned backlinks — one doc per live link pointing at the site. The
 * /api/backlinks/check endpoint periodically fetches each source page and
 * confirms the link is still there (liveStatus + lastCheckedAt are updated
 * automatically; run it manually or point an external cron at it).
 */
export const Backlinks: CollectionConfig = {
  slug: 'backlinks',
  labels: { singular: 'Backlink', plural: 'Backlinks' },
  admin: {
    group: 'Link Building',
    useAsTitle: 'sourceUrl',
    defaultColumns: ['sourceUrl', 'targetPage', 'linkType', 'liveStatus', 'dateEarned'],
    listSearchableFields: ['sourceUrl', 'targetPage', 'anchorText'],
    description: 'Every earned link. “Check links now” = GET /api/backlinks/check (admin session or x-api-key).',
  },
  access: { read: isAdminOrEditor, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdmin },
  fields: [
    { name: 'sourceUrl', type: 'text', required: true, index: true, admin: { description: 'The page on THEIR site that contains the link.' } },
    {
      type: 'row',
      fields: [
        { name: 'targetPage', type: 'text', required: true, admin: { width: '60%', description: 'Page on OUR site the link points to (e.g. /tools/bmi-calculator).' } },
        { name: 'anchorText', type: 'text', admin: { width: '40%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'linkType',
          type: 'select',
          defaultValue: 'dofollow',
          options: [
            { label: 'Dofollow', value: 'dofollow' },
            { label: 'Nofollow', value: 'nofollow' },
          ],
          admin: { width: '25%' },
        },
        {
          name: 'dateEarned',
          type: 'date',
          defaultValue: () => new Date().toISOString(),
          index: true,
          admin: { width: '25%', date: { pickerAppearance: 'dayOnly' } },
        },
        {
          name: 'liveStatus',
          type: 'select',
          defaultValue: 'pending',
          index: true,
          options: [
            { label: 'Pending check', value: 'pending' },
            { label: 'Live', value: 'live' },
            { label: 'Lost', value: 'lost' },
          ],
          admin: { width: '25%', description: 'Set by the live-check endpoint.' },
        },
        { name: 'lastCheckedAt', type: 'date', admin: { width: '25%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    { name: 'prospect', type: 'relationship', relationTo: 'link-prospects', admin: { description: 'The outreach prospect this link came from (if any).' } },
    { name: 'notes', type: 'textarea' },
  ],
  timestamps: true,
};
