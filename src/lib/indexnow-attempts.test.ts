import { describe, expect, it, vi } from 'vitest';
import type { PostgresAdapter } from '@payloadcms/db-postgres';
import { authorizeIndexNowRetry, cancelReservedIndexNowAttempt, finishIndexNowAttempt, markIndexNowDispatching, reserveIndexNowAttempt } from './indexnow-attempts';

const id = 'd701b497-f379-45db-a105-b3002a91de96';
const item = { id: 7, changedAt: '2026-11-11T10:00:00.000Z', url: 'https://www.healthylifesstyles.com/tools/bmr-calculator' };
const input = { actorId: '123', buildStartedAt: '2026-11-11T11:00:00.000Z', items: [item] };
function fakeDb(results: unknown[][]) {
  const execute = vi.fn(async () => ({ rows: results.shift() ?? [] }));
  const transaction = vi.fn(async (fn: (tx: object) => Promise<unknown>) => fn({}));
  return { db: { execute, drizzle: { transaction } } as unknown as PostgresAdapter, execute, transaction };
}

describe('durable IndexNow attempt primitives', () => {
  it('reserves an exact approved revision in a completed transaction', async () => {
    const fake = fakeDb([[], [{ id: 7 }], [], [], []]);
    const result = await reserveIndexNowAttempt(fake.db, input);
    expect(result.status).toBe('reserved');
    if (result.status === 'reserved') expect(result.attemptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(fake.transaction).toHaveBeenCalledOnce();
    expect(fake.execute).toHaveBeenCalledTimes(5);
  });
  it('rejects stale revisions, overlapping unresolved attempts, and invalid snapshots', async () => {
    expect(await reserveIndexNowAttempt(fakeDb([[], []]).db, input)).toEqual({ status: 'stale' });
    expect(await reserveIndexNowAttempt(fakeDb([[], [{ id: 7 }], [{ id }]]).db, input)).toEqual({ status: 'review_required' });
    const invalid = fakeDb([]);
    expect(await reserveIndexNowAttempt(invalid.db, { ...input, items: [item, item] })).toEqual({ status: 'stale' });
    expect(invalid.transaction).not.toHaveBeenCalled();
  });
  it('starts dispatch only with a conditional reservation transition', async () => {
    expect(await markIndexNowDispatching(fakeDb([[], [{ id }], [{ pending_id: 7, changed_at: item.changedAt }], [{ id: 7 }], [{ id }]]).db, id)).toBe(true);
    expect(await markIndexNowDispatching(fakeDb([[], []]).db, id)).toBe(false);
    const fake = fakeDb([]);
    expect(await markIndexNowDispatching(fake.db, 'invalid')).toBe(false);
    expect(fake.execute).not.toHaveBeenCalled();
  });
  it('allows a recorded cancellation only while the attempt remains reserved', async () => {
    const success = fakeDb([[], [{ id }], []]);
    expect(await cancelReservedIndexNowAttempt(success.db, id, '456')).toBe(true);
    expect(success.execute).toHaveBeenCalledTimes(3);
    expect(await cancelReservedIndexNowAttempt(fakeDb([[], []]).db, id, '456')).toBe(false);
  });
  it('only acknowledges a matching received batch within its transaction', async () => {
    const fake = fakeDb([[{ id }], [{ pending_id: 7, changed_at: item.changedAt }], [{ id: 7 }], [{ id: 7 }], [{ id }]]);
    expect(await finishIndexNowAttempt(fake.db, id, 'received', 200)).toBe('acknowledged');
  });
  it('retains an old received attempt when its queued revision changed', async () => {
    const fake = fakeDb([[{ id }], [{ pending_id: 7, changed_at: item.changedAt }], [], [{ id }]]);
    expect(await finishIndexNowAttempt(fake.db, id, 'received', 200)).toBe('received');
    expect(fake.execute).toHaveBeenCalledTimes(4);
  });
  it('rejects an outcome inconsistent with the observed provider response', async () => {
    const fake = fakeDb([]);
    await expect(finishIndexNowAttempt(fake.db, id, 'received', 500)).rejects.toThrow('does not match');
    expect(fake.transaction).not.toHaveBeenCalled();
  });
  it('requires an explicit risk confirmation and an exact current snapshot for an audited retry', async () => {
    const review = { attemptId: id, actorId: '456', confirmRisk: true, items: [item] };
    const fake = fakeDb([[], [{ state: 'unknown' }], [{ pending_id: 7, changed_at: item.changedAt, url: item.url }], [{ id: 7 }], [], [{ id }]]);
    expect(await authorizeIndexNowRetry(fake.db, review)).toBe('authorized');
    expect(fake.execute).toHaveBeenCalledTimes(6);
    const noConsent = fakeDb([]);
    expect(await authorizeIndexNowRetry(noConsent.db, { ...review, confirmRisk: false })).toBe('stale');
    expect(noConsent.transaction).not.toHaveBeenCalled();
    const stale = fakeDb([[], [{ state: 'unknown' }], [{ pending_id: 7, changed_at: item.changedAt, url: item.url }], []]);
    expect(await authorizeIndexNowRetry(stale.db, review)).toBe('stale');
  });
  it('does not infer interruption from an in-flight attempt or permit review twice', async () => {
    const review = { attemptId: id, actorId: '456', confirmRisk: true, items: [item] };
    for (const state of ['in_flight', 'retry_authorized', 'acknowledged']) {
      expect(await authorizeIndexNowRetry(fakeDb([[], [{ state }]]).db, review)).toBe('not_reviewable');
    }
  });
  it('only resolves a changed prior attempt after explicit review without deleting the queue', async () => {
    const review = { attemptId: id, actorId: '456', confirmRisk: true, resolveChanged: true, items: [item] };
    const changed = fakeDb([[], [{ state: 'received' }], [{ pending_id: 7, changed_at: item.changedAt, url: item.url }], [], [], [{ id }]]);
    expect(await authorizeIndexNowRetry(changed.db, review)).toBe('authorized');
    expect(changed.execute).toHaveBeenCalledTimes(6);
    const unchanged = fakeDb([[], [{ state: 'unknown' }], [{ pending_id: 7, changed_at: item.changedAt, url: item.url }], [{ id: 7 }]]);
    expect(await authorizeIndexNowRetry(unchanged.db, review)).toBe('stale');
  });
});
