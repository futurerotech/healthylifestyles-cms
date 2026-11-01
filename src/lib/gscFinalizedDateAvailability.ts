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

function isRealUtcCalendarDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date;
}

export function requireFinalizedDateAvailability(
  response: unknown,
  window: FinalizedDateWindow,
): number {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new TypeError('Search Console finalized-date preflight returned an invalid response.');
  }
  const providerResponse = response as Record<string, unknown>;
  // Final date-only requests use the documented Search Analytics response
  // fields. Reject provider error envelopes even if a rows field is present.
  if (Object.keys(providerResponse).some(
    key => key !== 'rows' && key !== 'responseAggregationType',
  ) || (providerResponse.responseAggregationType !== undefined &&
    !['auto', 'byPage', 'byProperty'].includes(String(providerResponse.responseAggregationType)))) {
    throw new TypeError('Unexpected finalized-date provider response envelope.');
  }
  const rows = providerResponse.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new RangeError('No finalized Search Console dates in the requested period; no report was produced.');
  }
  if (rows.length > 28) {
    throw new RangeError('Search Console finalized-date preflight exceeded 28 days.');
  }
  const dates = new Set<string>();
  let previousDate = '';
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new TypeError('Malformed finalized Search Console date row.');
    }
    // A date-shaped row can still be a malformed provider/error object.
    // Reject unknown nested fields rather than treating a partial error as
    // successful evidence that finalized date data were returned.
    const fields = row as Record<string, unknown>;
    if (Object.keys(fields).some(key => !['keys', 'clicks', 'impressions', 'ctr', 'position'].includes(key))) {
      throw new TypeError('Unexpected finalized Search Console date row field.');
    }
    const keys = fields.keys;
    if (!Array.isArray(keys) || keys.length !== 1 || typeof keys[0] !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(keys[0]) ||
        !isRealUtcCalendarDate(keys[0]) ||
        keys[0] < window.startDate || keys[0] > window.endDate ||
        keys[0] <= previousDate || dates.has(keys[0])) {
      throw new TypeError('Malformed, repeated or out-of-range finalized Search Console date.');
    }
    dates.add(keys[0]);
    previousDate = keys[0];
  }
  return dates.size;
}
