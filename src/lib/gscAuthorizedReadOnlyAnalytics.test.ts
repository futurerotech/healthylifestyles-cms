import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectStaffGscReportWithTransport,
  collectStaffGoogleReadOnlyReport,
  type GscReadOnlyTransport,
} from './gscAuthorizedReadOnlyAnalytics';
import type { PayloadRequest } from 'payload';

const staff = { user: { id: 1, role: 'editor' } } as PayloadRequest;
const windows = {
  previous: { startDate: '2026-08-01', endDate: '2026-08-28' },
  current: { startDate: '2026-08-29', endDate: '2026-09-25' },
};
const property = 'sc-domain:healthylifesstyles.com';
const row = { keys: ['bmi calculator', 'https://www.healthylifesstyles.com/tools/bmi-calculator'],
  clicks: 4, impressions: 100, ctr: 0.04, position: 9 };
const transport = (permission = 'siteFullUser') => ({
  listSites: vi.fn(async () => ({ siteEntry: [{ siteUrl: property, permissionLevel: permission }] })),
  query: vi.fn(async (_site: string, _request: GscReadOnlyTransport['query'] extends (site: string, request: infer R) => Promise<unknown> ? R : never) => ({ rows: [row], responseAggregationType: 'byPage' })),
});

describe('bounded staff-only Google Search Analytics adapter', () => {
  afterEach(() => { delete process.env.HLS_GSC_READONLY_ENABLED; });
  it('uses exact property, finalized 28-day windows, bounded readonly requests and redacts details', async () => {
    const provider = transport();
    const report = await collectStaffGscReportWithTransport(staff, windows, provider);
    expect(provider.listSites).toHaveBeenCalledTimes(1);
    expect(provider.query).toHaveBeenCalledTimes(2);
    expect(provider.query.mock.calls.map(([site, request]) => [
      site, request.dataState, request.aggregationType, request.rowLimit, request.startRow,
    ])).toEqual([[property, 'final', 'byPage', 1000, 0],
      [property, 'final', 'byPage', 1000, 0]]);
    expect(report.totals.acceptedRows).toBe(1);
    expect(report.propertyPermissionChecked).toBe(true);
    expect(report.providerAuthentication).toBe('caller-transport-not-verified');
    expect(report.publicationAuthorized).toBe(false);
    expect(JSON.stringify(report)).not.toContain('bmi calculator');
    expect(JSON.stringify(report)).not.toContain('bmi-calculator');
    const detailed = await collectStaffGscReportWithTransport(staff, windows, provider,
      { includeQueries: true });
    expect(detailed.opportunities?.[0].query).toBe('bmi calculator');
  });
  it('rejects unauthorized roles and mismatched windows before any provider call', async () => {
    const provider = transport();
    await expect(collectStaffGscReportWithTransport({ user: null } as PayloadRequest,
      windows, provider)).rejects.toThrow(/administrator or editor/);
    await expect(collectStaffGscReportWithTransport(staff, {
      ...windows, current: {startDate:'2026-09-01',endDate:'2026-09-28'},
    }, provider)).rejects.toThrow();
    expect(provider.listSites).not.toHaveBeenCalled();
    expect(provider.query).not.toHaveBeenCalled();
  });
  it('requires permission to the exact configured Search Console property', async () => {
    for (const permission of ['siteUnverifiedUser', 'unknown', '']) {
      const provider = transport(permission);
      await expect(collectStaffGscReportWithTransport(staff, windows, provider))
        .rejects.toThrow(/lacks read access/);
      expect(provider.query).not.toHaveBeenCalled();
    }
    const provider = transport();
    provider.listSites.mockResolvedValueOnce({
      siteEntry: [{ siteUrl: 'https://www.healthylifesstyles.com/', permissionLevel: 'siteOwner' }],
    });
    await expect(collectStaffGscReportWithTransport(staff, windows, provider))
      .rejects.toThrow(/exact configured/);
    expect(provider.query).not.toHaveBeenCalled();
  });
  it('rejects error envelopes and never forwards provider error messages', async () => {
    const provider = transport();
    provider.query.mockRejectedValueOnce(new Error('private search query details'));
    await expect(collectStaffGscReportWithTransport(staff, windows, provider))
      .rejects.toThrow('Search Analytics read failed; no report was produced.');
    const bad = transport();
    bad.query.mockResolvedValueOnce({ error: { message:'private data' } });
    await expect(collectStaffGscReportWithTransport(staff, windows, bad))
      .rejects.toThrow(/unexpected or oversized/);
  });
  it('rejects nonterminal full pages without ever issuing more than 25 requests per window', async () => {
    const provider: GscReadOnlyTransport = {
      listSites: async () => ({ siteEntry: [{siteUrl:property, permissionLevel:'siteOwner'}] }),
      query: async () => ({ rows: Array.from({length:1000}, (_,i) => ({
        keys:['term-'+i,'https://www.healthylifesstyles.com/tools/bmi-calculator'],
        clicks:0,impressions:20,ctr:0,position:9,
      })), responseAggregationType:'byPage' }),
    };
    await expect(collectStaffGscReportWithTransport(staff, windows, provider))
      .rejects.toThrow(/25,000-row review cap/);
  });
  it('rejects invalid report options before any Google property or analytics request', async () => {
    for (const options of [{top:101},{top:0},{includeQueries:'true'},
      {includeDetails:true},null]) {
      const provider=transport();
      await expect(collectStaffGscReportWithTransport(staff,windows,provider,
        options as never)).rejects.toThrow(/display options/);
      expect(provider.listSites).not.toHaveBeenCalled();
      expect(provider.query).not.toHaveBeenCalled();
    }
  });
  it('never makes real network calls when live feature flag is absent', async () => {
    const provider = transport();
    await expect(collectStaffGoogleReadOnlyReport(staff, windows))
      .rejects.toThrow(/not enabled/);
    expect(provider.listSites).not.toHaveBeenCalled();
  });
});
