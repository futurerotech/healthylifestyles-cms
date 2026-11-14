/** Consent evidence on Subscribers: server-stamped for web-form signups only, frozen on update. */
import { describe, it, expect } from 'vitest';
import { recordConsent, Subscribers } from './Subscribers';
import { CURRENT_NOTICE_VERSION } from '../lib/newsletter-suppression';

const run = (args: Record<string, unknown>) => (recordConsent as any)(args);

describe('recordConsent', () => {
  it('stamps server time and notice version for web-form signups, ignoring client values', () => {
    const out = run({ operation: 'create', data: { email: 'a@example.com', source: 'web-form', consentAt: '1999-01-01T00:00:00.000Z', consentNoticeVersion: 'forged' } });
    expect(out.consentNoticeVersion).toBe(CURRENT_NOTICE_VERSION);
    expect(Math.abs(Date.parse(out.consentAt) - Date.now())).toBeLessThan(5000);
  });

  it('treats a missing source as the web form (the collection default)', () => {
    expect(run({ operation: 'create', data: { email: 'a@example.com' } }).consentNoticeVersion).toBe(CURRENT_NOTICE_VERSION);
  });

  it('never stamps consent for imports', () => {
    for (const source of ['csv-import', 'n8n-sync', 'api']) {
      const out = run({ operation: 'create', data: { email: 'a@example.com', source, consentAt: '2026-01-01T00:00:00.000Z' } });
      expect(out.consentAt).toBeNull();
      expect(out.consentNoticeVersion).toBeNull();
    }
  });

  it('freezes consent evidence on update', () => {
    const originalDoc = { consentAt: '2026-11-15T10:00:00.000Z', consentNoticeVersion: '2026-11-15' };
    const out = run({ operation: 'update', data: { consentAt: null, consentNoticeVersion: 'x', unsubscribedAt: '2026-12-01T00:00:00.000Z' }, originalDoc });
    expect(out).toMatchObject({ ...originalDoc, unsubscribedAt: '2026-12-01T00:00:00.000Z' });
  });

  it('keeps subscriber records admin-only for read, update and delete', () => {
    const a = Subscribers.access as any;
    const anon = { req: { user: null, headers: new Headers() } };
    for (const op of ['read', 'update', 'delete']) expect(a[op](anon)).toBeFalsy();
    expect(Subscribers.fields.map((f: any) => f.name)).toEqual(expect.arrayContaining(['unsubscribedAt', 'consentAt', 'consentNoticeVersion']));
  });
});
