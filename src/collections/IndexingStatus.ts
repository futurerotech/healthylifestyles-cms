import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';

export const IndexingStatus: CollectionConfig = {
  slug: 'indexing-status',
  admin: {
    group: 'SEO',
    useAsTitle: 'url',
    defaultColumns: ['url', 'engine', 'status', 'submittedAt'],
    listSearchableFields: ['url', 'docSlug'],
    description: 'History of IndexNow and Google Indexing API pings.',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'docType', type: 'text', required: true, admin: { readOnly: true, description: 'Collection slug (tools, articles, pages).' } },
    { name: 'docSlug', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'url', type: 'text', required: true, admin: { readOnly: true } },
    {
      name: 'engine',
      type: 'select',
      required: true,
      options: [
        { label: 'IndexNow (auto)', value: 'https://api.indexnow.org/indexnow' },
        { label: 'Bing', value: 'https://www.bing.com/indexnow' },
        { label: 'Yandex', value: 'https://search.yandex.com/indexnow' },
        { label: 'Google', value: 'google' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    { name: 'httpStatus', type: 'number', admin: { readOnly: true } },
    { name: 'error', type: 'textarea', admin: { readOnly: true } },
    { name: 'submittedAt', type: 'date', required: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
  ],
};
