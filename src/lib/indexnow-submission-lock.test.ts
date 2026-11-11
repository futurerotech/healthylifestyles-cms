import { describe, expect, it, vi } from 'vitest';
import type { PostgresAdapter } from '@payloadcms/db-postgres';
import { withIndexNowSubmissionLock } from './indexnow-submission-lock';

const revision = { id: 7, changedAt: '2026-11-11T10:00:00.000Z' };

function mockDb(rowPresent = true) {
  let locked = false;
  const db = {
    drizzle: {
      transaction: async (fn: (tx: { calls: number; ownsLock: boolean }) => Promise<unknown>) => {
        const tx = { calls: 0, ownsLock: false };
        try { return await fn(tx); }
        finally { if (tx.ownsLock) locked = false; }
      },
    },
    execute: async ({ db: tx }: { db: { calls: number; ownsLock: boolean } }) => {
      if (tx.calls++ === 0) {
        if (locked) return { rows: [{ acquired: false }] };
        locked = true; tx.ownsLock = true;
        return { rows: [{ acquired: true }] };
      }
      return { rows: rowPresent ? [{ id: revision.id }] : [] };
    },
  };
  return db as unknown as PostgresAdapter;
}

describe('IndexNow concurrent confirmation guard', () => {
  it('allows only one concurrent provider callback', async () => {
    const db = mockDb();
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const firstSend = vi.fn(async () => { entered(); await wait; return 'sent'; });
    const secondSend = vi.fn();
    const first = withIndexNowSubmissionLock(db, [revision], firstSend);
    await started;
    expect(await withIndexNowSubmissionLock(db, [revision], secondSend)).toEqual({ status: 'busy' });
    expect(secondSend).not.toHaveBeenCalled();
    release();
    expect(await first).toEqual({ status: 'completed', value: 'sent' });
    expect(firstSend).toHaveBeenCalledOnce();
  });

  it('refuses stale, empty, duplicated, and invalid revisions before provider calls', async () => {
    const send = vi.fn();
    expect(await withIndexNowSubmissionLock(mockDb(false), [revision], send)).toEqual({ status: 'stale' });
    expect(await withIndexNowSubmissionLock(mockDb(), [], send)).toEqual({ status: 'stale' });
    expect(await withIndexNowSubmissionLock(mockDb(), [revision, revision], send)).toEqual({ status: 'stale' });
    expect(await withIndexNowSubmissionLock(mockDb(), [{ ...revision, changedAt: 'bad' }], send)).toEqual({ status: 'stale' });
    expect(send).not.toHaveBeenCalled();
  });

  it('releases the lock after a failed callback and permits a later retry', async () => {
    const db = mockDb();
    await expect(withIndexNowSubmissionLock(db, [revision], async () => { throw new Error('synthetic failure'); })).rejects.toThrow('synthetic failure');
    expect(await withIndexNowSubmissionLock(db, [revision], async () => 'retry')).toEqual({ status: 'completed', value: 'retry' });
  });
});
