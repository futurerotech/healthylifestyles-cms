import type { Access, CollectionBeforeChangeHook, CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';
import { timingSafeEqual } from 'node:crypto';
import { CONSENT_CAPTURE_HEADER, CONSENT_CAPTURE_VALUE, CURRENT_NOTICE_VERSION } from '../lib/newsletter-suppression';

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
 * True only for a create made by the trusted signup proxy: it presents the configured
 * INTERNAL_API_KEY (constant-time compare) AND the consent-capture header. Nothing in
 * the request body counts. `source` is descriptive only, because public callers can
 * influence it. With no key configured, consent is never captured, in any environment.
 */
export function isTrustedConsentCapture(headers: Headers | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = env.INTERNAL_API_KEY?.trim();
  if (!secret || !headers) return false;
  const given = headers.get('x-internal-key') ?? '';
  const a = Buffer.from(given), b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return headers.get(CONSENT_CAPTURE_HEADER) === CONSENT_CAPTURE_VALUE;
}

/**
 * Consent evidence. Recorded only for trusted signup-proxy creates, using the server's
 * own time, the current notice version and the method 'form-single-opt-in'. This is
 * evidence of a form submission, not verified mailbox ownership. Client-supplied values,
 * `source`, CSV, n8n and API imports never set consent. On update the fields are frozen,
 * so neither an admin edit nor an import can create or rewrite the evidence. A legacy
 * record therefore stays without consent, and stays ineligible.
 */
export const recordConsent: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
  if (operation === 'create') {
    const trusted = isTrustedConsentCapture(req?.headers);
    return {
      ...data,
      consentAt: trusted ? new Date().toISOString() : null,
      consentNoticeVersion: trusted ? CURRENT_NOTICE_VERSION : null,
      consentMethod: trusted ? 'form-single-opt-in' : null,
    };
  }
  return {
    ...data,
    consentAt: originalDoc?.consentAt ?? null,
    consentNoticeVersion: originalDoc?.consentNoticeVersion ?? null,
    consentMethod: originalDoc?.consentMethod ?? null,
    // Suppression is one-way: once set, an update cannot clear or move the opt-out date.
    ...(originalDoc?.unsubscribedAt ? { unsubscribedAt: originalDoc.unsubscribedAt } : {}),
  };
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
        description: 'When the trusted signup proxy recorded a newsletter form submission. Not verified mailbox ownership. Empty for legacy records and for CSV, n8n and API imports: those are NOT eligible for marketing email.',
      },
    },
    {
      name: 'consentNoticeVersion',
      type: 'text',
      admin: { readOnly: true, description: 'Version of the signup privacy notice shown at the time of consent.' },
    },
    {
      name: 'consentMethod',
      type: 'text',
      admin: { readOnly: true, description: 'Set only by the server: "form-single-opt-in" (a form submission, not mailbox-verified). How consent was captured. Empty means unknown consent, and the record is ineligible for marketing email.' },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: { description: 'Flexible extra data (tool used, source page, etc.).' },
    },
  ],
};
