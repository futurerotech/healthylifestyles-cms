/**
 * Provider-independent newsletter safety: signed unsubscribe tokens and suppression.
 *
 * Tokens carry only an opaque subscriber ID, an expiry and a random nonce, signed with
 * HMAC-SHA256. They contain no email address, so a leaked link reveals nothing about the
 * person. Verification is constant-time and rejects malformed, tampered or expired tokens
 * with the same generic result.
 *
 * Suppression: a subscriber with `unsubscribedAt` set must never be emailed or forwarded
 * to an email automation. Every sending or forwarding path must go through
 * `isSendable` / `SENDABLE_WHERE`.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOKEN_VERSION = 'v1';
/** Default link lifetime. Senders should mint a fresh link for every email they send. */
export const DEFAULT_TTL_DAYS = 90;
export const MIN_SECRET_LENGTH = 32;

/** Version of the signup notice shown next to the form; recorded as consent evidence. */
export const CURRENT_NOTICE_VERSION = '2026-11-15';

export type VerifyResult = { ok: true; subscriberId: string } | { ok: false };

const b64u = (b: Buffer) => b.toString('base64url');

export function tokenSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env.UNSUBSCRIBE_TOKEN_SECRET?.trim();
  return s && s.length >= MIN_SECRET_LENGTH ? s : null;
}

const sign = (secret: string, body: string) => createHmac('sha256', secret).update(`${TOKEN_VERSION}.${body}`).digest();

export function createUnsubscribeToken(
  subscriberId: string | number,
  secret: string,
  { now = Date.now(), ttlDays = DEFAULT_TTL_DAYS }: { now?: number; ttlDays?: number } = {},
): string {
  if (!secret || secret.length < MIN_SECRET_LENGTH) throw new Error('UNSUBSCRIBE_TOKEN_SECRET is missing or too short');
  if (!(ttlDays > 0 && ttlDays <= 400)) throw new Error('ttlDays out of range');
  const payload = { s: String(subscriberId), e: Math.floor(now / 1000) + Math.round(ttlDays * 86400), n: b64u(randomBytes(12)) };
  const body = b64u(Buffer.from(JSON.stringify(payload)));
  return `${TOKEN_VERSION}.${body}.${b64u(sign(secret, body))}`;
}

export function verifyUnsubscribeToken(token: unknown, secret: string | null, { now = Date.now() }: { now?: number } = {}): VerifyResult {
  if (!secret || typeof token !== 'string' || token.length > 512) return { ok: false };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION || !/^[A-Za-z0-9_-]+$/.test(parts[1] + parts[2])) return { ok: false };
  const expected = sign(secret, parts[1]);
  const given = Buffer.from(parts[2], 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false };
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof p?.s !== 'string' || !p.s || typeof p?.e !== 'number') return { ok: false };
    if (p.e * 1000 <= now) return { ok: false };
    return { ok: true, subscriberId: p.s };
  } catch {
    return { ok: false };
  }
}

/** Payload `where` clause for the only subscribers any sender may contact. */
export const SENDABLE_WHERE = { unsubscribedAt: { exists: false } } as const;

export function isSendable(sub: { unsubscribedAt?: string | Date | null } | null | undefined): boolean {
  return !!sub && !sub.unsubscribedAt;
}

/** Public unsubscribe page URL for a token (the site's /unsubscribe page posts it back). */
export function unsubscribeUrl(token: string, siteBase = process.env.SITE_BASE_URL || 'https://www.healthylifesstyles.com'): string {
  return `${siteBase.replace(/\/$/, '')}/unsubscribe?t=${encodeURIComponent(token)}`;
}
