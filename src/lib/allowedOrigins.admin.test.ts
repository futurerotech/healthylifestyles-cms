import { describe, expect, it } from 'vitest';
import { isAllowedAdminMutationOrigin, CMS_ORIGIN, FRONTEND_ORIGIN } from './allowedOrigins';
describe('admin mutation origin', () => {
  it('permits only CMS origin for production administrative writes', () => {
    expect(isAllowedAdminMutationOrigin(CMS_ORIGIN, true)).toBe(true);
    expect(isAllowedAdminMutationOrigin(FRONTEND_ORIGIN, true)).toBe(false);
    expect(isAllowedAdminMutationOrigin(null, true)).toBe(false);
    expect(isAllowedAdminMutationOrigin('https://cms.healthylifesstyles.com.evil.test', true)).toBe(false);
  });
});
