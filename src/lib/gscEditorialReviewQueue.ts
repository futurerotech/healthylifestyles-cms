/**
 * Pure, offline editorial triage of existing HealthyLifeStyles pages.
 *
 * Search Console request/response batches and CMS catalog snapshots are
 * CALLER-DECLARED, not authenticated or fetched here. Nothing in this module
 * writes to Payload, suggests automatic publication or sends data to AI APIs.
 */
import { screenPaginatedRawGscBatches, type RawGscBatch } from './gscRawRequestGate';
import { groupExistingPageCandidates } from './gscOfflineReport';
import { analyzeCrossPageQueryObservations } from './gscCrossPageOverlap';

export interface DeclaredCmsPageReference {
  /** Exact, already-canonical public article or tool URL. */
  page: string;
  collection: 'articles' | 'tools';
  /** Exact slug as exported by the CMS, not a guessed matching keyword. */
  slug: string;
  /** Tools without a publication-status field should use 'unknown'. */
  status: 'published' | 'draft' | 'unknown';
  /** Null means unavailable, not false. */
  noIndex: boolean | null;
}

export type EditorialReviewAction =
  | 'verify-current-cms-record-and-live-canonical'
  | 'locate-page-in-authoritative-cms'
  | 'resolve-ambiguous-cms-snapshot'
  | 'review-publication-and-indexability'
  | 'compare-existing-pages-for-query-intent'
  | 'verify-medical-evidence-and-qualified-review'
  | 'review-existing-content-and-tool-experience';

export type CatalogEvidenceState =
  | 'not-in-supplied-snapshot'
  | 'ambiguous-snapshot'
  | 'declared-needs-indexability-review'
  | 'declared-published-indexable';

const ORIGIN = 'https://www.healthylifesstyles.com';
const MAX_CATALOG = 25_000;
const MAX_DETAILS = 100;

function validateCatalog(
  catalog: readonly DeclaredCmsPageReference[],
): Map<string, DeclaredCmsPageReference[]> {
  if (!Array.isArray(catalog) || catalog.length > MAX_CATALOG) {
    throw new RangeError('Provide a bounded array of caller-declared CMS page references.');
  }
  const indexed = new Map<string, DeclaredCmsPageReference[]>();
  for (const ref of catalog) {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref) ||
        typeof ref.page !== 'string' || typeof ref.slug !== 'string' ||
        !['articles', 'tools'].includes(ref.collection) ||
        !['published', 'draft', 'unknown'].includes(ref.status) ||
        (ref.noIndex !== null && typeof ref.noIndex !== 'boolean')) {
      throw new TypeError('Malformed caller-declared CMS page reference.');
    }
    const match = /^(\/(tools|wellness-hub)\/([a-z0-9]+(?:-[a-z0-9]+)*))$/.exec(
      ref.page.startsWith(ORIGIN) ? ref.page.slice(ORIGIN.length) : '',
    );
    if (!match || ref.page !== ORIGIN + match[1] ||
        ref.slug !== match[3] ||
        (ref.collection === 'articles' ? match[2] !== 'wellness-hub' : match[2] !== 'tools') ||
        (match[2] === 'tools' && match[3] === 'pseo') ||
        (match[2] === 'wellness-hub' && match[3] === 'tag')) {
      throw new RangeError('CMS reference must be an exact existing-page canonical route matching its collection and slug.');
    }
    const entries = indexed.get(ref.page) ?? [];
    entries.push(ref);
    indexed.set(ref.page, entries);
  }
  return indexed;
}

/**
 * No CMS lookup is assumed. Missing entries mean absent from THIS supplied
 * snapshot, not a 404 or missing production record. Duplicate snapshots
 * are ambiguous and never resolved by choosing the first version.
 */
export function buildOfflineEditorialReviewQueue(
  current: readonly RawGscBatch[],
  previous: readonly RawGscBatch[],
  catalog: readonly DeclaredCmsPageReference[],
  options: { includeDetails?: boolean; top?: number } = {},
) {
  const top = options.top ?? 20;
  if (!Number.isSafeInteger(top) || top < 1 || top > MAX_DETAILS) {
    throw new RangeError('Editorial review detail limit must be between 1 and 100.');
  }
  // Fail closed before building a review plan from unverified snapshots.
  const catalogByPage = validateCatalog(catalog);
  const result = screenPaginatedRawGscBatches(current, previous);
  const groups = groupExistingPageCandidates(result.opportunities);
  const overlaps = analyzeCrossPageQueryObservations(result.opportunities);

  const tasks = groups.map(group => {
    const records = catalogByPage.get(group.page) ?? [];
    const snapshotState: CatalogEvidenceState =
      records.length === 0 ? 'not-in-supplied-snapshot' :
      records.length > 1 ? 'ambiguous-snapshot' :
      records[0].status !== 'published' || records[0].noIndex !== false
        ? 'declared-needs-indexability-review' : 'declared-published-indexable';

    const overlapCount = overlaps.pageOverlapCounts.get(group.page) ?? 0;
    const actions: EditorialReviewAction[] = ['verify-current-cms-record-and-live-canonical'];
    if (snapshotState === 'not-in-supplied-snapshot') {
      actions.push('locate-page-in-authoritative-cms');
    } else if (snapshotState === 'ambiguous-snapshot') {
      actions.push('resolve-ambiguous-cms-snapshot');
    } else if (snapshotState === 'declared-needs-indexability-review') {
      actions.push('review-publication-and-indexability');
    }
    if (overlapCount > 0) actions.push('compare-existing-pages-for-query-intent');
    if (group.medicalReviewRequired) {
      actions.push('verify-medical-evidence-and-qualified-review');
    }
    if (snapshotState === 'declared-published-indexable') {
      actions.push('review-existing-content-and-tool-experience');
    }
    return {
      page: group.page,
      observedQueryRows: group.qualifyingQueryRows,
      sampledQueryRowClicks28d: group.sampledQueryRowClicks28d,
      sampledQueryRowImpressions28d: group.sampledQueryRowImpressions28d,
      leadingQueryPriorityScore: group.leadingQueryPriorityScore,
      medicalReviewRequired: group.medicalReviewRequired,
      observedMultiPageQueryCount: overlapCount,
      cmsSnapshotMatches: records.length,
      cmsSnapshotState: snapshotState,
      declaredPublicationState: records.length === 1 ? records[0].status : null,
      declaredNoIndex: records.length === 1 ? records[0].noIndex : null,
      reviewActions: actions,
      sampleQueries: group.querySamples.map(sample => sample.query),
      recommendedCmsMutation: null,
    };
  });

  return {
    reportKind: 'offline-gsc-editorial-review-queue' as const,
    status: 'human-verification-required' as const,
    gscProvenanceAuthenticated: false as const,
    cmsSnapshotAuthenticated: false as const,
    publicationAuthorized: false as const,
    scope: result.declaredScope,
    totals: {
      candidatePages: tasks.length,
      acceptedQueryPageRows: result.acceptedRows,
      rejectedQueryPageRows: result.rejectedRows,
      missingFromSuppliedSnapshot: tasks.filter(t => t.cmsSnapshotState === 'not-in-supplied-snapshot').length,
      ambiguousSnapshotPages: tasks.filter(t => t.cmsSnapshotState === 'ambiguous-snapshot').length,
      declaredIndexabilityReviewPages: tasks.filter(t => t.cmsSnapshotState === 'declared-needs-indexability-review').length,
      medicalKeywordFlaggedPages: tasks.filter(t => t.medicalReviewRequired).length,
      observedMultiPageQueries: overlaps.observedMultiPageQueries,
      affectedOverlapPages: overlaps.distinctAffectedPages,
    },
    ...(options.includeDetails === true ? { tasks: tasks.slice(0, top) } : {}),
    caveats: [
      'GSC batches and CMS snapshot are caller-declared offline data, not authenticated current production state.',
      'Missing catalog entries are missing only from the supplied snapshot; do not infer an absent, unpublished or redirected live page.',
      'Sampled query rows do not represent all search traffic or establish keyword cannibalization.',
      'Medical keyword checks are incomplete; all health content changes need appropriate evidence review.',
      'All actions are human review tasks. No CMS mutation, automatic article creation, submission or publication is authorized.',
      ...result.caveats,
    ],
  };
}
