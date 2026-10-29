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


/**
 * Validate captured pages before scoring. Offsets must be contiguous and the
 * final page short, otherwise a partially exported result is not trustworthy.
 * This does not claim Google returned every low-volume query.
 */
export function screenPaginatedRawGscBatches(
  current: readonly RawGscBatch[],
  previous: readonly RawGscBatch[],
): DeclaredComparableResult {
  const collect = (pages: readonly RawGscBatch[]): DeclaredGscExport => {
    if (!Array.isArray(pages) || !pages.length || pages.length > 1000) {
      throw new RangeError('Invalid number of Search Analytics pages.');
    }
    const base = pages[0];
    const first = checkedBatch({
      ...base,
      response: { ...base.response, rows: (base.response.rows ?? []).slice(0, Math.max(0, base.request.rowLimit - 1)) },
    });
    if (base.request.rowLimit < 1 || base.request.rowLimit > 25000) {
      throw new RangeError('Invalid Search Analytics row limit.');
    }
    const rows: GscQueryPageRow[] = [];
    let offset = 0;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const list = page?.response?.rows;
      if (!Array.isArray(list) || page.siteUrl !== base.siteUrl ||
          page.request.startDate !== base.request.startDate ||
          page.request.endDate !== base.request.endDate ||
          page.request.rowLimit !== base.request.rowLimit ||
          page.request.startRow !== offset ||
          page.request.type !== base.request.type ||
          page.request.dataState !== base.request.dataState ||
          page.request.aggregationType !== base.request.aggregationType ||
          page.request.dimensionFilterGroups !== undefined ||
          JSON.stringify(page.request.dimensions) !== JSON.stringify(base.request.dimensions) ||
          (page.response.responseAggregationType ?? page.request.aggregationType) !== first.aggregationType) {
        throw new RangeError('Mismatched GSC page or non-contiguous offset.');
      }
      if (list.length > base.request.rowLimit ||
          (i < pages.length - 1 && list.length !== base.request.rowLimit) ||
          (i === pages.length - 1 && list.length === base.request.rowLimit)) {
        throw new RangeError('GSC pages must end with a short or empty terminal page.');
      }
      offset += list.length;
      if (offset > 25000) throw new RangeError('Screening row limit exceeded.');
      rows.push(...list);
    }
    return { ...first, rows };
  };
  return screenComparableGscExports(collect(current), collect(previous));
}
