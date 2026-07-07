import type { CollectionConfig } from 'payload';
import { isAdminOrEditor, publicRead } from '../access/roles';

/**
 * AI SEO Autopilot — audit log (§2 Module A).
 * Each run records what was scanned, what was found, and the proposed fixes.
 * Phase 1: read-and-report only. No content mutations.
 */
export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  admin: {
    group: 'Autopilot',
    useAsTitle: 'runId',
    defaultColumns: ['runId', 'type', 'status', 'createdAt'],
    listSearchableFields: ['runId', 'type'],
  },
  access: {
    read: isAdminOrEditor,
    create: isAdminOrEditor,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'runId', type: 'text', required: true, admin: { description: 'Unique run identifier (e.g. "2026-07-07-meta-desc").' } },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'meta-description',
      options: [
        { label: 'Meta descriptions', value: 'meta-description' },
        { label: 'Broken links', value: 'broken-links' },
        { label: 'Keyword cannibalization', value: 'cannibalization' },
        { label: 'Schema/JSON-LD', value: 'schema' },
        { label: 'Full audit', value: 'full' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'completed',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Running', value: 'running' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    { name: 'scannedCount', type: 'number', admin: { description: 'Number of items scanned.' } },
    { name: 'issueCount', type: 'number', admin: { description: 'Number of issues found.' } },
    {
      name: 'findings',
      type: 'json',
      admin: { description: 'Structured findings array (issue, severity, proposed fix).' },
    },
    { name: 'summary', type: 'textarea', admin: { description: 'Human-readable summary of the run.' } },
  ],
  timestamps: true,
};
