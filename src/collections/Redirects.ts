import type { CollectionConfig } from 'payload';
import { isAdmin, publicRead } from '../access/roles';

/** Old URL → new URL redirects (admin-only). The public site reads these to
 *  emit host redirect rules; sitemap/robots regenerate on publish. */
export const Redirects: CollectionConfig = {
  slug: 'redirects',
  admin: { useAsTitle: 'from', group: 'Settings', defaultColumns: ['from', 'to', 'type'], listSearchableFields: ['from', 'to'] },
  access: { read: publicRead, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'from', type: 'text', required: true, admin: { description: 'Old path, e.g. /old-bmi' } },
    { name: 'to', type: 'text', required: true, admin: { description: 'New path or URL, e.g. /tools/bmi-calculator' } },
    {
      name: 'type', type: 'select', defaultValue: '301',
      options: [
        { label: '301 (permanent)', value: '301' },
        { label: '302 (temporary)', value: '302' },
      ],
    },
  ],
};
