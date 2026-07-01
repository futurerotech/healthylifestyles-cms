import type { GlobalConfig } from 'payload';
import { isAdmin } from '../access/roles';

export const Indexing: GlobalConfig = {
  slug: 'indexing',
  label: 'Indexing',
  admin: { group: 'SEO' },
  access: { read: isAdmin, update: isAdmin },
  fields: [
    {
      name: 'indexNowKey',
      type: 'text',
      admin: { description: 'IndexNow key (a UUID). Create a file named <key>.txt at your site root.' },
    },
    {
      name: 'googleServiceAccount',
      type: 'textarea',
      admin: { description: 'Google service-account JSON (paste the full key). Enables Google Indexing API.' },
    },
    {
      name: 'dashboard',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/IndexingDashboard#IndexingDashboard' } },
    },
  ],
};
