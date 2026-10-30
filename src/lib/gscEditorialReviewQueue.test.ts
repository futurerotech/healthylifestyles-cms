import { describe, expect, it } from 'vitest';
import { buildOfflineEditorialReviewQueue } from './gscEditorialReviewQueue';
import type { RawGscBatch } from './gscRawRequestGate';

const root = 'https://www.healthylifesstyles.com';
const a = root + '/tools/sleep-score';
const b = root + '/wellness-hub/sleep-science';
const row = (query: string, page: string, impressions = 100) => ({
  keys: [query, page], clicks: 5, impressions, ctr: 5/impressions, position: 10,
});
const batch = (startDate: string, endDate: string): RawGscBatch => ({
  siteUrl: root + '/',
  request: {startDate,endDate,dimensions:['query','page'],type:'web',dataState:'final',aggregationType:'auto',rowLimit:25000,startRow:0},
  response: {rows:[row('sleep science',a),row('sleep science',b,80),row('chest pain',a,60)],responseAggregationType:'auto'},
});
const current=()=>[batch('2026-08-29','2026-09-25')];
const previous=()=>[batch('2026-08-01','2026-08-28')];
const catalog=()=>[
  {page:a,collection:'tools' as const,slug:'sleep-score',status:'published' as const,noIndex:false},
  {page:b,collection:'articles' as const,slug:'sleep-science',status:'unknown' as const,noIndex:null},
];

describe('offline editorial review queue',()=>{
  it('redacts page and search query data by default while giving aggregate totals',()=>{
    const result=buildOfflineEditorialReviewQueue(current(),previous(),catalog());
    expect(result.totals.candidatePages).toBe(2);
    expect(result.totals.observedMultiPageQueries).toBe(1);
    expect(result.totals.medicalKeywordFlaggedPages).toBe(1);
    expect(result.publicationAuthorized).toBe(false);
    const encoded=JSON.stringify(result);
    expect(encoded).not.toContain('sleep-score');
    expect(encoded).not.toContain('sleep science');
    expect(encoded).not.toContain('chest pain');
    expect('tasks' in result).toBe(false);
  });
  it('creates only human review actions and distinguishes snapshot uncertainty',()=>{
    const result=buildOfflineEditorialReviewQueue(current(),previous(),catalog(),{includeDetails:true});
    const tool=result.tasks?.find(t=>t.page===a);
    const article=result.tasks?.find(t=>t.page===b);
    expect(tool?.reviewActions).toContain('compare-existing-pages-for-query-intent');
    expect(tool?.reviewActions).toContain('verify-medical-evidence-and-qualified-review');
    expect(tool?.reviewActions).toContain('review-existing-content-and-tool-experience');
    expect(tool?.recommendedCmsMutation).toBeNull();
    expect(article?.cmsSnapshotState).toBe('declared-needs-indexability-review');
    expect(article?.reviewActions).toContain('review-publication-and-indexability');
    const missing=buildOfflineEditorialReviewQueue(current(),previous(),[],{includeDetails:true});
    expect(missing.tasks?.every(t=>t.cmsSnapshotState==='not-in-supplied-snapshot')).toBe(true);
    expect(missing.tasks?.[0].reviewActions).toContain('locate-page-in-authoritative-cms');
  });
  it('never treats disabled or unspecified tools as declared indexable',()=>{
    const base=catalog()[0];
    for (const enabled of [false,null,undefined]) {
      const entry={...base,enabled};
      const result=buildOfflineEditorialReviewQueue(current(),previous(),[entry],{includeDetails:true});
      const tool=result.tasks?.find(t=>t.page===a);
      expect(tool?.cmsSnapshotState).toBe('declared-needs-indexability-review');
      expect(tool?.reviewActions).toContain('review-publication-and-indexability');
      expect(tool?.reviewActions).not.toContain('review-existing-content-and-tool-experience');
    }
    const verified={...base,enabled:true};
    const result=buildOfflineEditorialReviewQueue(current(),previous(),[verified],{includeDetails:true});
    const tool=result.tasks?.find(t=>t.page===a);
    expect(tool?.cmsSnapshotState).toBe('declared-published-indexable');
    expect(tool?.declaredToolEnabled).toBe(true);
    expect(()=>buildOfflineEditorialReviewQueue(current(),previous(),[
      {...base,enabled:'yes' as unknown as boolean},
    ])).toThrow();
  });
  it('fails closed for malformed, inconsistent or duplicated catalog evidence',()=>{
    const duplicated=[...catalog(),catalog()[0]];
    const report=buildOfflineEditorialReviewQueue(current(),previous(),duplicated,{includeDetails:true});
    expect(report.tasks?.find(t=>t.page===a)?.cmsSnapshotState).toBe('ambiguous-snapshot');
    expect(report.tasks?.find(t=>t.page===a)?.reviewActions).toContain('resolve-ambiguous-cms-snapshot');
    expect(()=>buildOfflineEditorialReviewQueue(current(),previous(),[
      {...catalog()[0],slug:'wrong'},
    ])).toThrow();
    expect(()=>buildOfflineEditorialReviewQueue(current(),previous(),[
      {...catalog()[0],noIndex:'false' as unknown as boolean},
    ])).toThrow();
    expect(()=>buildOfflineEditorialReviewQueue(current(),current(),catalog())).toThrow();
    expect(()=>buildOfflineEditorialReviewQueue(current(),previous(),catalog(),{top:101})).toThrow();
  });
});
