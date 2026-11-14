/** Newsletter safety: signed expiring unsubscribe tokens and suppression. */
import { describe, it, expect } from 'vitest';
import {
  createUnsubscribeToken, verifyUnsubscribeToken, isSendable, SENDABLE_WHERE, tokenSecret, unsubscribeUrl, MIN_SECRET_LENGTH,
} from './newsletter-suppression';

const SECRET = 'test-only-secret-0123456789abcdef-0123'; // not a real secret
const NOW = Date.UTC(2026, 10, 15);

describe('unsubscribe tokens', () => {
  it('round-trips the subscriber ID and contains no email address', () => {
    const t = createUnsubscribeToken(42, SECRET, { now: NOW });
    expect(verifyUnsubscribeToken(t, SECRET, { now: NOW })).toEqual({ ok: true, subscriberId: '42' });
    expect(t).not.toMatch(/@/);
    expect(Buffer.from(t.split('.')[1], 'base64url').toString()).not.toMatch(/@/);
  });

  it('is non-guessable: two tokens for the same subscriber differ', () => {
    expect(createUnsubscribeToken(42, SECRET, { now: NOW })).not.toBe(createUnsubscribeToken(42, SECRET, { now: NOW }));
  });

  it('expires', () => {
    const t = createUnsubscribeToken(42, SECRET, { now: NOW, ttlDays: 1 });
    expect(verifyUnsubscribeToken(t, SECRET, { now: NOW + 86_399_000 }).ok).toBe(true);
    expect(verifyUnsubscribeToken(t, SECRET, { now: NOW + 86_400_000 }).ok).toBe(false);
  });

  it('rejects tampering, another subscriber ID, the wrong secret and malformed input', () => {
    const t = createUnsubscribeToken(42, SECRET, { now: NOW });
    const [v, body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), s: '43' })).toString('base64url');
    expect(verifyUnsubscribeToken(`${v}.${forged}.${sig}`, SECRET, { now: NOW }).ok).toBe(false);
    expect(verifyUnsubscribeToken(t, SECRET + 'x', { now: NOW }).ok).toBe(false);
    expect(verifyUnsubscribeToken(t.slice(0, -2), SECRET, { now: NOW }).ok).toBe(false);
    for (const bad of [null, 42, '', 'v1..', 'v2.' + body + '.' + sig, 'x'.repeat(600), `${v}.${body}.${sig}.extra`]) {
      expect(verifyUnsubscribeToken(bad, SECRET, { now: NOW }).ok).toBe(false);
    }
    expect(verifyUnsubscribeToken(t, null, { now: NOW }).ok).toBe(false);
  });

  it('refuses to sign with a missing or short secret, and validates the TTL', () => {
    expect(() => createUnsubscribeToken(1, 'short')).toThrow();
    expect(() => createUnsubscribeToken(1, SECRET, { ttlDays: 0 })).toThrow();
    expect(() => createUnsubscribeToken(1, SECRET, { ttlDays: 1000 })).toThrow();
    expect(tokenSecret({ UNSUBSCRIBE_TOKEN_SECRET: 'x'.repeat(MIN_SECRET_LENGTH - 1) } as NodeJS.ProcessEnv)).toBeNull();
    expect(tokenSecret({ UNSUBSCRIBE_TOKEN_SECRET: SECRET } as NodeJS.ProcessEnv)).toBe(SECRET);
    expect(tokenSecret({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('builds a site link that carries only the token', () => {
    const u = new URL(unsubscribeUrl('v1.a.b', 'https://www.example.com/'));
    expect(u.pathname).toBe('/unsubscribe');
    expect([...u.searchParams.keys()]).toEqual(['t']);
  });
});

describe('suppression', () => {
  it('never treats an unsubscribed record as sendable', () => {
    expect(isSendable({ unsubscribedAt: '2026-11-15T00:00:00.000Z' })).toBe(false);
    expect(isSendable({ unsubscribedAt: null })).toBe(true);
    expect(isSendable({})).toBe(true);
    expect(isSendable(null)).toBe(false);
    expect(SENDABLE_WHERE).toEqual({ unsubscribedAt: { exists: false } });
  });
});
