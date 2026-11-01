import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payload, PayloadRequest } from 'payload';

const sdk = vi.hoisted(() => ({
  authConfigs: [] as unknown[],
  sites: vi.fn(async () => ({ data: {} as unknown })),
  query: vi.fn(async (_request: unknown) => ({ data: {} as unknown })),
  service: vi.fn((_config: unknown) => ({})),
  credentials: vi.fn(() => ({
    client_email: 'fixture@example.invalid',
    private_key: 'TEST_ONLY_NOT_A_REAL_PRIVATE_KEY',
    project_id: 'fixture-project',
  })),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: class {
        constructor(options: unknown) { sdk.authConfigs.push(options); }
      },
    },
    searchconsole: sdk.service,
  },
}));
vi.mock('./google-auth', () => ({ loadGoogleCredentials: sdk.credentials }));

import { collectStaffGoogleReadOnlyReport, collectStaffGoogleReadOnlyEditorialQueue, probeStaffGoogleReadOnlyProperty } from './gscAuthorizedReadOnlyAnalytics';

const property = 'sc-domain:healthylifesstyles.com';
const page = 'https://www.healthylifesstyles.com/tools/bmi-calculator';
const user = { user: { id: 1, role: 'editor' } } as PayloadRequest;
const windows = {
  previous: { startDate: '2026-08-01', endDate: '2026-08-28' },
  current: { startDate: '2026-08-29', endDate: '2026-09-25' },
};
const observed = {
  keys: ['bmi calculator', page], clicks: 4, impressions: 100, ctr: 0.04, position: 9,
};
const originalEnabled = process.env.HLS_GSC_READONLY_ENABLED;
const originalStaging = process.env.HLS_ISOLATED_STAGING;
const originalProbe = process.env.HLS_GSC_PROPERTY_PROBE_ENABLED;

describe('Google SDK readonly Search Analytics gate (offline mocks only)', () => {
  beforeEach(() => {
    process.env.HLS_GSC_READONLY_ENABLED = 'true';
    delete process.env.HLS_ISOLATED_STAGING;
    sdk.authConfigs.length = 0;
    sdk.credentials.mockClear();
    sdk.sites.mockReset().mockResolvedValue({
      data: { siteEntry: [{ siteUrl: property, permissionLevel: 'siteFullUser' }] },
    });
    sdk.query.mockReset().mockImplementation(async (request: unknown) => {
      const body = (request as {requestBody?:{dimensions?:string[];startDate?:string}}).requestBody;
      if (body?.dimensions?.[0] === 'date') return {
        data: { rows: [{keys:[body.startDate]}] },
      };
      return { data: { rows: [observed], responseAggregationType: 'byPage' } };
    });
    sdk.service.mockReset().mockImplementation(() => ({
      sites: { list: sdk.sites },
      searchanalytics: { query: sdk.query },
    }));
  });
  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.HLS_GSC_READONLY_ENABLED;
    else process.env.HLS_GSC_READONLY_ENABLED = originalEnabled;
    if (originalStaging === undefined) delete process.env.HLS_ISOLATED_STAGING;
    else process.env.HLS_ISOLATED_STAGING = originalStaging;
    if (originalProbe === undefined) delete process.env.HLS_GSC_PROPERTY_PROBE_ENABLED;
    else process.env.HLS_GSC_PROPERTY_PROBE_ENABLED = originalProbe;
  });

  it('uses a separate opt-in for a minimal sites.list-only property probe', async () => {
    delete process.env.HLS_GSC_READONLY_ENABLED;
    delete process.env.HLS_GSC_PROPERTY_PROBE_ENABLED;
    await expect(probeStaffGoogleReadOnlyProperty(user)).rejects.toThrow(/not enabled/);
    expect(sdk.credentials).not.toHaveBeenCalled();
    process.env.HLS_GSC_PROPERTY_PROBE_ENABLED = 'true';
    const result = await probeStaffGoogleReadOnlyProperty(user);
    expect(result).toMatchObject({
      exactConfiguredPropertyAccessVerified: true,
      oauthScope: 'https://www.googleapis.com/auth/webmasters.readonly',
      searchAnalyticsRequests: 0, indexingSubmissions: 0, publicationAuthorized: false,
    });
    expect(sdk.sites).toHaveBeenCalledTimes(1);
    expect(sdk.query).not.toHaveBeenCalled();
    expect(sdk.authConfigs).toHaveLength(1);
    expect((sdk.authConfigs[0] as {scopes:string[]}).scopes).toEqual([
      'https://www.googleapis.com/auth/webmasters.readonly',
    ]);
  });
  it('rejects unauthorized users and property mismatch without querying analytics', async () => {
    process.env.HLS_GSC_PROPERTY_PROBE_ENABLED = 'true';
    await expect(probeStaffGoogleReadOnlyProperty({user:null} as PayloadRequest))
      .rejects.toThrow(/administrator or editor/);
    expect(sdk.credentials).not.toHaveBeenCalled();
    sdk.sites.mockResolvedValueOnce({data:{siteEntry:[{
      siteUrl:'https://www.healthylifesstyles.com/',permissionLevel:'siteOwner',
    }]}});
    await expect(probeStaffGoogleReadOnlyProperty(user)).rejects.toThrow(/exact configured/);
    expect(sdk.query).not.toHaveBeenCalled();
  });
  it('sanitizes provider errors and denies the probe in isolated staging', async () => {
    process.env.HLS_GSC_PROPERTY_PROBE_ENABLED = 'true';
    process.env.HLS_ISOLATED_STAGING = 'true';
    await expect(probeStaffGoogleReadOnlyProperty(user)).rejects.toThrow(/not enabled/);
    expect(sdk.credentials).not.toHaveBeenCalled();
    delete process.env.HLS_ISOLATED_STAGING;
    sdk.sites.mockRejectedValueOnce(new Error('private credentials and token'));
    await expect(probeStaffGoogleReadOnlyProperty(user))
      .rejects.toThrow('Search Console read-only property check failed.');
    expect(sdk.query).not.toHaveBeenCalled();
  });
  it('does not load OAuth credentials if CMS read fails before the Google client is needed', async () => {
    const payload = {find: vi.fn(async () => {throw new Error('private database failure');})};
    await expect(collectStaffGoogleReadOnlyEditorialQueue(user,windows,
      payload as unknown as Pick<Payload,'find'>))
      .rejects.toThrow('Access-controlled CMS snapshot failed; no review queue was produced.');
    expect(payload.find).toHaveBeenCalledTimes(1);
    expect(sdk.credentials).not.toHaveBeenCalled();
    expect(sdk.authConfigs).toHaveLength(0);
    expect(sdk.sites).not.toHaveBeenCalled();
    expect(sdk.query).not.toHaveBeenCalled();
  });
  it('rejects invalid combined queue options before accessing Google credentials or CMS', async () => {
    const payload = {find: vi.fn()};
    await expect(collectStaffGoogleReadOnlyEditorialQueue(user,windows,
      payload as unknown as Pick<Payload,'find'>,{top:101})).rejects.toThrow(/options/);
    expect(payload.find).not.toHaveBeenCalled();
    expect(sdk.credentials).not.toHaveBeenCalled();
  });
  it('uses only webmasters.readonly OAuth and exact audited request parameters', async () => {
    const report = await collectStaffGoogleReadOnlyReport(user, windows);
    expect(sdk.credentials).toHaveBeenCalledTimes(1);
    expect(sdk.credentials).toHaveBeenCalledWith({ quiet: true });
    expect(sdk.authConfigs).toHaveLength(1);
    expect(sdk.authConfigs[0]).toMatchObject({
      credentials: {
        client_email: 'fixture@example.invalid',
        private_key: 'TEST_ONLY_NOT_A_REAL_PRIVATE_KEY',
      },
      projectId: 'fixture-project',
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    expect(JSON.stringify(sdk.authConfigs[0])).not.toContain('www.googleapis.com/auth/indexing');
    expect(sdk.service).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'v1', auth: expect.any(Object) }),
    );
    expect(sdk.sites).toHaveBeenCalledTimes(1);
    expect(sdk.query).toHaveBeenCalledTimes(4);
    const bodies = sdk.query.mock.calls.filter(([call]) =>
      (call as {requestBody:{dimensions:string[]}}).requestBody.dimensions[0] !== 'date').map(([call]) =>
      call as { siteUrl: string; requestBody: Record<string, unknown> });
    for (const request of bodies) {
      expect(request.siteUrl).toBe(property);
      expect(Object.keys(request.requestBody).sort()).toEqual([
        'startDate', 'endDate', 'dimensions', 'type', 'dataState', 'aggregationType',
        'rowLimit', 'startRow',
      ].sort());
      expect(request.requestBody).toMatchObject({
        dimensions: ['query','page'], type: 'web', dataState: 'final',
        aggregationType: 'byPage', rowLimit: 1000, startRow: 0,
      });
    }
    expect(report.googleReadOnlyPropertyAccessVerified).toBe(true);
    expect(report.providerAuthentication).toBe('google-oauth-webmasters-readonly');
    expect(report.liveIndexingVerified).toBe(false);
    expect(report.publicationAuthorized).toBe(false);
    expect(report.totals.acceptedRows).toBe(1);
    expect(JSON.stringify(report)).not.toContain('bmi calculator');
    expect(JSON.stringify(report)).not.toContain('/tools/bmi-calculator');
  });

  it('rejects a missing flag, isolated staging, and unauthenticated callers before OAuth', async () => {
    delete process.env.HLS_GSC_READONLY_ENABLED;
    await expect(collectStaffGoogleReadOnlyReport(user, windows)).rejects.toThrow(/not enabled/);
    process.env.HLS_GSC_READONLY_ENABLED = 'true';
    process.env.HLS_ISOLATED_STAGING = 'true';
    await expect(collectStaffGoogleReadOnlyReport(user, windows)).rejects.toThrow(/not enabled/);
    delete process.env.HLS_ISOLATED_STAGING;
    await expect(collectStaffGoogleReadOnlyReport({user:null} as PayloadRequest, windows))
      .rejects.toThrow(/administrator or editor/);
    expect(sdk.credentials).not.toHaveBeenCalled();
    expect(sdk.sites).not.toHaveBeenCalled();
    expect(sdk.query).not.toHaveBeenCalled();
  });

  it('denies a property mismatch and never calls query API', async () => {
    sdk.sites.mockResolvedValueOnce({
      data: { siteEntry: [{
        siteUrl: 'https://www.healthylifesstyles.com/', permissionLevel: 'siteOwner',
      }] },
    });
    await expect(collectStaffGoogleReadOnlyReport(user, windows))
      .rejects.toThrow(/exact configured GSC property/);
    expect(sdk.query).not.toHaveBeenCalled();
  });

  it('rejects missing finalized dates before requesting query/page observations', async () => {
    sdk.query.mockReset().mockResolvedValueOnce({
      data: {rows: [{keys: ['2026-08-01']}]},
    }).mockResolvedValueOnce({data: {rows: []}});
    await expect(collectStaffGoogleReadOnlyReport(user, windows))
      .rejects.toThrow(/No finalized Search Console dates/);
    expect(sdk.sites).toHaveBeenCalledTimes(1);
    expect(sdk.query).toHaveBeenCalledTimes(2);
    for (const [request] of sdk.query.mock.calls) {
      expect((request as {requestBody:{dimensions:string[]}}).requestBody.dimensions)
        .toEqual(['date']);
    }
  });
  it('does not fetch detailed Search Analytics when the first date preflight fails', async () => {
    sdk.query.mockReset().mockResolvedValueOnce({data: {rows: [{keys: ['bad-date']}]}});
    await expect(collectStaffGoogleReadOnlyReport(user, windows))
      .rejects.toThrow(/Malformed, repeated or out-of-range finalized/);
    expect(sdk.query).toHaveBeenCalledTimes(1);
    expect((sdk.query.mock.calls[0][0] as {requestBody:{dimensions:string[]}})
      .requestBody.dimensions).toEqual(['date']);
  });
  it('redacts provider error text instead of logging or echoing private GSC queries', async () => {
    sdk.query.mockResolvedValueOnce({data:{rows:[{keys:['2026-08-01']}]}});
    sdk.query.mockResolvedValueOnce({data:{rows:[{keys:['2026-08-29']}]}});
    sdk.query.mockRejectedValueOnce(new Error('secret search phrase and auth detail'));
    await expect(collectStaffGoogleReadOnlyReport(user, windows))
      .rejects.toThrow('Search Analytics read failed; no report was produced.');
    expect(sdk.query).toHaveBeenCalledTimes(3);
  });

  it('proves a full page followed by a short terminal page uses contiguous offsets', async () => {
    const first = Array.from({ length: 1000 }, (_, i) => ({
      keys: ['term-' + i, page], clicks: 0, impressions: 20, ctr: 0, position: 9,
    }));
    sdk.query.mockResolvedValueOnce({data:{rows:[{keys:['2026-08-01']}]}});
    sdk.query.mockResolvedValueOnce({data:{rows:[{keys:['2026-08-29']}]}});
    sdk.query.mockResolvedValueOnce({ data: { rows: first, responseAggregationType: 'byPage' } });
    sdk.query.mockResolvedValueOnce({ data: { rows: [], responseAggregationType: 'byPage' } });
    sdk.query.mockResolvedValueOnce({
      data: { rows: [observed], responseAggregationType: 'byPage' },
    });
    const report = await collectStaffGoogleReadOnlyReport(user, windows);
    expect(report.totals.acceptedRows).toBe(1);
    expect(sdk.query.mock.calls.filter(([call]) =>
      (call as {requestBody:{dimensions:string[]}}).requestBody.dimensions[0] !== 'date').map(([call]) =>
      (call as {requestBody:{startRow:number}}).requestBody.startRow))
      .toEqual([0, 1000, 0]);
  });
});
