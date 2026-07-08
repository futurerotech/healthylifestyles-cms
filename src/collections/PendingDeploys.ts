import type { CollectionConfig } from 'payload';
import { isAdminOrEditor } from '../access/roles';

/**
 * AI SEO Autopilot — pending deploys queue (§7.1).
 * Each content save creates an entry here instead of triggering a Vercel build.
 * The deploy endpoint clears the queue when a manual deploy is triggered.
 */
export const PendingDeploys: CollectionConfig = {
  slug: 'pending-deploys',
  admin: {
    group: 'Autopilot',
    useAsTitle: 'collectionSlug',
    defaultColumns: ['collectionSlug', 'docId', 'changedAt'],
    listSearchableFields: ['collectionSlug', 'docId'],
    // Completely hidden from the admin navigation. This queue is machine-managed
    // (written by the trackPendingChange hook on content saves, drained by
    // /api/deploy) — staff never browse it directly. `hidden` only removes the
    // nav entry and list view; the REST/Local API the hook and endpoint use
    // keeps working.
    hidden: true,
  },
  access: {
    read: isAdminOrEditor,
    create: () => true,
    update: () => false,
    delete: isAdminOrEditor,
  },
  fields: [
    { name: 'collectionSlug', type: 'text', required: true, admin: { description: 'Which collection was changed.' } },
    { name: 'docId', type: 'text', required: true, admin: { description: 'Document ID that was changed.' } },
    { name: 'changedAt', type: 'text', required: true, admin: { description: 'ISO timestamp of the change.' } },
  ],
  timestamps: true,
};
