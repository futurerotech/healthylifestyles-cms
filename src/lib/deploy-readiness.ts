/**
 * Do not turn an unavailable or malformed Payload collection count into zero.
 * A false-zero pending queue can make the admin deploy a stale site; a
 * false-zero deploy-log count can disable the five-minute rate limit.
 */
export function verifiedCollectionCount(result: unknown): number {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Collection count unavailable');
  }
  const count = (result as { totalDocs?: unknown }).totalDocs;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    throw new Error('Invalid collection count');
  }
  return count;
}
