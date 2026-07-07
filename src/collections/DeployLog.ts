import type { CollectionConfig } from 'payload';
import { isAdminOrEditor } from '../access/roles';

/**
 * AI SEO Autopilot — deploy log (§7.3).
 * Read-only audit trail of every manual deploy trigger.
 */
export const DeployLog: CollectionConfig = {
  slug: 'deploy-log',
  admin: {
    group: 'Autopilot',
    useAsTitle: 'createdAt',
    defaultColumns: ['triggeredBy', 'createdAt'],
    listSearchableFields: ['triggeredBy'],
  },
  access: {
    read: isAdminOrEditor,
    create: () => true,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'triggeredBy', type: 'text', admin: { description: 'Email of the user who triggered the deploy.' } },
    { name: 'pendingCount', type: 'number', admin: { description: 'Number of pending changes cleared by this deploy.' } },
  ],
  timestamps: true,
};
