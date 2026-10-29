/**
 * Offline gate for a single, bounded Search Analytics API request/response pair.
 * Does not authenticate Google's response; callers must retain provenance.
 * Fail closed on full pages: a 25k-page could have omitted additional rows.
 */
import { screenComparableGscExports, type DeclaredGscExport, type DeclaredComparableResult } from './gscExportIntegrity';
import type { GscQueryPageRow } from './searchOpportunityEngine';

export interface RawGscBatch {
  siteUrl: string;
  request: {
    startDate: string; endDate: string;
    dimensions: readonly string[];
    type: string;
    dataState: string;
    aggregationType: string;
    rowLimit: number; startRow: number;
    dimensionFilterGroups?: unknown;
  };
  response: { rows?: readonly GscQueryPageRow[]; responseAggregationType?: string };
}

function canonicalFilters(filters: unknown): string {
  if (filters === undefined) return 'none';
  // Complex filter rules are not reconstructed or silently ignored.
  if (typeof filters !== 'string' || !filters || filters.trim() !== filters ||
      filters.length > 2048) {
    throw new RangeError('Complex Search Analytics filters require separate audited pagination and canonicalization.');
  }
  return filters;
}

function checkedBatch(batch: RawGscBatch): DeclaredGscExport {
  if (!batch || !batch.request || !batch.response || !Array.isArray(batch.response.rows)) {
    throw new TypeError('A declared raw GSC request and response rows are required.');
  }
  const req = batch.request;
  if (!Number.isSafeInteger(req.rowLimit) || req.rowLimit < 1 || req.rowLimit > 25000 ||
      req.startRow !== 0 || batch.response.rows.length >= req.rowLimit) {
    throw new RangeError('Only first-page, bounded, non-full GSC exports are supported; a full page may be incomplete.');
  }
  // A response may advertise its actual aggregation type; disagreeing
  // response/request values cannot be compared as equivalent exports.
  // Google's auto aggregation may resolve to byPage for query+page data.
  // The actual response aggregation is what must match across periods.
  const actualAggregation = batch.response.responseAggregationType ?? req.aggregationType;
  if (actualAggregation !== 'byPage' ||
      !['auto', 'byPage'].includes(req.aggregationType)) {
    throw new RangeError('GSC query+page export must use page-level aggregation.');
  }
  if (req.dimensionFilterGroups !== undefined) {
    throw new RangeError('Dimension filters require an authenticated, reviewed ingestion adapter.');
  }
  return {
    siteUrl: batch.siteUrl,
    rows: batch.response.rows,
    startDate: req.startDate,
    endDate: req.endDate,
    dimensions: req.dimensions,
    searchType: req.type,
    dataState: req.dataState,
    aggregationType: actualAggregation,
    country: null,
    device: null,
    additionalFiltersFingerprint: canonicalFilters(undefined),
  };
}

export function screenBoundedRawGscBatches(
  current: RawGscBatch,
  previous: RawGscBatch,
): DeclaredComparableResult {
  return screenComparableGscExports(checkedBatch(current), checkedBatch(previous));
}
