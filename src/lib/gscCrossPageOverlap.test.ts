import { describe, expect, it } from 'vitest';
import { screenSearchOpportunities } from './searchOpportunityEngine';
import { analyzeCrossPageQueryObservations } from './gscCrossPageOverlap';

const prefix='https://www.healthylifesstyles.com/tools/';
const row=(query:string,slug:string,impressions:number)=>({
  keys:[query,prefix+slug],clicks:2,impressions,ctr:2/impressions,position:9,
});

describe('offline cross-page query editorial review',()=>{
  it('flags same query on multiple pages without implying cannibalization',()=>{
    const screened=screenSearchOpportunities([
      row('sleep calculator','sleep-calculator',100),
      row('sleep calculator','sleep-score',50),
      row('heart rate','heart-rate',80),
    ]);
    const result=analyzeCrossPageQueryObservations(screened.opportunities);
    expect(result.observedMultiPageQueries).toBe(1);
    expect(result.distinctAffectedPages).toBe(2);
    expect(result.observations[0].reviewAction).toBe('compare-existing-page-intent');
    expect(result.observations[0].sampledQueryPageImpressions28d).toBe(150);
    expect(result.pageOverlapCounts.get(prefix+'sleep-score')).toBe(1);
  });
  it('excludes duplicate raw observations and flags medical queries',()=>{
    const screened=screenSearchOpportunities([
      row('chest pain','heart-rate',100),
      row('chest pain','heart-disease',60),
      row('chest pain','heart-rate',100),
    ]);
    const result=analyzeCrossPageQueryObservations(screened.opportunities);
    expect(result.observedMultiPageQueries).toBe(0);
    const clean=screenSearchOpportunities([
      row('chest pain','heart-rate',100),row('chest pain','heart-disease',60),
    ]);
    expect(analyzeCrossPageQueryObservations(clean.opportunities).medicalFlaggedOverlapQueries).toBe(1);
  });
});