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
  it('refuses invalid limits and mismatched periods', () => {
    expect(() => buildOfflineGscReport(current(), previous(), {top: 0})).toThrow();
    expect(() => buildOfflineGscReport(current(), current())).toThrow();
  });
});
