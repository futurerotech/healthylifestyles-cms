import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const script = path.resolve('scripts/seo/gsc-isolated-property-probe.mjs');

/**
 * These tests execute the real Node CLI process. They deliberately provide a
 * minimal, fake environment and never mount credentials or call Google.
 */
const invoke = (args: string[], overrides: Record<string,string> = {}) =>
  spawnSync(process.execPath, [script, ...args], {
    env: { PATH: process.env.PATH || '', ...overrides },
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 5_000,
    maxBuffer: 16_384,
  });

describe('isolated GSC CLI real-process safety smoke', () => {
  it('runs without arguments as a network-free, credential-free check', () => {
    const r = invoke([]);
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('CHECK_ONLY');
    expect(r.stderr).toBe('');
  });

  it('runs --check even with fake secrets present without revealing them', () => {
    const secret = 'DEMO_SECRET_MUST_NOT_APPEAR';
    const r = invoke(['--check'], {
      GOOGLE_APPLICATION_CREDENTIALS: '/not-mounted/'+secret+'.json',
      HLS_GSC_EXPECTED_SERVICE_ACCOUNT_EMAIL: 'fake-'+secret+'@example.test',
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('CHECK_ONLY');
    expect(r.stdout + r.stderr).not.toContain(secret);
    expect(r.stderr).toBe('');
  });

  it('rejects --execute without permission and conceals configured values', () => {
    const secret = 'PRIVATE_FICTIONAL_KEY_PATH';
    const r = invoke(['--execute'], {
      GOOGLE_APPLICATION_CREDENTIALS: '/private/'+secret+'.json',
      HLS_GSC_EXPECTED_SERVICE_ACCOUNT_EMAIL: 'demo@example.test',
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr.trim()).toBe('GSC_PROPERTY_PROBE_BLOCKED_OR_FAILED');
    expect(r.stderr).not.toContain(secret);
  });

  it('rejects unknown flags with the same generic failure receipt', () => {
    const r = invoke(['--execute', '--read-analytics']);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr.trim()).toBe('GSC_PROPERTY_PROBE_BLOCKED_OR_FAILED');
  });
});
