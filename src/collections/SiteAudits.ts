import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrEditor } from '../access/roles';

/**
 * Site Audit runs. One doc per scan of the live site (see src/lib/siteAudit.ts).
 * Created by POST /api/audit/run — the scan itself is async; the doc flips from
 * "running" to "complete" (or "failed") when it finishes. Issues are stored as
 * a single JSON blob (hundreds of rows would make a Payload array field crawl);
 * the dashboard panel is the reading UI. The audit NEVER edits content.
 */
export const SiteAudits: CollectionConfig = {
  slug: 'site-audits',
  labels: { singular: 'Site Audit', plural: 'Site Audits' },
  admin: {
    group: 'SEO',
    useAsTitle: 'status',
    defaultColumns: ['createdAt', 'status', 'healthScore', 'highCount', 'mediumCount', 'lowCount', 'pagesScanned'],
    description: 'Read-only scan results. Run a new scan from the dashboard (or POST /api/audit/run).',
  },
  access: { read: isAdminOrEditor, create: () => false, update: () => false, delete: isAdmin },
  fields: [
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'running',
      index: true,
      options: [
        { label: 'Running', value: 'running' },
        { label: 'Complete', value: 'complete' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'healthScore', type: 'number', admin: { width: '20%', description: '100 = clean; −5/high, −2/medium, −0.5/low.' } },
        { name: 'pagesScanned', type: 'number', admin: { width: '20%' } },
        { name: 'highCount', type: 'number', admin: { width: '20%' } },
        { name: 'mediumCount', type: 'number', admin: { width: '20%' } },
        { name: 'lowCount', type: 'number', admin: { width: '20%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'startedAt', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'finishedAt', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    { name: 'error', type: 'text', admin: { description: 'Populated only when the scan failed.' } },
    { name: 'issues', type: 'json', admin: { description: 'Array of { severity, category, page, message, fix, adminPath? }.' } },
  ],
  timestamps: true,
};
