/**
 * Optional, server-only Search Analytics read path for a future staff workflow.
 *
 * This module creates NO HTTP route, cron, publication, indexing submission,
 * database mutation or provider logging. The real Google API entrypoint is
 * disabled by default, and uses ONLY webmasters.readonly OAuth scope.
 * Tests inject a read-only transport and cannot authenticate provider data.
 */
import type { Payload, PayloadRequest } from 'payload';
import { loadGoogleCredentials } from './google-auth';
import { GSC_SITE_URL } from './site-config';
import {
  screenComparableGscExports,
  type DeclaredGscExport,
} from './gscExportIntegrity';
import { buildOfflineGscReport } from './gscOfflineReport';
import { buildOfflineEditorialReviewQueue } from './gscEditorialReviewQueue';
import { collectAuthorizedPayloadReviewSnapshot } from './gscPayloadReadOnlyCollector';
import type { RawGscBatch } from './gscRawRequestGate';
import { requireFinalizedDateAvailability } from './gscFinalizedDateAvailability';

const ROW_LIMIT = 1000;
const MAX_PAGES_PER_WINDOW = 25;
const READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const ALLOWED_PERMISSIONS = new Set(['siteOwner', 'siteFullUser', 'siteRestrictedUser']);

type GscReportOptions = { includeQueries?: boolean; top?: number };
type GscEditorialOptions = { includeDetails?: boolean; top?: number };

/**
 * Validate all caller-controlled display options BEFORE opening credentials,
 * CMS access or GSC provider transport. An invalid bounded/opt-in setting
 * must never cause provider requests followed by an avoidable report failure.
 */
function assertBoundedReviewOptions(
  options: GscReportOptions | GscEditorialOptions,
  disclosureFlag: 'includeQueries' | 'includeDetails',
): void {
  const disclosure = disclosureFlag === 'includeQueries'
    ? (options as GscReportOptions)?.includeQueries
    : (options as GscEditorialOptions)?.includeDetails;
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some(key => key !== disclosureFlag && key !== 'top') ||
      (disclosure !== undefined && typeof disclosure !== 'boolean') ||
      (options.top !== undefined &&
        (!Number.isSafeInteger(options.top) || options.top < 1 || options.top > 100))) {
    throw new RangeError('Invalid bounded GSC review display options.');
  }
}

export interface GscDateWindow {
  startDate: string;
  endDate: string;
}

export interface GscComparisonWindows {
  previous: GscDateWindow;
  current: GscDateWindow;
}

export interface GscReadOnlyTransport {
  /** A narrowly scoped Search Console sites.get() READ for exactly one property. */
  getSite(siteUrl: string): Promise<unknown>;
  /** A Google Search Console searchAnalytics.query() READ. */
  query(siteUrl: string, request: RawGscBatch['request']): Promise<unknown>;
  checkDatePresence?(siteUrl: string, window: GscDateWindow): Promise<unknown>;
}

function requireStaff(req: Pick<PayloadRequest, 'user'>): void {
  if (!req?.user || !['admin', 'editor'].includes(req.user.role ?? '')) {
    throw new Error('An authenticated Payload administrator or editor is required.');
  }
}

function envelope(window: GscDateWindow): DeclaredGscExport {
  return {
    siteUrl: GSC_SITE_URL,
    rows: [],
    startDate: window.startDate,
    endDate: window.endDate,
    dimensions: ['query', 'page'],
    searchType: 'web',
    dataState: 'final',
    aggregationType: 'byPage',
    country: null,
    device: null,
    additionalFiltersFingerprint: 'none',
  };
}

function assertApprovedPeriods(windows: GscComparisonWindows): void {
  if (!windows || typeof windows !== 'object' || !windows.previous || !windows.current) {
    throw new TypeError('Two explicit Search Console comparison windows are required.');
  }
  // Reuse the existing 28-day PT calendar, property and scope integrity gate.
  // Do this BEFORE credential resolution or an external request.
  screenComparableGscExports(envelope(windows.current), envelope(windows.previous));
}

function assertAuthorizedProperty(entry: unknown): void {
  // A targeted sites.get(siteUrl) response must describe exactly the
  // configured property; never enumerate other Google properties.
  // Reject error envelopes even if they include fields.
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
      'error' in entry) {
    throw new Error('Search Console sites.get returned an invalid response.');
  }
  const site = entry as { siteUrl?: unknown; permissionLevel?: unknown };
  if (site.siteUrl !== GSC_SITE_URL ||
      typeof site.permissionLevel !== 'string' ||
      !ALLOWED_PERMISSIONS.has(site.permissionLevel)) {
    throw new Error('The authenticated account lacks read access to the exact configured GSC property.');
  }
}

function responseShape(value: unknown): RawGscBatch['response'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Search Analytics returned an invalid provider response.');
  }
  const response = value as Record<string, unknown>;
  if (Object.keys(response).some(key => key !== 'rows' && key !== 'responseAggregationType') ||
      (response.rows !== undefined && !Array.isArray(response.rows)) ||
      (Array.isArray(response.rows) && response.rows.length > ROW_LIMIT)) {
    throw new Error('Search Analytics returned an unexpected or oversized provider response.');
  }
  // Row contents and aggregation are validated by screenPaginatedRawGscBatches.
  return response as RawGscBatch['response'];
}

async function readWindow(
  transport: GscReadOnlyTransport,
  window: GscDateWindow,
): Promise<RawGscBatch[]> {
  const pages: RawGscBatch[] = [];
  for (let page = 0; page < MAX_PAGES_PER_WINDOW; page++) {
    const request: RawGscBatch['request'] = {
      startDate: window.startDate,
      endDate: window.endDate,
      dimensions: ['query', 'page'],
      type: 'web',
      dataState: 'final',
      aggregationType: 'byPage',
      rowLimit: ROW_LIMIT,
      startRow: page * ROW_LIMIT,
    };
    let raw: unknown;
    try {
      raw = await transport.query(GSC_SITE_URL, request);
    } catch {
      // Google error bodies may include private data. Never log or echo them.
      throw new Error('Search Analytics read failed; no report was produced.');
    }
    const response = responseShape(raw);
    const batch: RawGscBatch = { siteUrl: GSC_SITE_URL, request, response };
    pages.push(batch);
    if ((response.rows?.length ?? 0) < ROW_LIMIT) return pages;
  }
  // A full final page is NOT proof of completeness; do not silently truncate.
  throw new RangeError('Search Analytics reached the 25,000-row review cap; no partial report was produced.');
}

/**
 * Bounded, read-only collector with an INJECTED provider.
 * Success does not authenticate an injected/mock transport. The returned
 * report remains labeled offline/unverified, with page/query details redacted
 * unless the staff caller deliberately opts in.
 */
/**
 * Keep captured query/page rows local to this module and never expose them
 * in a default staff response. These are caller-transport assertions only:
 * the injected transport is not proof of live Google authentication.
 */
async function collectVerifiedGscBatchesWithTransport(
  req: Pick<PayloadRequest, 'user'>,
  windows: GscComparisonWindows,
  transport: GscReadOnlyTransport,
) {
  requireStaff(req);
  assertApprovedPeriods(windows);
  if (!transport || typeof transport.getSite !== 'function' ||
      typeof transport.query !== 'function') {
    throw new TypeError('A read-only Search Console transport is required.');
  }
  let property: unknown;
  try {
    property = await transport.getSite(GSC_SITE_URL);
  } catch {
    throw new Error('Search Console property verification failed; no report was produced.');
  }
  assertAuthorizedProperty(property);
  const finalizedDatePresenceChecked = typeof transport.checkDatePresence === 'function';
  if (transport.checkDatePresence) {
    for (const window of [windows.previous, windows.current]) {
      let response: unknown;
      try { response = await transport.checkDatePresence(GSC_SITE_URL, window); }
      catch { throw new Error('Search Console finalized-date availability check failed; no report was produced.'); }
      requireFinalizedDateAvailability(response, window);
    }
  }
  // Serial provider calls and a strict cap; no persistence or logging.
  const previous = await readWindow(transport, windows.previous);
  const current = await readWindow(transport, windows.current);
  return { current, previous, finalizedDatePresenceChecked };
}

export async function collectStaffGscReportWithTransport(
  req: Pick<PayloadRequest, 'user'>,
  windows: GscComparisonWindows,
  transport: GscReadOnlyTransport,
  options: GscReportOptions = {},
) {
  requireStaff(req);
  assertApprovedPeriods(windows);
  assertBoundedReviewOptions(options, 'includeQueries');
  const { current, previous, finalizedDatePresenceChecked } = await collectVerifiedGscBatchesWithTransport(
    req, windows, transport,
  );
  return {
    ...buildOfflineGscReport(current, previous, options),
    finalizedDatePresenceChecked,
    propertyPermissionChecked: true as const,
    providerAuthentication: 'caller-transport-not-verified' as const,
    liveIndexingVerified: false as const,
    publicationAuthorized: false as const,
  };
}

/**
 * Link access-controlled Payload base-document projections with bounded,
 * read-only Search Analytics observations for human editorial triage.
 * The CMS snapshot is read first; an access/pagination error prevents ALL
 * Search Console requests. No route/cron calls this function in this PR.
 */
async function collectStaffEditorialQueueCore(
  req: PayloadRequest,
  windows: GscComparisonWindows,
  payload: Pick<Payload, 'find'>,
  getTransport: () => Promise<GscReadOnlyTransport>,
  options: { includeDetails?: boolean; top?: number } = {},
) {
  requireStaff(req);
  assertApprovedPeriods(windows);
  if (!payload || typeof payload.find !== 'function') {
    throw new TypeError('An access-controlled Payload read transport is required.');
  }
  assertBoundedReviewOptions(options, 'includeDetails');

  let snapshot: Awaited<ReturnType<typeof collectAuthorizedPayloadReviewSnapshot>>;
  try {
    snapshot = await collectAuthorizedPayloadReviewSnapshot(payload, req);
  } catch {
    // Never surface underlying database errors, SQL, user data or query text.
    throw new Error('Access-controlled CMS snapshot failed; no review queue was produced.');
  }

  let transport: GscReadOnlyTransport;
  try {
    // Credentials are resolved ONLY after the access-controlled CMS read.
    transport = await getTransport();
  } catch {
    throw new Error('Search Console read-only initialization failed; no review queue was produced.');
  }
  const { current, previous, finalizedDatePresenceChecked } = await collectVerifiedGscBatchesWithTransport(
    req, windows, transport,
  );
  const queue = buildOfflineEditorialReviewQueue(
    current, previous, snapshot.catalog, options,
  );
  return {
    ...queue,
    cmsSnapshotReadWithAccessChecks: true as const,
    cmsSnapshotCounts: snapshot.counts,
    propertyPermissionCheckedInTransport: true as const,
    finalizedDatePresenceChecked,
    providerAuthentication: 'caller-transport-not-verified' as const,
    liveIndexingVerified: false as const,
    publicationAuthorized: false as const,
    caveats: [
      ...queue.caveats,
      ...snapshot.caveats,
      'Both captures were checked for shape and access, not frozen in an atomic cross-system transaction.',
      'Provider identity remains unverified for injected transports; do not interpret this report as proof of current Google indexing.',
    ],
  };
}

/** Reusable injected transport facade; preserving the mock-only test contract. */
export async function collectStaffEditorialReviewQueueWithTransport(
  req: PayloadRequest,
  windows: GscComparisonWindows,
  payload: Pick<Payload, 'find'>,
  transport: GscReadOnlyTransport,
  options: { includeDetails?: boolean; top?: number } = {},
) {
  return collectStaffEditorialQueueCore(
    req, windows, payload, async () => transport, options,
  );
}

/**
 * Build a Google client that can only request the Search Console readonly
 * OAuth scope. Never reuse getGoogleAuth() (it also requests indexing scope).
 * No API request occurs merely by constructing this transport.
 */
async function makeGoogleReadOnlyTransport(): Promise<GscReadOnlyTransport> {
  const { google } = await import('googleapis');
  const credentials = loadGoogleCredentials({ quiet: true });
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    projectId: credentials.project_id,
    scopes: [READONLY_SCOPE],
  });
  const api = google.searchconsole({ version: 'v1', auth });
  return {
    getSite: async (siteUrl) => (await api.sites.get({siteUrl})).data,
    checkDatePresence: async (siteUrl, window) => (await api.searchanalytics.query({
      siteUrl, requestBody: {startDate:window.startDate,endDate:window.endDate,dimensions:['date'],type:'web',dataState:'final'},
    })).data,
    query: async (siteUrl, request) =>
      // Do not spread RawGscBatch.request; its dimensionFilterGroups is
      // intentionally untrusted and cannot enter a Google API request.
      (await api.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: request.startDate,
          endDate: request.endDate,
          dimensions: ['query', 'page'],
          type: 'web',
          dataState: 'final',
          aggregationType: 'byPage',
          rowLimit: request.rowLimit,
          startRow: request.startRow,
        },
      })).data,
  };
}

/**
 * Independent, staff-only property/permission smoke test. This is NOT the
 * Search Analytics data collector and cannot request query, page, or click
 * data. It requires its OWN explicit opt-in so an administrator can authorize
 * a minimal Google sites.get call for the configured property without enabling analytics collection.
 *
 * No HTTP route or cron invokes this function in the research branch.
 */
export async function probeStaffGoogleReadOnlyProperty(
  req: Pick<PayloadRequest, 'user'>,
) {
  requireStaff(req);
  if (process.env.HLS_GSC_PROPERTY_PROBE_ENABLED !== 'true' ||
      (process.env.HLS_ISOLATED_STAGING === 'true' &&
        (process.env.HLS_GSC_ISOLATED_PROPERTY_PROBE_APPROVED !== 'true' ||
          process.env.HLS_GSC_READONLY_ENABLED === 'true'))) {
    // Isolated property-only verification needs two distinct opt-ins and
    // the broad Analytics flag must remain OFF. This never enables the
    // Search Analytics collectors, which always reject isolated staging.
    // No credential resolution or provider request occurs on denial.
    throw new Error('Search Console property-only probe is not enabled.');
  }

  const transport = await makeGoogleReadOnlyTransport();
  let property: unknown;
  try {
    property = await transport.getSite(GSC_SITE_URL);
  } catch {
    // Never surface provider response bodies, service account identity,
    // tokens, or any other remote error details.
    throw new Error('Search Console read-only property check failed.');
  }
  assertAuthorizedProperty(property);
  return {
    kind: 'gsc-readonly-property-only-probe' as const,
    exactConfiguredPropertyAccessVerified: true as const,
    oauthScope: READONLY_SCOPE,
    searchAnalyticsRequests: 0 as const,
    indexingSubmissions: 0 as const,
    publicationAuthorized: false as const,
  };
}

/**
 * Future explicit staff-only server entrypoint. It remains unavailable until
 * HLS_GSC_READONLY_ENABLED=true is configured after operational approval.
 * No public Next.js/Payload endpoint calls this function in this PR.
 */
export async function collectStaffGoogleReadOnlyReport(
  req: Pick<PayloadRequest, 'user'>,
  windows: GscComparisonWindows,
  options: { includeQueries?: boolean; top?: number } = {},
) {
  requireStaff(req);
  assertApprovedPeriods(windows);
  assertBoundedReviewOptions(options, 'includeQueries');
  if (process.env.HLS_GSC_READONLY_ENABLED !== 'true' ||
      process.env.HLS_ISOLATED_STAGING === 'true') {
    throw new Error('Live Search Analytics collection is not enabled for this environment.');
  }

  const transport = await makeGoogleReadOnlyTransport();
  const report = await collectStaffGscReportWithTransport(req, windows, transport, options);
  return {
    ...report,
    providerAuthentication: 'google-oauth-webmasters-readonly' as const,
    // This proves property access for this request only; it does NOT prove
    // complete Search Console row coverage or Google indexing of the pages.
    googleReadOnlyPropertyAccessVerified: true as const,
  };
}

/**
 * No public route is wired to this function. Explicitly enabling the
 * property-only probe does NOT enable Search Analytics or this combined queue.
 * The same HLS_GSC_READONLY_ENABLED gate protects the real Google collector.
 */
export async function collectStaffGoogleReadOnlyEditorialQueue(
  req: PayloadRequest,
  windows: GscComparisonWindows,
  payload: Pick<Payload, 'find'>,
  options: GscEditorialOptions = {},
) {
  requireStaff(req);
  assertApprovedPeriods(windows);
  assertBoundedReviewOptions(options, 'includeDetails');
  if (process.env.HLS_GSC_READONLY_ENABLED !== 'true' ||
      process.env.HLS_ISOLATED_STAGING === 'true') {
    throw new Error('Live Search Analytics collection is not enabled for this environment.');
  }
  // Defer credentials and client construction until after the CMS read has
  // passed request-scoped Payload access control and pagination validation.
  const queue = await collectStaffEditorialQueueCore(
    req, windows, payload, makeGoogleReadOnlyTransport, options,
  );
  return {
    ...queue,
    providerAuthentication: 'google-oauth-webmasters-readonly' as const,
    googleReadOnlyPropertyAccessVerified: true as const,
    // This does not prove that URLs are indexed or snapshots are current.
    publicationAuthorized: false as const,
  };
}
