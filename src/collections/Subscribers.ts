import type { Access, CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';

/**
 * Server-only `create`: the Astro proxy (and admin tools) must include the
 * shared `x-internal-key` header. Direct public POSTs from the browser are
 * rejected — the proxy is the validating choke point.
 *
 * Dev fallback: if `INTERNAL_API_KEY` is unset AND `NODE_ENV !== 'production'`,
 * we allow create so local development still works without env wiring.
 */
const internalKeyCreate: Access = ({ req }) => {
  const secret = process.env.INTERNAL_API_KEY;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('x-internal-key') === secret;
};

export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  admin: {
    useAsTitle: 'email',
    group: 'Audience',
    defaultColumns: ['email', 'name', 'source', 'interests', 'createdAt'],
    listSearchableFields: ['email', 'name'],
    description: 'Email subscribers captured via lead forms, CSV imports, or n8n sync.',
  },
  access: { read: isAdmin, create: internalKeyCreate, update: isAdmin, delete: isAdmin },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
      admin: { description: 'First name or full name.' },
    },
    {
      name: 'interests',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Weight Loss', value: 'weight-loss' },
        { label: 'Nutrition', value: 'nutrition' },
        { label: 'Fitness', value: 'fitness' },
        { label: 'Sleep', value: 'sleep' },
        { label: 'Heart Health', value: 'heart-health' },
        { label: 'Mental Wellness', value: 'mental-wellness' },
        { label: 'Women\'s Health', value: 'womens-health' },
        { label: 'General Wellness', value: 'general' },
      ],
      admin: { description: 'Content categories this subscriber is interested in.' },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'web-form',
      options: [
        { label: 'Web Form', value: 'web-form' },
        { label: 'CSV Import', value: 'csv-import' },
        { label: 'n8n Sync', value: 'n8n-sync' },
        { label: 'API', value: 'api' },
      ],
    },
    {
      name: 'subscribedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      admin: { readOnly: true },
    },
    {
      name: 'unsubscribedAt',
      type: 'date',
      admin: { description: 'Set when the subscriber opts out.' },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: { description: 'Flexible extra data (tool used, source page, etc.).' },
    },
  ],
};
