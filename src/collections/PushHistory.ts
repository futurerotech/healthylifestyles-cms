import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';

export const PushHistory: CollectionConfig = {
  slug: 'push-history',
  admin: {
    useAsTitle: 'title',
    group: 'Audience',
    defaultColumns: ['title', 'article', 'sentCount', 'failedCount', 'createdAt'],
    description: 'Audit log of all push notifications sent.',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'Push notification title.' },
    },
    {
      name: 'body',
      type: 'textarea',
      admin: { description: 'Push notification body text.' },
    },
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      admin: { description: 'Article this push relates to (optional).' },
    },
    {
      name: 'url',
      type: 'text',
      admin: { description: 'URL opened when the notification is clicked.' },
    },
    {
      name: 'sentCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'failedCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'errors',
      type: 'json',
      admin: { description: 'Detailed error log for failed sends.' },
    },
    {
      name: 'sentAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      admin: { readOnly: true },
    },
  ],
};
