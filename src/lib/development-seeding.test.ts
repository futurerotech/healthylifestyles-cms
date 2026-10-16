// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { canSeedDevelopmentDefaults } from './development-seeding';

describe('startup seeding boundary', () => {
  it.each([
    {}, { NODE_ENV: 'production' }, { NODE_ENV: 'production', ALLOW_DEFAULT_TEMPLATE_SEED: 'true' },
    { NODE_ENV: 'test' }, { NODE_ENV: 'development' },
  ])('does not permit implicit or production writes: %j', env => {
    expect(canSeedDevelopmentDefaults(env)).toBe(false);
  });
  it('permits explicit development initialization', () => {
    expect(canSeedDevelopmentDefaults({ NODE_ENV: 'development', ALLOW_DEFAULT_TEMPLATE_SEED: 'true' })).toBe(true);
  });
});
