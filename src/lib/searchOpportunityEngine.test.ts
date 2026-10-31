import { describe, expect, it } from 'vitest';
import { screenSearchOpportunities, type GscQueryPageRow } from './searchOpportunityEngine';

const page = 'https://www.healthylifesstyles.com/wellness-hub/sleep-timing-guide';
const row = (q:string, impressions:number, position:number, clicks=4):GscQueryPageRow => ({
  keys:[q,page], impressions, position, clicks, ctr:clicks/impressions,
});

describe('Search Intelligence read-only opportunity screener', () => {
  it('uses first-party impressions, never fabricates global volume or keyword difficulty', () => {
    const v=screenSearchOpportunities([row('sleep schedule with night shift',150,11)]);
    expect(v.acceptedRows).toBe(1);
    expect(v.opportunities[0].globalMonthlySearches).toBeNull();
    expect(v.opportunities[0].organicCompetition).toBe('unmeasured');
    expect(v.opportunities[0].nextStep).toBe('review-existing-page');
    expect(v.caveats.some(x=>x.includes('do not measure global'))).toBe(true);
  });
  it('is deterministic, normalized, and dedupes duplicate query-page keys', () => {
    const q=row('  Sleep  Schedule  ',320,8);
    const same=row('sleep schedule',320,8);
    const v=screenSearchOpportunities([q,same,row('other intent',200,20)]);
    expect(v.acceptedRows).toBe(1);
    expect(v.rejectedRows).toBe(2);
    expect(v.duplicateCurrentKeys).toBe(1);
    expect(v.opportunities.find(x=>x.query==='sleep schedule')).toBeUndefined();
    expect(v.opportunities.map(x=>x.priorityScore)).toEqual([...v.opportunities.map(x=>x.priorityScore)].sort((a,b)=>b-a));
  });
  it('refuses invalid, unrelated or private pages', () => {
    const bad=[
      {...row('sleep plan',150,8),keys:['sleep plan','https://evil.example/tools/sleep']},
      {...row('sleep plan',150,8),keys:['sleep plan','https://www.healthylifesstyles.com/admin']},
      {...row('sleep plan',150,8),keys:['sleep plan','https://www.healthylifesstyles.com/tools/test?token=secret']},
      {...row('sleep plan',150,8),clicks:300},
      {...row('sleep plan',10,8)},
    ];
    const v=screenSearchOpportunities(bad);
    expect(v.acceptedRows).toBe(0);
    expect(v.rejectedRows).toBe(5);
  });
  it('flags likely medical YMYL and handles sparse baseline honestly', () => {
    const q=row('blood pressure after eating',300,7);
    const v=screenSearchOpportunities([q]);
    expect(v.opportunities[0].medicalReviewRequired).toBe(true);
    expect(v.opportunities[0].observedChangePercent).toBeNull();
  });
  it('computes observed site impression change only with a valid baseline', () => {
    const q=row('better sleep routine',240,12);
    const v=screenSearchOpportunities([q],[row('better sleep routine',120,10)]);
    expect(v.opportunities[0].observedChangePercent).toBe(100);
    expect(v.opportunities[0].previousImpressions28d).toBe(120);
  });
  it('rejects nested, encoded, trailing slash, and pSEO targets as noncanonical', () => {
    const bad = [
      '/tools/valid-slug/child', '/wellness-hub/tag/sleep', '/tools/pseo/duplicate',
      '/tools/a%2Fb', '/wellness-hub/article/', '/tools/UPPER',
    ];
    const result = screenSearchOpportunities(bad.map(path => ({
      ...row('sleep schedule', 100, 8),
      keys: ['sleep schedule', 'https://www.healthylifesstyles.com' + path],
    })));
    expect(result.acceptedRows).toBe(0);
    expect(result.rejectedRows).toBe(bad.length);
  });

  it('refuses conflicting duplicate baseline observations when estimating growth', () => {
    const current = row('night shift sleep', 300, 9);
    const result = screenSearchOpportunities([current], [
      row('night shift sleep', 100, 11), row(' NIGHT SHIFT SLEEP ', 250, 12),
    ]);
    expect(result.acceptedRows).toBe(1);
    expect(result.duplicateBaselineKeys).toBe(1);
    expect(result.opportunities[0].previousImpressions28d).toBeNull();
    expect(result.opportunities[0].observedChangePercent).toBeNull();
    expect(result.caveats.some(c => c.includes('Duplicate previous-period'))).toBe(true);
  });

  it('rejects duplicate current keys regardless of export ordering', () => {
    const low = row('sleep schedule', 50, 8);
    const high = row(' SLEEP SCHEDULE ', 1500, 8);
    for (const entries of [[low, high], [high, low]]) {
      const result = screenSearchOpportunities(entries);
      expect(result.acceptedRows).toBe(0);
      expect(result.rejectedRows).toBe(2);
      expect(result.duplicateCurrentKeys).toBe(1);
    }
  });
  it('excludes a valid current row when an invalid measurement duplicate has the same identity', () => {
    const valid = row('night shift sleep', 300, 9);
    const invalid = { ...valid, keys: [' NIGHT SHIFT SLEEP ', page], ctr: 0.9 };
    for (const entries of [[valid, invalid], [invalid, valid]]) {
      const result = screenSearchOpportunities(entries);
      expect(result.acceptedRows).toBe(0);
      expect(result.rejectedRows).toBe(2);
      expect(result.duplicateCurrentKeys).toBe(1);
    }
  });

  it('does not invent baseline growth when one duplicate has an invalid measurement', () => {
    const valid = row('sleep recovery', 300, 9);
    const oldValid = row('sleep recovery', 100, 12);
    const oldInvalid = { ...oldValid, keys: [' SLEEP RECOVERY ', page], position: 0.5 };
    for (const baselines of [[oldValid, oldInvalid], [oldInvalid, oldValid]]) {
      const result = screenSearchOpportunities([valid], baselines);
      expect(result.acceptedRows).toBe(1);
      expect(result.duplicateBaselineKeys).toBe(1);
      expect(result.opportunities[0].observedChangePercent).toBeNull();
      expect(result.opportunities[0].previousImpressions28d).toBeNull();
    }
  });

  it('rejects reserved section roots', () => {
    const paths = ['/tools/pseo', '/wellness-hub/tag'];
    const result = screenSearchOpportunities(paths.map(path => ({
      ...row('sleep schedule', 150, 8),
      keys: ['sleep schedule', 'https://www.healthylifesstyles.com' + path],
    })));
    expect(result.acceptedRows).toBe(0);
    expect(result.rejectedRows).toBe(2);
  });
  it('rejects contradictory CTR, fractional counts, and impossible average positions', () => {
    const base = row('how to sleep better', 100, 8, 4);
    const bad = [
      { ...base, ctr: 0.9 },
      { ...base, clicks: 4.5 },
      { ...base, impressions: 100.2 },
      { ...base, position: 0.5 },
      { ...base, ctr: NaN },
    ];
    const result = screenSearchOpportunities(bad.map((item, i) => ({
      ...item,
      keys: ['unique sleep intent ' + i, page],
    })));
    expect(result.acceptedRows).toBe(0);
    expect(result.rejectedRows).toBe(bad.length);
  });
  it('accepts a normally rounded CTR from a trustworthy row', () => {
    const item = row('sleep research', 300, 10, 7);
    const result = screenSearchOpportunities([{ ...item, ctr: Number((7 / 300).toFixed(7)) }]);
    expect(result.acceptedRows).toBe(1);
  });
  it('flags additional sensitive medical search intents for editorial review', () => {
    for (const query of ['postpartum recovery', 'chest pain during exercise', 'insulin dose',
      'newborn sleep', 'stroke warning signs', 'self-harm prevention', 'hypertension diet']) {
      const result = screenSearchOpportunities([row(query, 200, 8)]);
      expect(result.opportunities[0].medicalReviewRequired, query).toBe(true);
    }
    const ordinary = screenSearchOpportunities([row('walking pace calculator', 200, 8)]);
    expect(ordinary.opportunities[0].medicalReviewRequired).toBe(false);
    expect(ordinary.caveats.some(x => x.includes('keyword detection is incomplete'))).toBe(true);
  });
  it('rejects oversized batches rather than silently truncating', () => {
    expect(()=>screenSearchOpportunities(new Array(25001).fill(row('sleep schedule',120,12)))).toThrow(RangeError);
  });
});
