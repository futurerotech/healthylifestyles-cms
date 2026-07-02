import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrEditor } from '../access/roles';

/**
 * Link-building prospect pipeline. A WORKFLOW manager for human outreach —
 * never an auto-link generator (auto-generated links are spam and a Google
 * penalty risk). Each doc is one site you might earn a link from, tracked
 * from Prospect → Contacted → Replied → Won / Rejected, with a full log of
 * every send + reply and a follow-up date the dashboard surfaces as a reminder.
 */
export const LinkProspects: CollectionConfig = {
  slug: 'link-prospects',
  labels: { singular: 'Prospect', plural: 'Prospects' },
  admin: {
    group: 'Link Building',
    useAsTitle: 'siteName',
    defaultColumns: ['siteName', 'status', 'domainAuthority', 'topicRelevance', 'followUpDate'],
    listSearchableFields: ['siteName', 'url', 'contactEmail', 'notes'],
    description: 'Outreach pipeline: Prospect → Contacted → Replied → Won / Rejected.',
  },
  access: { read: isAdminOrEditor, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdmin },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'siteName', type: 'text', required: true, admin: { width: '50%' } },
        { name: 'url', type: 'text', required: true, admin: { width: '50%', description: 'Homepage or the specific page you want the link from.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'prospect',
          index: true,
          options: [
            { label: 'Prospect', value: 'prospect' },
            { label: 'Contacted', value: 'contacted' },
            { label: 'Replied', value: 'replied' },
            { label: 'Won', value: 'won' },
            { label: 'Rejected', value: 'rejected' },
          ],
          admin: { width: '34%' },
        },
        {
          name: 'domainAuthority',
          type: 'number',
          min: 0,
          max: 100,
          admin: { width: '33%', description: 'DA/DR — paste manually from Moz/Ahrefs/etc.' },
        },
        {
          name: 'topicRelevance',
          type: 'select',
          defaultValue: 'medium',
          options: [
            { label: 'High (health/wellness site)', value: 'high' },
            { label: 'Medium (adjacent niche)', value: 'medium' },
            { label: 'Low (general site)', value: 'low' },
          ],
          admin: { width: '33%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'contactName', type: 'text', admin: { width: '34%' } },
        { name: 'contactEmail', type: 'email', admin: { width: '33%' } },
        {
          name: 'followUpDate',
          type: 'date',
          index: true,
          admin: {
            width: '33%',
            date: { pickerAppearance: 'dayOnly' },
            description: 'Dashboard reminds you when this date arrives.',
          },
        },
      ],
    },
    { name: 'notes', type: 'textarea', admin: { description: 'Context: why this site, which page fits, personal angle for the pitch.' } },
    {
      name: 'outreachLog',
      type: 'array',
      labels: { singular: 'Entry', plural: 'Entries' },
      admin: { description: 'Log every send and reply so the history lives with the prospect.' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'date',
              type: 'date',
              required: true,
              defaultValue: () => new Date().toISOString(),
              admin: { width: '30%', date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'direction',
              type: 'select',
              required: true,
              defaultValue: 'sent',
              options: [
                { label: 'Sent', value: 'sent' },
                { label: 'Reply received', value: 'reply' },
                { label: 'Internal note', value: 'note' },
              ],
              admin: { width: '30%' },
            },
            {
              name: 'template',
              type: 'relationship',
              relationTo: 'outreach-templates',
              admin: { width: '40%', description: 'Template used (if any).' },
            },
          ],
        },
        { name: 'subject', type: 'text' },
        { name: 'summary', type: 'textarea', admin: { description: 'What was said / what they replied.' } },
      ],
    },
  ],
  timestamps: true,
};
