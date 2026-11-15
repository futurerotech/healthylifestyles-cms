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
 * `isEligibleForMarketing` / `ELIGIBLE_WHERE`, which also require recorded consent.
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

/**
 * Consent methods the CMS can record itself. `form-single-opt-in` means the trusted
 * server-side signup proxy created the record after a person submitted the newsletter
 * form, with the privacy notice shown. It is NOT verified mailbox ownership (there is
 * no double opt-in) and NOT a legal review. It is evidence of a form submission only.
 */
export const CONSENT_METHODS = ['form-single-opt-in'] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

/**
 * Methods accepted as affirmative eligibility for marketing email. Fail-closed: anything
 * not listed here (unknown, imported, legacy, null) is ineligible. Widening this list,
 * or adding a confirmed double-opt-in method, is an owner and legal decision.
 */
export const ELIGIBLE_CONSENT_METHODS: readonly ConsentMethod[] = ['form-single-opt-in'];

/** Header the trusted signup proxy sends with x-internal-key to request consent capture. */
export const CONSENT_CAPTURE_HEADER = 'x-consent-capture';
export const CONSENT_CAPTURE_VALUE = 'newsletter-form-v1';

type SubLike = {
  unsubscribedAt?: string | Date | null;
  consentAt?: string | Date | null;
  consentNoticeVersion?: string | null;
  consentMethod?: string | null;
} | null | undefined;

/** Unsubscribed (suppressed). Suppression always wins over any consent record. */
export function isSuppressed(sub: SubLike): boolean {
  return !!sub?.unsubscribedAt;
}

/** True only when the record carries complete consent evidence from an eligible method. */
export function hasEligibleConsent(sub: SubLike): boolean {
  return !!sub && !!sub.consentAt && !!sub.consentNoticeVersion
    && (ELIGIBLE_CONSENT_METHODS as readonly string[]).includes(String(sub.consentMethod ?? ''));
}

/**
 * Affirmative eligibility to receive marketing email: present, not suppressed, AND with
 * eligible consent evidence. "Not unsubscribed" alone is never enough, so legacy and
 * imported records without recorded consent are ineligible.
 */
export function isEligibleForMarketing(sub: SubLike): boolean {
  return !!sub && !isSuppressed(sub) && hasEligibleConsent(sub);
}

/** Payload `where` clause equivalent of isEligibleForMarketing, for any bulk selection. */
export const ELIGIBLE_WHERE = {
  and: [
    { unsubscribedAt: { exists: false } },
    { consentAt: { exists: true } },
    { consentNoticeVersion: { exists: true } },
    { consentMethod: { in: [...ELIGIBLE_CONSENT_METHODS] } },
  ],
} as const;

/** Public unsubscribe page URL for a token (the site's /unsubscribe page posts it back). */
export function unsubscribeUrl(token: string, siteBase = process.env.SITE_BASE_URL || 'https://www.healthylifesstyles.com'): string {
  return `${siteBase.replace(/\/$/, '')}/unsubscribe?t=${encodeURIComponent(token)}`;
}
