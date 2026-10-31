import { describe, expect, it } from 'vitest';
import { verifiedCollectionCount, isValidVercelDeployHookUrl } from './deploy-readiness';

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

describe('Vercel deployment hook URL restrictions', () => {
  it('accepts the exact HTTPS integrations deploy-hook path', () => {
    expect(isValidVercelDeployHookUrl('https://api.vercel.com/v1/integrations/deploy/prj_abc123/secret-token_1')).toBe(true);
  });
  it.each([
    undefined, '', 'http://api.vercel.com/v1/integrations/deploy/prj_ab/token',
    'https://api.vercel.com.evil.test/v1/integrations/deploy/prj_ab/token',
    'https://evil.test/v1/integrations/deploy/prj_ab/token',
    'https://api.vercel.com/other', 'https://api.vercel.com/v1/integrations/deploy/prj_ab/token#fragment',
    'https://user:pass@api.vercel.com/v1/integrations/deploy/prj_ab/token',
  ])('rejects invalid hook %s', value => {
    expect(isValidVercelDeployHookUrl(value)).toBe(false);
  });
});
