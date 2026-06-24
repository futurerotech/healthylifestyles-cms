import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';

export const PseoDatasets: CollectionConfig = {
  slug: 'pseo-datasets',
  admin: {
    group: 'pSEO',
    useAsTitle: 'name',
    defaultColumns: ['name', 'template', 'rowCount', 'status', 'updatedAt'],
    description: 'CSV datasets containing keyword/variable rows. Each row generates one pSEO page.',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Dataset name' },
    {
      type: 'row',
      fields: [
        {
          name: 'template', type: 'relationship', relationTo: 'pseo-templates', required: true,
          admin: { width: '50%' },
        },
        {
          name: 'status', type: 'select', defaultValue: 'draft', admin: { width: '50%' },
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Ready', value: 'ready' },
            { label: 'Generated', value: 'generated' },
          ],
        },
      ],
    },
    {
      name: 'csvFile', type: 'upload', relationTo: 'media', required: true,
      admin: { description: 'CSV file with header row. Columns become {{variables}} in templates.' },
    },
    {
      name: 'columns', type: 'json',
      admin: {
        description: 'Detected CSV columns + config (auto-populated on upload).',
        readOnly: true,
      },
    },
    {
      name: 'rowCount', type: 'number',
      admin: { readOnly: true, description: 'Number of data rows in the CSV.' },
    },
    {
      name: 'preview',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/PseoPreview#PseoPreview' } },
    },
    {
      name: 'generate',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/PseoGenerateButton#PseoGenerateButton' } },
    },
  ],
};
