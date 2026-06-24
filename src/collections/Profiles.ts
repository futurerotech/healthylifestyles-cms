import type { CollectionConfig } from 'payload';
import { isAdmin, publicRead } from '../access/roles';

export const Profiles: CollectionConfig = {
  slug: 'profiles',
  admin: {
    useAsTitle: 'profileId',
    group: 'Segmentation',
    defaultColumns: ['profileId', 'personas', 'toolUsageCount', 'createdAt'],
    listSearchableFields: ['profileId'],
    description: 'Anonymous public user profiles. Personas are auto-assigned by usage patterns.',
  },
  access: { read: isAdmin, create: () => false, update: () => false, delete: isAdmin },
  timestamps: true,
  fields: [
    {
      type: 'text',
      name: 'profileId',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'UUID generated client-side, stored in localStorage.' },
    },
    {
      type: 'relationship',
      name: 'personas',
      relationTo: 'personas',
      hasMany: true,
      index: true,
      admin: { description: 'Auto-assigned personas based on tool usage.' },
    },
    {
      type: 'number',
      name: 'toolUsageCount',
      defaultValue: 0,
      admin: { description: 'Total number of tool interactions.' },
    },
    {
      type: 'date',
      name: 'lastActiveAt',
      admin: { description: 'Last tool interaction timestamp.' },
    },
  ],
};
