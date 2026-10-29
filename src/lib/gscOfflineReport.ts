import { screenPaginatedRawGscBatches, type RawGscBatch } from './gscRawRequestGate';

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
      ...result.caveats,
    ],
  };
}
