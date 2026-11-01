/**
 * Fail-closed structural comparison of two DECLARED Google Search Analytics
 * query+page exports. Pure/offline: no credentials, network or writes.
 *
 * The metadata is provided by the caller, NOT authenticated here. Callers
 * must establish provenance and authorization outside this module.
 *
 * Search Console uses inclusive dates in America/Los_Angeles (PT), not UTC.
 * Keep this calendar-only validation separate from UTC timestamp conversion.
 */
import {
  screenSearchOpportunities,
  type GscQueryPageRow,
  type ScreeningResult,
} from './searchOpportunityEngine';

export interface DeclaredGscExport {
  rows: readonly GscQueryPageRow[];
  /** Exact GSC property identifier from the Search Analytics API request. */
  siteUrl: string;
  /** Inclusive PT dates, YYYY-MM-DD. */
  startDate: string;
  endDate: string;
  /** Query dimensions must match the order of rows[].keys. */
  dimensions: readonly string[];
  /** GSC type, v1 supports only regular web search. */
  searchType: string;
  /** Search Analytics request: only finalized data are comparable. */
  dataState: string;
  /** Search Analytics request aggregationType. */
  aggregationType: string;
  /** Explicit null means unfiltered; otherwise GSC 3-letter country code. */
  country: string | null;
  /** Explicit null means unfiltered; otherwise DESKTOP, MOBILE or TABLET. */
  device: string | null;
  /**
   * Caller-declared canonical identifier for all OTHER request filters.
   * Use 'none' only if no additional filter was used. Two different filters
   * must never share a fingerprint. This cannot prove the claim is truthful.
   */
  additionalFiltersFingerprint: string;
}

export interface DeclaredComparableResult extends ScreeningResult {
  declaredScope: {
    siteUrl: string;
    previousStartDate: string;
    previousEndDate: string;
    currentStartDate: string;
    currentEndDate: string;
    timeZone: 'America/Los_Angeles';
    country: string | null;
    device: string | null;
    searchType: 'web';
    /** Metadata was only checked for consistency, not authenticated. */
    sourceAuthenticated: false;
  };
}

const DAY_MS = 86_400_000;
const GSC_PROPERTIES = new Set([
  'sc-domain:healthylifesstyles.com',
  'https://www.healthylifesstyles.com/',
]);

function calendarDay(iso: string): number {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new RangeError('GSC date must have YYYY-MM-DD format.');
  }
  const [year, month, day] = iso.split('-').map(Number);
  if (year < 2000 || year > 2100) throw new RangeError('GSC date year is out of range.');
  const value = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== iso) {
    throw new RangeError('Invalid GSC calendar date.');
  }
  return value.getTime() / DAY_MS;
}

function verifyEnvelope(value: DeclaredGscExport): { start: number; end: number } {
  if (!value || typeof value !== 'object' || !Array.isArray(value.rows)) {
    throw new TypeError('GSC export must include an array of rows.');
  }
  if (!GSC_PROPERTIES.has(value.siteUrl)) {
    throw new RangeError('Export property is not the approved HealthyLifeStyles Search Console property.');
  }
  if (!Array.isArray(value.dimensions) || value.dimensions.length !== 2 ||
      value.dimensions[0] !== 'query' || value.dimensions[1] !== 'page') {
    throw new RangeError('Export must be grouped by dimensions [query, page] in that order.');
  }
  if (value.searchType !== 'web' || value.dataState !== 'final' ||
      !['auto', 'byPage'].includes(value.aggregationType)) {
    throw new RangeError('Only finalized web search page-aggregated exports are comparable.');
  }
  if (value.country !== null &&
      (typeof value.country !== 'string' || !/^[a-z]{3}$/i.test(value.country))) {
    throw new RangeError('Country must be null or a three-letter GSC country code.');
  }
  if (value.device !== null && !['DESKTOP', 'MOBILE', 'TABLET'].includes(value.device)) {
    throw new RangeError('Device must be null or a valid GSC device filter.');
  }
  if (typeof value.additionalFiltersFingerprint !== 'string' ||
      !value.additionalFiltersFingerprint ||
      value.additionalFiltersFingerprint.length > 2048 ||
      value.additionalFiltersFingerprint !== value.additionalFiltersFingerprint.trim()) {
    throw new RangeError('Declare an exact fingerprint for any additional request filters.');
  }
  const start = calendarDay(value.startDate);
  const end = calendarDay(value.endDate);
  if (end - start !== 27) {
    throw new RangeError('Each Search Console comparison period must contain exactly 28 inclusive PT days.');
  }
  return { start, end };
}

/**
 * Requires two adjacent, equal-length, consistently filtered periods.
 * On incompatibility, throws without producing a misleading growth score.
 */
export function screenComparableGscExports(
  current: DeclaredGscExport,
  previous: DeclaredGscExport,
): DeclaredComparableResult {
  const c = verifyEnvelope(current);
  const p = verifyEnvelope(previous);
  if (p.end + 1 !== c.start) {
    throw new RangeError('GSC windows must be adjacent, non-overlapping 28-day periods.');
  }
  if (current.siteUrl !== previous.siteUrl ||
      current.searchType !== previous.searchType ||
      current.aggregationType !== previous.aggregationType ||
      current.country?.toLowerCase() !== previous.country?.toLowerCase() ||
      current.device !== previous.device ||
      current.additionalFiltersFingerprint !== previous.additionalFiltersFingerprint) {
    throw new RangeError('Search Console property, aggregation and filter scopes must match.');
  }

  const result = screenSearchOpportunities(current.rows, previous.rows);
  return {
    ...result,
    caveats: [
      'Export metadata is caller-declared, not authenticated by this offline function. Verify the original GSC API requests and authorized property access.',
      'Search Console dates are inclusive in America/Los_Angeles (PT); compare only completed, finalized windows.',
      'Search Analytics may return only top rows rather than all queries; changes are not a complete market or site census.',
      ...result.caveats,
    ],
    declaredScope: {
      siteUrl: current.siteUrl,
      previousStartDate: previous.startDate,
      previousEndDate: previous.endDate,
      currentStartDate: current.startDate,
      currentEndDate: current.endDate,
      timeZone: 'America/Los_Angeles',
      country: current.country,
      device: current.device,
      searchType: 'web',
      sourceAuthenticated: false,
    },
  };
}
