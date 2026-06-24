import type { CollectionConfig } from 'payload';
import { isAdmin, publicRead } from '../access/roles';

export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  admin: {
    useAsTitle: 'id',
    group: 'Audience',
    defaultColumns: ['endpoint', 'userAgent', 'subscribedAt', 'createdAt'],
    description: 'Browser push notification subscriptions (VAPID web push).',
  },
  access: { read: isAdmin, create: publicRead, update: isAdmin, delete: isAdmin },
  fields: [
    {
      name: 'endpoint',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Push endpoint URL from the browser.' },
    },
    {
      name: 'authKey',
      type: 'text',
      required: true,
      admin: { description: 'Auth secret from the browser subscription.' },
    },
    {
      name: 'p256dhKey',
      type: 'text',
      required: true,
      admin: { description: 'P256DH public key from the browser subscription.' },
    },
    {
      name: 'userAgent',
      type: 'text',
      admin: { description: 'Browser user-agent string.' },
    },
    {
      name: 'subscribedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      admin: { readOnly: true },
    },
  ],
};
