import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';

/**
 * AI SEO Autopilot — pending deploys queue (§7.1).
 * Published content changes are recorded by the server inside its PostgreSQL
 * transaction; IndexNow acknowledges only the exact matching queued revision.
 * Even administrators cannot delete queue entries through REST/Local API:
 * reviewed server-side acknowledgement is the only automatic removal path.
 */
export const PendingDeploys: CollectionConfig = {
  slug: 'pending-deploys',
  admin: {
    group: 'Autopilot',
    useAsTitle: 'collectionSlug',
    defaultColumns: ['collectionSlug', 'docId', 'changedAt'],
    listSearchableFields: ['collectionSlug', 'docId'],
    // Machine-managed: hiding navigation is not an authorization control.
    // Admins can inspect read-only; nobody can write/delete via REST.
    // Exact-revision SQL acknowledgement remains server-controlled.
    hidden: true,
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'collectionSlug', type: 'text', required: true, admin: { description: 'Which collection was changed.' } },
    { name: 'docId', type: 'text', required: true, admin: { description: 'Document ID that was changed.' } },
    { name: 'changedAt', type: 'text', required: true, admin: { description: 'ISO timestamp of the change.' } },
  ],
  timestamps: true,
};
