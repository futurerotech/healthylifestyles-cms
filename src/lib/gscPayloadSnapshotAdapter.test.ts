import {describe,it,expect} from 'vitest';
import {normalizePayloadReviewSnapshot} from './gscPayloadSnapshotAdapter';
import {buildOfflineEditorialReviewQueue} from './gscEditorialReviewQueue';
import type {RawGscBatch} from './gscRawRequestGate';

const url='https://www.healthylifesstyles.com/tools/sleep-score';
const batch=(startDate:string,endDate:string):RawGscBatch=>({
 siteUrl:'https://www.healthylifesstyles.com/',
 request:{startDate,endDate,dimensions:['query','page'],type:'web',dataState:'final',aggregationType:'auto',rowLimit:25000,startRow:0},
 response:{rows:[{keys:['sleep score',url],clicks:2,impressions:100,ctr:0.02,position:9}]},
});
const current=()=>[batch('2026-08-29','2026-09-25')];
const previous=()=>[batch('2026-08-01','2026-08-28')];

describe('read-only Payload CMS snapshot adapter',()=>{
 it('maps actual Payload SEO and publish fields while retaining unknown projections',()=>{
  const a=normalizePayloadReviewSnapshot('tools',[{id:12,slug:'sleep-score',_status:'published',enabled:true,seo:{noIndex:false,canonical:''}}]);
  expect(a[0].page).toBe(url);
  expect(a[0].status).toBe('published');
  expect(a[0].noIndex).toBe(false);
  expect(a[0].recordId).toBe(12);
  expect(buildOfflineEditorialReviewQueue(current(),previous(),a,{includeDetails:true}).tasks?.[0].cmsSnapshotState).toBe('declared-published-indexable');
  const unknown=normalizePayloadReviewSnapshot('tools',[{slug:'sleep-score'}]);
  expect(unknown[0].status).toBe('unknown');
  expect(unknown[0].noIndex).toBeNull();
  expect(unknown[0].enabled).toBeNull();
  expect(buildOfflineEditorialReviewQueue(current(),previous(),unknown,{includeDetails:true}).tasks?.[0].cmsSnapshotState).toBe('declared-needs-indexability-review');
 });
 it('flags overriding canonicals without mistaking an article for a tool',()=>{
  const a=normalizePayloadReviewSnapshot('tools',[{slug:'sleep-score',_status:'published',enabled:true,seo:{noIndex:false,canonical:'https://www.healthylifesstyles.com/tools/other'}}]);
  expect(buildOfflineEditorialReviewQueue(current(),previous(),a,{includeDetails:true}).tasks?.[0].reviewActions).toContain('review-publication-and-indexability');
  const articles=normalizePayloadReviewSnapshot('articles',[{slug:'sleep-science',_status:'published',seo:{noIndex:false}}]);
  expect(articles[0].page).toContain('/wellness-hub/sleep-science');
  expect(articles[0].enabled).toBeUndefined();
 });
 it('rejects malformed projection instead of assuming a published status',()=>{
  expect(()=>normalizePayloadReviewSnapshot('tools',[{slug:'sleep-score',seo:{noIndex:'false'}}])).toThrow();
  expect(()=>normalizePayloadReviewSnapshot('tools',[{slug:'sleep-score',enabled:'yes'}])).toThrow();
  expect(()=>normalizePayloadReviewSnapshot('articles',[{slug:'../admin'}])).toThrow();
  expect(()=>normalizePayloadReviewSnapshot('articles',[{slug:'sleep-science',seo:'bad'}])).toThrow();
 });
});