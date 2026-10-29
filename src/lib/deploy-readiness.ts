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

/** Accept only HTTPS Vercel deploy-hook endpoints. Never expose this URL. */
export function isValidVercelDeployHookUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !raw || raw.trim() !== raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' &&
      url.hostname === 'api.vercel.com' &&
      url.port === '' &&
      !url.username && !url.password &&
      !url.hash &&
      /^\/v1\/integrations\/deploy\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(url.pathname);
  } catch {
    return false;
  }
}
