import type { Access, CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';

/**
 * Server-only `create`: the Astro lead proxy must include the shared
 * `x-internal-key` header. Mirrors Subscribers/PushSubscriptions so the
 * lead table can't be flooded by unauthenticated public POSTs (it was
 * previously `create: () => true` — world-writable).
 *
 * Dev fallback: if `INTERNAL_API_KEY` is unset AND not production, allow
 * create so local development works without env wiring.
 */
const internalKeyCreate: Access = ({ req }) => {
  const secret = process.env.INTERNAL_API_KEY;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('x-internal-key') === secret;
};

export const Leads: CollectionConfig = {
  slug: 'leads',
  admin: {
    useAsTitle: 'email',
    group: 'Content',
    defaultColumns: ['email', 'name', 'offer', 'tool', 'createdAt'],
    listSearchableFields: ['email', 'name'],
    description: 'Lead-capture submissions from calculator result CTAs.',
  },
  access: { read: isAdmin, create: internalKeyCreate, update: isAdmin, delete: isAdmin },
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
