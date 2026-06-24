import type { CollectionConfig } from 'payload';
import { isAdmin, publicRead } from '../access/roles';

export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  admin: {
    useAsTitle: 'email',
    group: 'Audience',
    defaultColumns: ['email', 'name', 'source', 'interests', 'createdAt'],
    listSearchableFields: ['email', 'name'],
    description: 'Email subscribers captured via lead forms, CSV imports, or n8n sync.',
  },
  access: { read: isAdmin, create: publicRead, update: isAdmin, delete: isAdmin },
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
