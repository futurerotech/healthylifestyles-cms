/**
 * Optional, server-only Search Analytics read path for a future staff workflow.
 *
 * This module creates NO HTTP route, cron, publication, indexing submission,
 * database mutation or provider logging. The real Google API entrypoint is
 * disabled by default, and uses ONLY webmasters.readonly OAuth scope.
 * Tests inject a read-only transport and cannot authenticate provider data.
 */
import type { PayloadRequest } from 'payload';
import { loadGoogleCredentials } from './google-auth';
import { GSC_SITE_URL } from './site-config';
import {
  screenComparableGscExports,
  type DeclaredGscExport,
} from './gscExportIntegrity';
import { buildOfflineGscReport } from './gscOfflineReport';
import type { RawGscBatch } from './gscRawRequestGate';

const ROW_LIMIT = 1000;
const MAX_PAGES_PER_WINDOW = 25;
const READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const ALLOWED_PERMISSIONS = new Set(['siteOwner', 'siteFullUser', 'siteRestrictedUser']);

export interface GscDateWindow {
  startDate: string;
  endDate: string;
}

export interface GscComparisonWindows {
  previous: GscDateWindow;
  current: GscDateWindow;
}

export interface GscReadOnlyTransport {
  /** A Google Search Console sites.list() READ, not a user-supplied property assertion. */
  listSites(): Promise<unknown>;
  /** A Google Search Console searchAnalytics.query() READ. */
  query(siteUrl: string, request: RawGscBatch['request']): Promise<unknown>;
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

function assertAuthorizedProperty(sites: unknown): void {
  if (!sites || typeof sites !== 'object' || Array.isArray(sites)) {
    throw new Error('Search Console sites.list returned an invalid response.');
  }
  const entries = (sites as { siteEntry?: unknown }).siteEntry;
  if (entries !== undefined && !Array.isArray(entries)) {
    throw new Error('Search Console sites.list returned an invalid response.');
  }
  const allowed = ((entries ?? []) as unknown[]).some((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const site = entry as { siteUrl?: unknown; permissionLevel?: unknown };
    return site.siteUrl === GSC_SITE_URL &&
      typeof site.permissionLevel === 'string' &&
      ALLOWED_PERMISSIONS.has(site.permissionLevel);
  });
  if (!allowed) {
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
export async function collectStaffGscReportWithTransport(
  req: Pick<PayloadRequest, 'user'>,
  windows: GscComparisonWindows,
  transport: GscReadOnlyTransport,
  options: { includeQueries?: boolean; top?: number } = {},
) {
  requireStaff(req);
  assertApprovedPeriods(windows);
  if (!transport || typeof transport.listSites !== 'function' ||
      typeof transport.query !== 'function') {
    throw new TypeError('A read-only Search Console transport is required.');
  }
  let sites: unknown;
  try {
    sites = await transport.listSites();
  } catch {
    throw new Error('Search Console property verification failed; no report was produced.');
  }
  assertAuthorizedProperty(sites);
  // Serial provider calls and a strict cap; do not persist raw query data.
  const previous = await readWindow(transport, windows.previous);
  const current = await readWindow(transport, windows.current);
  return {
    ...buildOfflineGscReport(current, previous, options),
    propertyPermissionChecked: true as const,
    providerAuthentication: 'caller-transport-not-verified' as const,
    liveIndexingVerified: false as const,
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
  if (process.env.HLS_GSC_READONLY_ENABLED !== 'true' ||
      process.env.HLS_ISOLATED_STAGING === 'true') {
    throw new Error('Live Search Analytics collection is not enabled for this environment.');
  }

  const { google } = await import('googleapis');
  const credentials = loadGoogleCredentials();
  // IMPORTANT: never call getGoogleAuth() here; it also requests the
  // unrelated Google Indexing API scope. Search Analytics is READ-ONLY.
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    projectId: credentials.project_id,
    scopes: [READONLY_SCOPE],
  });
  const api = google.searchconsole({ version: 'v1', auth });
  const transport: GscReadOnlyTransport = {
    listSites: async () => (await api.sites.list()).data,
    query: async (siteUrl, request) =>
      // Pass only the explicitly audited query+page fields. Do not spread
      // RawGscBatch.request, whose optional dimensionFilterGroups is unknown
      // by design and is rejected by the offline request-scope gate.
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
  const report = await collectStaffGscReportWithTransport(req, windows, transport, options);
  return {
    ...report,
    providerAuthentication: 'google-oauth-webmasters-readonly' as const,
    // This proves property access for this request only; it does NOT prove
    // complete Search Console row coverage or Google indexing of the pages.
    googleReadOnlyPropertyAccessVerified: true as const,
  };
}
