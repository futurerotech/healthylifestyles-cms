import { describe, expect, it } from 'vitest';
import { screenComparableGscExports, type DeclaredGscExport } from './gscExportIntegrity';
const page='https://www.healthylifesstyles.com/tools/bmi-calculator';
const row={keys:['bmi calculator',page],clicks:4,impressions:100,ctr:0.04,position:9};
const envelope=(startDate:string,endDate:string):DeclaredGscExport=>({
 rows:[row],siteUrl:'https://www.healthylifesstyles.com/',startDate,endDate,
 dimensions:['query','page'],searchType:'web',dataState:'final',aggregationType:'auto',
 country:'usa',device:'MOBILE',additionalFiltersFingerprint:'none',
});
describe('declared GSC export scope integrity',()=>{
 const previous=()=>envelope('2026-08-01','2026-08-28');
 const current=()=>envelope('2026-08-29','2026-09-25');
 it('accepts adjacent 28-day PT periods with matching scopes, without claiming provenance',()=>{
  const v=screenComparableGscExports(current(),previous());
  expect(v.acceptedRows).toBe(1);
  expect(v.declaredScope.sourceAuthenticated).toBe(false);
  expect(v.declaredScope.timeZone).toBe('America/Los_Angeles');
 });
 it('rejects mismatched site/filter/device/type/aggregation or incomplete data',()=>{
  const variants=[
    {device:'DESKTOP'}, {country:'gbr'}, {siteUrl:'https://evil.test/'},
    {searchType:'image'}, {aggregationType:'byProperty'},{dataState:'all'},
    {dimensions:['page','query']},{additionalFiltersFingerprint:'filter=brand'},
  ];
  for(const change of variants)expect(()=>screenComparableGscExports({...current(),...change},previous())).toThrow();
 });
 it('rejects invalid, overlapping, gapped, mismatched-length windows',()=>{
  for(const dates of [
    ['2026-08-28','2026-09-24'], ['2026-08-30','2026-09-26'],
    ['2026-08-29','2026-09-24'], ['2026-02-30','2026-03-29'],
  ])expect(()=>screenComparableGscExports(envelope(dates[0],dates[1]),previous())).toThrow();
 });
 it('never changes existing pure scorer or makes external requests',()=>{
  const v=screenComparableGscExports(current(),previous());
  expect(v.opportunities[0].query).toBe('bmi calculator');
  expect(v.caveats.some(x=>x.includes('caller-declared'))).toBe(true);
 });
});
