import type { Access, CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';

/** Same server-only `create` pattern as Subscribers — see that file for notes. */
const internalKeyCreate: Access = ({ req }) => {
  const secret = process.env.INTERNAL_API_KEY;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('x-internal-key') === secret;
};

export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  admin: {
    useAsTitle: 'endpoint',
    group: 'Audience',
    defaultColumns: ['endpoint', 'userAgent', 'subscribedAt', 'createdAt'],
    description: 'Browser push notification subscriptions (VAPID web push).',
  },
  access: { read: isAdmin, create: internalKeyCreate, update: isAdmin, delete: isAdmin },
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
