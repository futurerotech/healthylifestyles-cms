/**
 * Consent provenance on Subscribers. Consent is captured only from the trusted signup proxy,
 * never from a client-controlled field. Evidence is frozen on update, and suppression is
 * one-way.
 */
import { describe, it, expect } from 'vitest';
import { recordConsent, isTrustedConsentCapture, Subscribers } from './Subscribers';
import { CURRENT_NOTICE_VERSION, CONSENT_CAPTURE_HEADER, CONSENT_CAPTURE_VALUE, isEligibleForMarketing } from '../lib/newsletter-suppression';

const KEY = 'test-only-internal-key'; // not a real secret
const run = (args: Record<string, unknown>) => (recordConsent as any)(args);
const headers = (h: Record<string, string>) => new Headers(h);
const trusted = () => headers({ 'x-internal-key': KEY, [CONSENT_CAPTURE_HEADER]: CONSENT_CAPTURE_VALUE });
// null means "no key configured" (undefined would fall back to the default parameter).
const withKey = <T>(fn: () => T, key: string | null = KEY): T => {
  const saved = process.env.INTERNAL_API_KEY;
  if (key === null) delete process.env.INTERNAL_API_KEY; else process.env.INTERNAL_API_KEY = key;
  try { return fn(); } finally { if (saved === undefined) delete process.env.INTERNAL_API_KEY; else process.env.INTERNAL_API_KEY = saved; }
};
const create = (data: Record<string, unknown>, h?: Headers) => run({ operation: 'create', data, req: { headers: h } });

describe('consent provenance', () => {
  it('records consent only for the trusted signup proxy, with server time, notice version and method', () => withKey(() => {
    const out = create({ email: 'a@example.com', source: 'web-form' }, trusted());
    expect(out.consentMethod).toBe('form-single-opt-in');
    expect(out.consentNoticeVersion).toBe(CURRENT_NOTICE_VERSION);
    expect(Math.abs(Date.parse(out.consentAt) - Date.now())).toBeLessThan(5000);
    expect(isEligibleForMarketing(out)).toBe(true);
  }));

  it('source spoofing: a public "web-form" source or forged consent fields never create consent', () => withKey(() => {
    const forged = { email: 'a@example.com', source: 'web-form', consentAt: '1999-01-01T00:00:00.000Z', consentNoticeVersion: 'forged', consentMethod: 'form-single-opt-in' };
    for (const h of [undefined, headers({}), headers({ [CONSENT_CAPTURE_HEADER]: CONSENT_CAPTURE_VALUE }), headers({ 'x-internal-key': 'wrong', [CONSENT_CAPTURE_HEADER]: CONSENT_CAPTURE_VALUE }), headers({ 'x-internal-key': KEY })]) {
      const out = create(forged, h);
      expect(out).toMatchObject({ consentAt: null, consentNoticeVersion: null, consentMethod: null });
      expect(isEligibleForMarketing(out)).toBe(false);
    }
  }));

  it('trusted key with a wrong capture value, or no key configured at all, never captures consent', () => {
    withKey(() => expect(isTrustedConsentCapture(headers({ 'x-internal-key': KEY, [CONSENT_CAPTURE_HEADER]: 'other' }))).toBe(false));
    withKey(() => expect(isTrustedConsentCapture(trusted())).toBe(false), null);
    withKey(() => expect(isTrustedConsentCapture(headers({ 'x-internal-key': '', [CONSENT_CAPTURE_HEADER]: CONSENT_CAPTURE_VALUE }))).toBe(false), '');
  });

  it('imports (CSV, n8n sync, API) never carry consent, whatever source they claim', () => withKey(() => {
    for (const source of ['csv-import', 'n8n-sync', 'api', 'web-form']) {
      // Sync authenticates with x-sync-secret, CSV runs as an admin: neither is the signup proxy.
      const out = create({ email: 'a@example.com', source }, headers({ 'x-sync-secret': 's' }));
      expect(out.consentMethod).toBeNull();
      expect(isEligibleForMarketing(out)).toBe(false);
    }
  }));

  it('legacy records stay without consent: updates cannot add, change or remove evidence', () => withKey(() => {
    const legacy = { email: 'old@example.com', consentAt: null, consentNoticeVersion: null, consentMethod: null };
    const out = run({ operation: 'update', data: { consentAt: '2026-11-15T00:00:00.000Z', consentNoticeVersion: 'x', consentMethod: 'form-single-opt-in' }, originalDoc: legacy, req: { headers: trusted() } });
    expect(out).toMatchObject({ consentAt: null, consentNoticeVersion: null, consentMethod: null });
    expect(isEligibleForMarketing(out)).toBe(false);
    const evidence = { consentAt: '2026-11-15T10:00:00.000Z', consentNoticeVersion: '2026-11-15', consentMethod: 'form-single-opt-in' };
    expect(run({ operation: 'update', data: { consentAt: null, consentMethod: null }, originalDoc: evidence })).toMatchObject(evidence);
  }));

  it('suppression is one-way on update', () => {
    const original = { unsubscribedAt: '2026-11-16T00:00:00.000Z', consentAt: '2026-11-15T10:00:00.000Z', consentNoticeVersion: '2026-11-15', consentMethod: 'form-single-opt-in' };
    for (const data of [{ unsubscribedAt: null }, { unsubscribedAt: '2030-01-01T00:00:00.000Z' }, {}]) {
      const out = run({ operation: 'update', data, originalDoc: original });
      expect(out.unsubscribedAt).toBe(original.unsubscribedAt);
      expect(isEligibleForMarketing(out)).toBe(false);
    }
    expect(run({ operation: 'update', data: { unsubscribedAt: '2026-12-01T00:00:00.000Z' }, originalDoc: {} }).unsubscribedAt).toBe('2026-12-01T00:00:00.000Z');
  });

  it('duplicate signups cannot re-consent: email is unique, so a resubmission is a rejected create, not an update', () => {
    const email = Subscribers.fields.find((f: any) => f.name === 'email') as any;
    expect(email.unique).toBe(true);
    expect((Subscribers.hooks?.beforeChange ?? []).includes(recordConsent)).toBe(true);
  });

  it('keeps subscriber records admin-only for read, update and delete', () => {
    const a = Subscribers.access as any;
    const anon = { req: { user: null, headers: new Headers() } };
    for (const op of ['read', 'update', 'delete']) expect(a[op](anon)).toBeFalsy();
    expect(Subscribers.fields.map((f: any) => f.name)).toEqual(expect.arrayContaining(['unsubscribedAt', 'consentAt', 'consentNoticeVersion', 'consentMethod']));
  });
});
