import { describe, expect, it } from 'vitest';
import { verifiedCollectionCount } from './deploy-readiness';

describe('deployment count validation', () => {
  it('accepts zero and positive counts only when the query succeeded', () => {
    expect(verifiedCollectionCount({totalDocs:0})).toBe(0);
    expect(verifiedCollectionCount({totalDocs:3})).toBe(3);
  });
  it('fails closed on missing, malformed, negative or fractional counts', () => {
    for (const response of [null, undefined, {}, [], {totalDocs:null}, {totalDocs:-1}, {totalDocs:1.5}, {totalDocs:'0'}, {totalDocs:Infinity}]) {
      expect(() => verifiedCollectionCount(response)).toThrow();
    }
  });
});
