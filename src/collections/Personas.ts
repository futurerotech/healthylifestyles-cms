import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrEditor } from '../access/roles';
import { slugField } from '../fields/slug';

export const Personas: CollectionConfig = {
  slug: 'personas',
  admin: {
    useAsTitle: 'name',
    group: 'Segmentation',
    defaultColumns: ['name', 'enabled', 'profilesCount', 'updatedAt'],
    description: 'User personas assigned automatically based on tool usage patterns.',
  },
  access: { read: isAdminOrEditor, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdmin },
  timestamps: true,
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Basics',
          fields: [
            { name: 'name', type: 'text', required: true, admin: { description: 'e.g. "Bodybuilder", "Weight Loss Seeker"' } },
            { name: 'description', type: 'textarea' },
            {
              type: 'row',
              fields: [
                { name: 'icon', type: 'text', admin: { width: '50%', description: 'Lucide icon name, e.g. "dumbbell", "flame".' } },
                { name: 'color', type: 'text', admin: { width: '50%', description: 'Hex, e.g. #ef4444.' } },
              ],
            },
            { name: 'enabled', type: 'checkbox', defaultValue: true, admin: { description: 'Off = persona is not assigned to any profile.' } },
          ],
        },
        {
          label: 'Rules',
          description: 'Tool/category usage rules. A profile must meet ALL rules to receive this persona.',
          fields: [
            {
              name: 'rules',
              type: 'array',
              labels: { singular: 'Rule', plural: 'Rules' },
              minRows: 1,
              admin: { description: 'Each rule is a condition the profile must satisfy.' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'matchType',
                      type: 'select',
                      required: true,
                      admin: { width: '40%' },
                      options: [
                        { label: 'Used a specific tool', value: 'tool' },
                        { label: 'Used any tool in a category', value: 'category' },
                      ],
                    },
                    { name: 'tool', type: 'relationship', relationTo: 'tools', admin: { width: '30%', condition: (_, sib) => sib?.matchType === 'tool' } },
                    { name: 'category', type: 'relationship', relationTo: 'categories', admin: { width: '30%', condition: (_, sib) => sib?.matchType === 'category' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'minUsage', type: 'number', defaultValue: 1, admin: { width: '50%', description: 'Times user must use this tool/category.' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    slugField('name'),
    {
      name: 'profilesCount',
      type: 'number',
      defaultValue: 0,
      admin: { position: 'sidebar', description: 'Auto-updated count of profiles assigned this persona.' },
    },
  ],
};
