// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('legacy migration-marker maintenance cannot run accidentally in production', () => {
  it.each([
    { NODE_ENV: 'production', ALLOW_LOCAL_MIGRATION_MARKER_CLEANUP: 'true', DATABASE_URI: 'postgres://mock:never-connect@localhost/mock' },
    { NODE_ENV: 'development', ALLOW_LOCAL_MIGRATION_MARKER_CLEANUP: 'false', DATABASE_URI: 'postgres://mock:never-connect@localhost/mock' },
    { NODE_ENV: 'development', ALLOW_LOCAL_MIGRATION_MARKER_CLEANUP: 'true', DATABASE_URI: 'postgres://mock:never-connect@remote.example.invalid/mock' },
    { NODE_ENV: 'development', ALLOW_LOCAL_MIGRATION_MARKER_CLEANUP: 'true', DATABASE_URI: 'postgres://mock:never-connect@localhost/mock?host=remote.example.invalid' },
  ])('rejects the forbidden context before connection: $NODE_ENV / $ALLOW_LOCAL_MIGRATION_MARKER_CLEANUP', env => {
    const result = spawnSync(process.execPath, ['scripts/clear-dev-migrations.mjs'], {
      env: { ...process.env, ...env }, encoding: 'utf8', timeout: 10000, windowsHide: true,
    });
    expect(result.status).toBe(1);
    expect(result.error).toBeUndefined();
    expect(result.stderr).toMatch(/disabled in production|explicit local opt-in|restricted to a local database|authority\/path/);
    expect(result.stderr).not.toContain('never-connect');
    expect(result.stderr).not.toContain(env.DATABASE_URI);
  });
});
