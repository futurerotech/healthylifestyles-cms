/**
 * Fail-closed validation of a Google Search Console date-only, finalized
 * Search Analytics preflight. Dates are PT calendar dates (YYYY-MM-DD).
 *
 * A nonempty period is required before interpreting query/page detail.
 * Even a successful preflight does NOT prove complete query-row coverage.
 * No requests, secrets, logging, storage, or CMS mutations here.
 */
export interface FinalizedDateWindow {
  startDate: string;
  endDate: string;
}

export function requireFinalizedDateAvailability(
  response: unknown,
  window: FinalizedDateWindow,
): number {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new TypeError('Search Console finalized-date preflight returned an invalid response.');
  }
  const rows = (response as Record<string, unknown>).rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new RangeError('No finalized Search Console dates in the requested period; no report was produced.');
  }
  if (rows.length > 28) {
    throw new RangeError('Search Console finalized-date preflight exceeded 28 days.');
  }
  const dates = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new TypeError('Malformed finalized Search Console date row.');
    }
    const keys = (row as Record<string, unknown>).keys;
    if (!Array.isArray(keys) || keys.length !== 1 || typeof keys[0] !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(keys[0]) ||
        keys[0] < window.startDate || keys[0] > window.endDate ||
        dates.has(keys[0])) {
      throw new TypeError('Malformed, repeated or out-of-range finalized Search Console date.');
    }
    dates.add(keys[0]);
  }
  return dates.size;
}
