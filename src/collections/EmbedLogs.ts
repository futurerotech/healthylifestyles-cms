import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrEditor } from '../access/roles';

/**
 * Sites embedding our calculators via /embed/[slug]. One doc per
 * (tool, referrer host); the /api/track/embed endpoint upserts count +
 * lastSeenAt on every embed load. Each row is a natural backlink you never
 * had to ask for — and a warm prospect for more.
 */
export const EmbedLogs: CollectionConfig = {
  slug: 'embed-logs',
  labels: { singular: 'Embed', plural: 'Embeds' },
  admin: {
    group: 'Link Building',
    useAsTitle: 'referrerHost',
    defaultColumns: ['referrerHost', 'toolSlug', 'count', 'lastSeenAt'],
    listSearchableFields: ['referrerHost', 'toolSlug', 'referrerUrl'],
    description: 'Who embeds your calculators (auto-logged). Created by the tracking endpoint — not by hand.',
  },
  access: { read: isAdminOrEditor, create: () => false, update: () => false, delete: isAdmin },
  fields: [
    { name: 'toolSlug', type: 'text', required: true, index: true },
    { name: 'referrerHost', type: 'text', required: true, index: true, admin: { description: 'Host of the page embedding the tool.' } },
    { name: 'referrerUrl', type: 'text', admin: { description: 'Most recent full page URL seen.' } },
    { name: 'count', type: 'number', defaultValue: 1, admin: { description: 'Embed loads seen from this host for this tool.' } },
    { name: 'lastSeenAt', type: 'date' },
  ],
  timestamps: true,
};
