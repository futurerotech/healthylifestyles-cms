import { describe, expect, it } from 'vitest';
import { screenBoundedRawGscBatches, screenPaginatedRawGscBatches, type RawGscBatch } from './gscRawRequestGate';
const page='https://www.healthylifesstyles.com/tools/bmi-calculator';
const row={keys:['bmi calculator',page],clicks:4,impressions:100,ctr:0.04,position:9};
const batch=(startDate:string,endDate:string):RawGscBatch=>({
 siteUrl:'https://www.healthylifesstyles.com/',
 request:{startDate,endDate,dimensions:['query','page'],type:'web',dataState:'final',aggregationType:'auto',rowLimit:25000,startRow:0},
 response:{rows:[row],responseAggregationType:'auto'},
});
describe('bounded raw GSC request/response gate',()=>{
 const previous=()=>batch('2026-08-01','2026-08-28');
 const current=()=>batch('2026-08-29','2026-09-25');
 it('accepts only a bounded compatible non-full first page',()=>{
  const result=screenBoundedRawGscBatches(current(),previous());
  expect(result.acceptedRows).toBe(1);
  expect(result.declaredScope.sourceAuthenticated).toBe(false);
 });
 it('rejects ambiguous pagination, response aggregation and unreviewed filters',()=>{
  const changes=[
   {request:{...current().request,rowLimit:1}},
   {request:{...current().request,startRow:1}},
   {request:{...current().request,rowLimit:25001}},
   {request:{...current().request,dimensionFilterGroups:[]}},
   {response:{rows:[row],responseAggregationType:'byProperty'}},
  ];
  for(const change of changes)expect(()=>screenBoundedRawGscBatches({...current(),...change},previous())).toThrow();
 });

 it('accepts auto -> byPage response and contiguous full plus short terminal pages',()=>{
  const a={...current(),request:{...current().request,rowLimit:1},
    response:{rows:[row],responseAggregationType:'byPage'}};
  const b={...a,request:{...a.request,startRow:1},response:{rows:[],responseAggregationType:'byPage'}};
  const old={...previous(),request:{...previous().request,rowLimit:1},
    response:{rows:[row],responseAggregationType:'byPage'}};
  const oldEnd={...old,request:{...old.request,startRow:1},response:{rows:[],responseAggregationType:'byPage'}};
  expect(screenPaginatedRawGscBatches([a,b],[old,oldEnd]).acceptedRows).toBe(1);
  expect(()=>screenPaginatedRawGscBatches([a,{...b,request:{...b.request,startRow:2}}],[old,oldEnd])).toThrow();
  expect(()=>screenPaginatedRawGscBatches([a],[old,oldEnd])).toThrow();
 });
 it('accepts genuine no-data responses without converting malformed rows to empty data',()=>{
  const noData={...current(),response:{responseAggregationType:'auto'}};
  expect(screenBoundedRawGscBatches(noData,previous()).acceptedRows).toBe(0);
  expect(screenPaginatedRawGscBatches([noData],[previous()]).acceptedRows).toBe(0);
  expect(()=>screenBoundedRawGscBatches({...noData,response:{rows:null} as unknown as RawGscBatch['response']},previous())).toThrow();
  expect(()=>screenPaginatedRawGscBatches([{...noData,response:{rows:'bad'} as unknown as RawGscBatch['response']}],[previous()])).toThrow();
 });
 it('rejects incomparable periods even for individually well-formed batches',()=>{
  expect(()=>screenBoundedRawGscBatches(batch('2026-08-31','2026-09-27'),previous())).toThrow();
 });
});
