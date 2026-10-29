import { describe, expect, it } from 'vitest';
import { buildOfflineGscReport } from './gscOfflineReport';
import type { RawGscBatch } from './gscRawRequestGate';

const page = 'https://www.healthylifesstyles.com/tools/bmi-calculator';
const batch = (startDate: string, endDate: string): RawGscBatch => ({
  siteUrl: 'https://www.healthylifesstyles.com/',
  request: { startDate, endDate, dimensions: ['query', 'page'], type: 'web',
    dataState: 'final', aggregationType: 'auto', rowLimit: 25000, startRow: 0 },
  response: { rows: [{ keys: ['bmi calculator', page], clicks: 4,
    impressions: 100, ctr: 0.04, position: 9 }], responseAggregationType: 'auto' },
});
const current = () => [batch('2026-08-29', '2026-09-25')];
const previous = () => [batch('2026-08-01', '2026-08-28')];

describe('private offline GSC report', () => {
  it('redacts search queries and pages by default', () => {
    const report = buildOfflineGscReport(current(), previous());
    expect(report.totals.acceptedRows).toBe(1);
    expect(report.provenanceVerified).toBe(false);
    expect('opportunities' in report).toBe(false);
    expect(JSON.stringify(report)).not.toContain('bmi calculator');
    expect(JSON.stringify(report)).not.toContain('bmi-calculator');
  });
  it('includes ranked details only when explicitly requested', () => {
    const report = buildOfflineGscReport(current(), previous(), { includeQueries: true });
    expect(report.opportunities?.[0].query).toBe('bmi calculator');
    expect(report.opportunities?.[0].nextStep).toBe('review-existing-page');
  });
  it('groups multiple qualifying queries on one page without inventing whole-page metrics', () => {
    const c=current();
    c[0].response.rows = [
      { keys: ['bmi calculator', page], clicks: 4, impressions: 100, ctr: 0.04, position: 9 },
      { keys: ['bmi meaning', page], clicks: 2, impressions: 70, ctr: 2/70, position: 12 },
      { keys: ['blood pressure bmi', page], clicks: 1, impressions: 30, ctr: 1/30, position: 15 },
    ];
    const report=buildOfflineGscReport(c,previous(),{includeQueries:true});
    expect(report.pageGroups).toHaveLength(1);
    expect(report.pageGroups?.[0].qualifyingQueryRows).toBe(3);
    expect(report.pageGroups?.[0].sampledQueryRowImpressions28d).toBe(200);
    expect(report.pageGroups?.[0].sampledQueryRowClicks28d).toBe(7);
    expect(report.pageGroups?.[0].medicalReviewRequired).toBe(true);
    expect(report.pageGroups?.[0].querySamples).toHaveLength(3);
    const redacted=JSON.stringify(buildOfflineGscReport(c,previous()));
    expect(redacted).not.toContain('bmi-calculator');
    expect(redacted).not.toContain('blood pressure bmi');
    expect(redacted).not.toContain('pageGroups');
  });
  it('sorts page groups deterministically and caps group and query detail', () => {
    const c=current();
    c[0].response.rows = [
      { keys: ['bmi calculator', page], clicks: 4, impressions: 100, ctr: 0.04, position: 9 },
      { keys: ['walking pace', 'https://www.healthylifesstyles.com/tools/running-pace-calculator'],
        clicks: 1, impressions: 500, ctr: 0.002, position: 8 },
    ];
    const report=buildOfflineGscReport(c,previous(),{includeQueries:true,top:1});
    expect(report.pageGroups).toHaveLength(1);
    expect(report.opportunities).toHaveLength(1);
    expect(report.totals.distinctCandidatePages).toBe(2);
  });
  it('refuses invalid limits and mismatched periods', () => {
    expect(() => buildOfflineGscReport(current(), previous(), {top: 0})).toThrow();
    expect(() => buildOfflineGscReport(current(), current())).toThrow();
  });
});
