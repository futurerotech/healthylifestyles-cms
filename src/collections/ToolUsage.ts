import type { CollectionConfig } from 'payload';
import { isAdmin, publicRead } from '../access/roles';

export const ToolUsage: CollectionConfig = {
  slug: 'tool-usage',
  admin: {
    group: 'Analytics',
    useAsTitle: 'sessionId',
    defaultColumns: ['tool', 'completed', 'duration', 'lastFieldReached', 'createdAt'],
    listSearchableFields: ['sessionId'],
    description: 'Anonymous per-session usage data for calculator tools.',
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    {
      type: 'relationship',
      name: 'tool',
      relationTo: 'tools',
      required: true,
      index: true,
    },
    {
      type: 'text',
      name: 'sessionId',
      required: true,
      index: true,
    },
    {
      type: 'relationship',
      name: 'profile',
      relationTo: 'profiles',
      index: true,
      admin: { description: 'Anonymous profile (if linked).' },
    },
    {
      type: 'date',
      name: 'startedAt',
      required: true,
    },
    {
      type: 'date',
      name: 'completedAt',
    },
    {
      type: 'text',
      name: 'lastFieldReached',
      admin: { description: 'Key of the last input field the user interacted with before leaving.' },
    },
    {
      type: 'number',
      name: 'totalFieldsCompleted',
      admin: { description: 'Number of inputs the user filled before leaving.' },
    },
    {
      type: 'number',
      name: 'totalFields',
      admin: { description: 'Total input fields on this tool.' },
    },
    {
      type: 'checkbox',
      name: 'completed',
      defaultValue: false,
      index: true,
    },
    {
      type: 'number',
      name: 'duration',
      admin: { description: 'Session duration in seconds.' },
    },
    {
      type: 'text',
      name: 'referrer',
    },
  ],
  timestamps: true,
};
