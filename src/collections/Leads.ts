import type { CollectionConfig } from 'payload';
import { isAdmin, publicRead } from '../access/roles';

export const Leads: CollectionConfig = {
  slug: 'leads',
  admin: {
    useAsTitle: 'email',
    group: 'Content',
    defaultColumns: ['email', 'name', 'offer', 'tool', 'createdAt'],
    listSearchableFields: ['email', 'name'],
    description: 'Lead-capture submissions from calculator result CTAs.',
  },
  access: { read: isAdmin, create: publicRead, update: isAdmin, delete: isAdmin },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
      admin: { description: 'First name (if collected).' },
    },
    {
      name: 'offer',
      type: 'text',
      admin: { description: 'Which offer they responded to (offer name from LeadGen).' },
    },
    {
      name: 'tool',
      type: 'text',
      admin: { description: 'Which tool/page they were on when submitting.' },
    },
    {
      name: 'sourcePage',
      type: 'text',
      admin: { description: 'Full URL of the page where the form was submitted.' },
    },
  ],
};
