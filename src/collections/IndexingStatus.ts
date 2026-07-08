import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';

export const IndexingStatus: CollectionConfig = {
  slug: 'indexing-status',
  admin: {
    group: 'SEO',
    useAsTitle: 'url',
    defaultColumns: ['url', 'engine', 'status', 'verdict', 'coverageState', 'inspectedAt'],
    listSearchableFields: ['url', 'docSlug'],
    description: 'Index submission history + GSC URL Inspection results.',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'docType', type: 'text', required: true, admin: { readOnly: true, description: 'Collection slug (tools, articles, pages).' } },
    { name: 'docSlug', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'url', type: 'text', required: true, admin: { readOnly: true } },
    {
      name: 'engine',
      type: 'select',
      required: true,
      options: [
        { label: 'IndexNow (auto)', value: 'https://api.indexnow.org/indexnow' },
        { label: 'Bing', value: 'https://www.bing.com/indexnow' },
        { label: 'Yandex', value: 'https://search.yandex.com/indexnow' },
        { label: 'Google', value: 'google' },
        { label: 'GSC Inspection', value: 'gsc-inspection' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    { name: 'httpStatus', type: 'number', admin: { readOnly: true } },
    { name: 'error', type: 'textarea', admin: { readOnly: true } },
    { name: 'submittedAt', type: 'date', required: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    // GSC URL Inspection fields (§3)
    { name: 'verdict', type: 'text', admin: { readOnly: true, description: 'GSC inspection verdict (PASS/FAIL/NEUTRAL).' } },
    { name: 'coverageState', type: 'text', admin: { readOnly: true, description: 'e.g. "Submitted and indexed", "Discovered — currently not indexed".' } },
    { name: 'lastCrawled', type: 'text', admin: { readOnly: true, description: 'Last crawl timestamp from GSC.' } },
    { name: 'canonicalGoogle', type: 'text', admin: { readOnly: true, description: 'Canonical URL Google chose.' } },
    { name: 'canonicalDeclared', type: 'text', admin: { readOnly: true, description: 'Canonical URL declared on the page.' } },
    { name: 'inspectedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
  ],
};
