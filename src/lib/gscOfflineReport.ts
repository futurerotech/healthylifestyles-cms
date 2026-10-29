import { screenPaginatedRawGscBatches, type RawGscBatch } from './gscRawRequestGate';

import type { Opportunity } from './searchOpportunityEngine';

/**
 * Group observed, individually screened query/page observations by the
 * existing canonical page. This is NOT semantic intent clustering and summed
 * metrics cover qualifying, visible query rows only (not total page traffic).
 */
export function groupExistingPageCandidates(items: readonly Opportunity[]) {
  type Sample = {
    query: string;
    priorityScore: number;
    impressions28d: number;
    medicalReviewRequired: boolean;
  };
  type PageCandidate = {
    page: string;
    qualifyingQueryRows: number;
    sampledQueryRowClicks28d: number;
    sampledQueryRowImpressions28d: number;
    leadingQueryPriorityScore: number;
    medicalKeywordFlaggedRows: number;
    medicalReviewRequired: boolean;
    nextStep: 'review-existing-page';
    querySamples: Sample[];
  };
  const grouped = new Map<string, PageCandidate>();
  const add = (left: number, right: number): number => {
    const sum = left + right;
    if (!Number.isSafeInteger(sum)) {
      throw new RangeError('Sampled Search Console page metrics exceed safe integer precision.');
    }
    return sum;
  };
  for (const item of items) {
    let group = grouped.get(item.page);
    if (!group) {
      group = {
        page: item.page,
        qualifyingQueryRows: 0,
        sampledQueryRowClicks28d: 0,
        sampledQueryRowImpressions28d: 0,
        leadingQueryPriorityScore: 0,
        medicalKeywordFlaggedRows: 0,
        medicalReviewRequired: false,
        nextStep: 'review-existing-page',
        querySamples: [],
      };
      grouped.set(item.page, group);
    }
    group.qualifyingQueryRows = add(group.qualifyingQueryRows, 1);
    group.sampledQueryRowClicks28d = add(group.sampledQueryRowClicks28d, item.clicks28d);
    group.sampledQueryRowImpressions28d = add(group.sampledQueryRowImpressions28d, item.impressions28d);
    group.leadingQueryPriorityScore = Math.max(group.leadingQueryPriorityScore, item.priorityScore);
    if (item.medicalReviewRequired) group.medicalKeywordFlaggedRows++;
    group.medicalReviewRequired ||= item.medicalReviewRequired;
    // The source is ranked by query-level score; keep only a small, explicit
    // sample to avoid flooding the manual review with near-identical terms.
    if (group.querySamples.length < 3) {
      group.querySamples.push({
        query: item.query,
        priorityScore: item.priorityScore,
        impressions28d: item.impressions28d,
        medicalReviewRequired: item.medicalReviewRequired,
      });
    }
  }
  return [...grouped.values()].sort((a, b) =>
    b.leadingQueryPriorityScore - a.leadingQueryPriorityScore ||
    b.sampledQueryRowImpressions28d - a.sampledQueryRowImpressions28d ||
    (a.page < b.page ? -1 : a.page > b.page ? 1 : 0));
}

/** Offline and read-only. Search queries and URLs require deliberate opt-in. */
export function buildOfflineGscReport(
  current: readonly RawGscBatch[],
  previous: readonly RawGscBatch[],
  options: { includeQueries?: boolean; top?: number } = {},
) {
  const top = options.top ?? 20;
  if (!Number.isSafeInteger(top) || top < 1 || top > 100) {
    throw new RangeError('Report limit must be between 1 and 100.');
  }
  const result = screenPaginatedRawGscBatches(current, previous);
  const items = result.opportunities;
  const high = items.filter(x => x.priorityScore >= 70).length;
  return {
    reportKind: 'offline-gsc-existing-page-review' as const,
    status: 'human-review-required' as const,
    provenanceVerified: false as const,
    scope: result.declaredScope,
    totals: {
      acceptedRows: result.acceptedRows,
      rejectedRows: result.rejectedRows,
      duplicateCurrentKeys: result.duplicateCurrentKeys,
      duplicateBaselineKeys: result.duplicateBaselineKeys,
      medicalReviewFlags: items.filter(x => x.medicalReviewRequired).length,
      distinctCandidatePages: new Set(items.map(x => x.page)).size,
      highPriorityRows: high,
    },
    scoreBands: {
      low: items.filter(x => x.priorityScore < 40).length,
      medium: items.filter(x => x.priorityScore >= 40 && x.priorityScore < 70).length,
      high,
    },
    ...(options.includeQueries === true ? {
      pageGroups: groupExistingPageCandidates(items).slice(0, top),
      opportunities: items.slice(0, top).map(x => ({
        query: x.query, page: x.page, priorityScore: x.priorityScore,
        clicks28d: x.clicks28d, impressions28d: x.impressions28d,
        observedChangePercent: x.observedChangePercent,
        medicalReviewRequired: x.medicalReviewRequired,
        nextStep: x.nextStep,
      })),
    } : {}),
    caveats: [
      'Offline caller-declared data; original Google property access and provenance not authenticated.',
      'Query/page rows may be incomplete; this is NOT the full site traffic or global search demand.',
      'Scores are editorial heuristics only, never keyword difficulty, ranking probability or an instruction to publish.',
      'Page groups are grouped by exact existing URL, NOT semantic search intent; sampled query-row totals omit unreported queries and are NOT whole-page metrics.',
      ...result.caveats,
    ],
  };
}
