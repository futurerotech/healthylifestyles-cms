import type { Access, CollectionBeforeChangeHook, CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';
import { CURRENT_NOTICE_VERSION } from '../lib/newsletter-suppression';

/**
 * Server-only `create`: the Astro proxy (and admin tools) must include the
 * shared `x-internal-key` header. Direct public POSTs from the browser are
 * rejected — the proxy is the validating choke point.
 *
 * Dev fallback: if `INTERNAL_API_KEY` is unset AND `NODE_ENV !== 'production'`,
 * we allow create so local development still works without env wiring.
 */
const internalKeyCreate: Access = ({ req }) => {
  const secret = process.env.INTERNAL_API_KEY;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('x-internal-key') === secret;
};

/**
 * Consent evidence. Only web-form signups record consent, with the server's own time
 * and the current notice version. Values supplied by a client are ignored. Imports
 * (CSV, n8n, API) never get consent stamped on their behalf. On update the fields are
 * frozen, so an edit cannot rewrite the evidence.
 */
export const recordConsent: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (operation === 'create') {
    const fromForm = (data.source ?? 'web-form') === 'web-form';
    return {
      ...data,
      consentAt: fromForm ? new Date().toISOString() : null,
      consentNoticeVersion: fromForm ? CURRENT_NOTICE_VERSION : null,
    };
  }
  return { ...data, consentAt: originalDoc?.consentAt ?? null, consentNoticeVersion: originalDoc?.consentNoticeVersion ?? null };
};

export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  admin: {
    useAsTitle: 'email',
    group: 'Audience',
    defaultColumns: ['email', 'name', 'source', 'interests', 'createdAt'],
    listSearchableFields: ['email', 'name'],
    description: 'Email subscribers captured via lead forms, CSV imports, or n8n sync.',
  },
  access: { read: isAdmin, create: internalKeyCreate, update: isAdmin, delete: isAdmin },
  hooks: { beforeChange: [recordConsent] },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
      admin: { description: 'First name or full name.' },
    },
    {
      name: 'interests',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Weight Loss', value: 'weight-loss' },
        { label: 'Nutrition', value: 'nutrition' },
        { label: 'Fitness', value: 'fitness' },
        { label: 'Sleep', value: 'sleep' },
        { label: 'Heart Health', value: 'heart-health' },
        { label: 'Mental Wellness', value: 'mental-wellness' },
        { label: 'Women\'s Health', value: 'womens-health' },
        { label: 'General Wellness', value: 'general' },
      ],
      admin: { description: 'Content categories this subscriber is interested in.' },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'web-form',
      options: [
        { label: 'Web Form', value: 'web-form' },
        { label: 'CSV Import', value: 'csv-import' },
        { label: 'n8n Sync', value: 'n8n-sync' },
        { label: 'API', value: 'api' },
      ],
    },
    {
      name: 'subscribedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      admin: { readOnly: true },
    },
    {
      name: 'unsubscribedAt',
      type: 'date',
      admin: { description: 'Set when the subscriber opts out. Suppressed records must never be emailed or forwarded to email automation.' },
    },
    {
      name: 'consentAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When the person submitted the signup form. Empty for CSV and API imports, whose consent is not recorded here.',
      },
    },
    {
      name: 'consentNoticeVersion',
      type: 'text',
      admin: { readOnly: true, description: 'Version of the signup privacy notice shown at the time of consent.' },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: { description: 'Flexible extra data (tool used, source page, etc.).' },
    },
  ],
};
