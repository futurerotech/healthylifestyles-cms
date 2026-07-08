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
    // Read-only in the admin panel: no manual create/edit/delete. The /api/deploy
    // endpoint writes entries through the Local API (overrideAccess: true by
    // default), so logging still works with every mutation denied here.
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'triggeredBy', type: 'email', admin: { readOnly: true, description: 'Email of the user who triggered the deploy.' } },
    { name: 'pendingCount', type: 'number', admin: { readOnly: true, description: 'Number of pending changes cleared by this deploy.' } },
  ],
  timestamps: true,
};
