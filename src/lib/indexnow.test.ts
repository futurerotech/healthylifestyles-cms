/** Phase 14 P1 — IndexNow queue: dry-run, secrets hygiene, debounce collapse, chaos. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queueIndexNowPing, flushIndexNowQueue, __resetIndexNowForTests } from './indexnow';

const KEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 32-hex test key (not a real secret)

beforeEach(() => {
  __resetIndexNowForTests();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('INDEXNOW_API_KEY', KEY);
});
afterEach(() => {
  __resetIndexNowForTests();
  vi.unstubAllEnvs();
});

describe('queueIndexNowPing / flushIndexNowQueue', () => {
  it('dry-run (default outside production): logs payload, sends nothing, key REDACTED', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    queueIndexNowPing(['/wellness-hub/some-article']);
    await flushIndexNowQueue();
    expect(fetchSpy).not.toHaveBeenCalled();
    const logged = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('"dryRun":true');
    expect(logged).toContain('/wellness-hub/some-article');
    expect(logged).toContain('[redacted]');
    expect(logged).not.toContain(KEY); // the key never appears in logs
  });

  it('debounce collapse: multiple publishes become ONE deduped submission', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    queueIndexNowPing(['/tools/bmi-calculator']);
    queueIndexNowPing(['/tools/bmi-calculator', '/wellness-hub/a']);
    queueIndexNowPing(['/wellness-hub/b']);
    await flushIndexNowQueue();
    const payloadLogs = logSpy.mock.calls.map((c) => c.join(' ')).filter((l) => l.includes('dryRun'));
    expect(payloadLogs).toHaveLength(1); // one batch
    expect(payloadLogs[0]).toContain('/tools/bmi-calculator');
    expect(payloadLogs[0]).toContain('/wellness-hub/a');
    expect(payloadLogs[0]).toContain('/wellness-hub/b');
    expect((payloadLogs[0].match(/bmi-calculator/g) || []).length).toBe(1); // deduped
  });

  it('missing key: no-op, no crash, no send', async () => {
    vi.stubEnv('INDEXNOW_API_KEY', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    queueIndexNowPing(['/tools/x']);
    await flushIndexNowQueue();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('kill switch INDEXNOW_DISABLE=true: queue is a no-op', async () => {
    vi.stubEnv('INDEXNOW_DISABLE', 'true');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    queueIndexNowPing(['/tools/x']);
    await flushIndexNowQueue();
    expect(logSpy.mock.calls.map((c) => c.join(' ')).join('')).not.toContain('dryRun');
  });

  it('CHAOS: endpoint unreachable → resolves without throwing, graceful structured log', async () => {
    vi.stubEnv('INDEXNOW_DRY_RUN', 'false');
    vi.stubEnv('INDEXNOW_ENDPOINT', 'http://127.0.0.1:9/indexnow'); // nothing listens
    vi.stubEnv('INDEXNOW_RETRY_DELAY_MS', '10');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    queueIndexNowPing(['/tools/x']);
    await expect(flushIndexNowQueue()).resolves.toBeUndefined(); // never throws
    const logged = errSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('network-error');
    expect(logged).not.toContain(KEY);
    expect((logged.match(/network-error/g) || []).length).toBe(2); // 1 try + 1 bounded retry
  });
});
