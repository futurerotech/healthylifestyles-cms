import type { Opportunity } from './searchOpportunityEngine';

export interface ObservedPageForQuery {
  page: string;
  impressions28d: number;
  clicks28d: number;
  priorityScore: number;
  medicalReviewRequired: boolean;
}

/**
 * A same-query observation for two or more already-screened canonical pages.
 * This is a review signal ONLY: it does not prove keyword cannibalization,
 * shared search intent, duplicate content, or lost traffic.
 */
export interface CrossPageQueryObservation {
  query: string;
  observedPages: ObservedPageForQuery[];
  sampledQueryPageImpressions28d: number;
  medicalReviewRequired: boolean;
  reviewAction: 'compare-existing-page-intent';
}

function safeSum(a: number, b: number): number {
  const total = a + b;
  if (!Number.isSafeInteger(total)) {
    throw new RangeError('Cross-page sampled GSC totals exceed safe integer precision.');
  }
  return total;
}

/**
 * Operates only on screened query+page opportunities. Do not feed raw GSC
 * exports directly: screening must first exclude malformed and duplicate
 * query/page rows. Missing GSC queries cannot be inferred as absent.
 */
export function analyzeCrossPageQueryObservations(items: readonly Opportunity[]) {
  const perQuery = new Map<string, Map<string, Opportunity>>();
  for (const item of items) {
    let pages = perQuery.get(item.query);
    if (!pages) {
      pages = new Map<string, Opportunity>();
      perQuery.set(item.query, pages);
    }
    if (pages.has(item.page)) {
      throw new RangeError('Duplicate screened query/page observation.');
    }
    pages.set(item.page, item);
  }

  const observations: CrossPageQueryObservation[] = [];
  const pageOverlapCounts = new Map<string, number>();
  const affectedPages = new Set<string>();
  let medicalFlaggedOverlaps = 0;

  for (const [query, pages] of perQuery) {
    if (pages.size < 2) continue;
    const observedPages: ObservedPageForQuery[] = [...pages.values()]
      .map(item => ({
        page: item.page,
        impressions28d: item.impressions28d,
        clicks28d: item.clicks28d,
        priorityScore: item.priorityScore,
        medicalReviewRequired: item.medicalReviewRequired,
      }))
      .sort((a, b) => b.impressions28d - a.impressions28d ||
        (a.page < b.page ? -1 : a.page > b.page ? 1 : 0));

    let sampledQueryPageImpressions28d = 0;
    let medicalReviewRequired = false;
    for (const item of observedPages) {
      sampledQueryPageImpressions28d = safeSum(sampledQueryPageImpressions28d, item.impressions28d);
      medicalReviewRequired ||= item.medicalReviewRequired;
      affectedPages.add(item.page);
      pageOverlapCounts.set(item.page, (pageOverlapCounts.get(item.page) ?? 0) + 1);
    }
    if (medicalReviewRequired) medicalFlaggedOverlaps++;
    observations.push({
      query,
      observedPages,
      sampledQueryPageImpressions28d,
      medicalReviewRequired,
      reviewAction: 'compare-existing-page-intent',
    });
  }

  observations.sort((a, b) =>
    b.sampledQueryPageImpressions28d - a.sampledQueryPageImpressions28d ||
    b.observedPages.length - a.observedPages.length ||
    (a.query < b.query ? -1 : a.query > b.query ? 1 : 0));

  return {
    observedMultiPageQueries: observations.length,
    distinctAffectedPages: affectedPages.size,
    medicalFlaggedOverlapQueries: medicalFlaggedOverlaps,
    observations,
    pageOverlapCounts,
  };
}
