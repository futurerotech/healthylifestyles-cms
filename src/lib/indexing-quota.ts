/**
 * Lightweight daily quota tracker for the Google APIs.
 *
 * Fallback in-memory store (per process) with a 24h reset keyed on the UTC
 * date — swap for Redis/Upstash by replacing the four functions below if you
 * need cross-instance accuracy. Two independent buckets:
 *   - publish: Indexing API free-tier limit (200/day) — the constraining one.
 *   - inspect: URL Inspection limit (~2,000/day).
 */

export type QuotaType = 'publish' | 'inspect';

export const QUOTA_LIMITS: Record<QuotaType, number> = {
  publish: 200,
  inspect: 2000,
};

interface Bucket {
  day: string; // UTC YYYY-MM-DD
  count: number;
}

const buckets = new Map<QuotaType, Bucket>();

const utcDay = (): string => new Date().toISOString().slice(0, 10);

function bucketFor(type: QuotaType): Bucket {
  const existing = buckets.get(type);
  const day = utcDay();
  if (!existing || existing.day !== day) {
    const fresh: Bucket = { day, count: 0 };
    buckets.set(type, fresh);
    return fresh;
  }
  return existing;
}

export interface QuotaState {
  used: number;
  remaining: number;
  limit: number;
}

export function getQuota(type: QuotaType): QuotaState {
  const b = bucketFor(type);
  const limit = QUOTA_LIMITS[type];
  return { used: b.count, remaining: Math.max(0, limit - b.count), limit };
}

/** Would consuming `n` stay within the daily limit? */
export function canConsume(type: QuotaType, n = 1): boolean {
  return bucketFor(type).count + n <= QUOTA_LIMITS[type];
}

/** Record `n` used requests. Returns the updated state. */
export function consumeQuota(type: QuotaType, n = 1): QuotaState {
  bucketFor(type).count += n;
  return getQuota(type);
}
