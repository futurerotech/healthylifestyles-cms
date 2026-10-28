import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPayload } from 'payload';
import type { PostgresAdapter } from '@payloadcms/db-postgres';
import { acknowledgeIndexNowQueueRevision } from '../../src/lib/indexnow-queue-ack';
import { recordPublishedPendingChange } from '../../src/lib/indexnow-pending-queue';

// The tests below write ONLY to CI's disposable local mock PostgreSQL service.
// Fail before loading the CMS or opening a connection in every other environment.
const uri = new URL(process.env.DATABASE_URI || 'postgres://invalid/invalid');
if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.RUN_DATABASE_TESTS !== '1' ||
    process.env.NODE_ENV !== 'production' ||
    process.env.INDEXNOW_DISABLE !== 'true' ||
    !['localhost', '127.0.0.1'].includes(uri.hostname) ||
    uri.username !== 'mock' || uri.pathname !== '/mock' ||
    process.env.S3_ENDPOINT || process.env.VERCEL_DEPLOY_HOOK_URL) {
  throw new Error('IndexNow queue integration tests require CI disposable mock PostgreSQL, no real integrations.');
}

describe('IndexNow exact-revision acknowledgement in real disposable PostgreSQL', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>;
  let db: PostgresAdapter;

  const execute = (statement: Parameters<typeof acknowledgeIndexNowQueueRevision>[0] extends
    (arg: infer T) => unknown ? T : never) =>
    db.execute({
      drizzle: db.drizzle as Parameters<PostgresAdapter['execute']>[0]['drizzle'],
      sql: statement,
    });

  const createPending = async (changedAt: string) => {
    const suffix = `indexnow-ack-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return payload.create({ collection: 'pending-deploys', data: {
      collectionSlug: 'articles', docId: suffix, changedAt,
    } });
  };

  beforeAll(async () => {
    const config = (await import('../../payload.config')).default;
    payload = await getPayload({ config });
    db = payload.db as unknown as PostgresAdapter;
    expect(db.pool).toBeDefined();
    expect(db.drizzle).toBeDefined();
    expect(db.push).toBe(false);
  });

  afterAll(async () => { await payload?.destroy(); });

  it('deduplicates simultaneous initial publishes in the actual PostgreSQL queue', async () => {
    const docId = `indexnow-concurrent-${Date.now()}-${Math.random()}`;
    const older = '2026-10-28T10:00:00.000Z';
    const newer = '2026-10-28T11:00:00.000Z';
    await Promise.all(Array.from({length: 8}, (_, i) =>
      recordPublishedPendingChange(db, { collectionSlug: 'articles', docId, changedAt: i % 2 ? older : newer })
    ));
    const result = await db.pool.query(
      'SELECT id, changed_at FROM pending_deploys WHERE collection_slug = $1 AND doc_id = $2',
      ['articles', docId],
    );
    expect(result.rows).toHaveLength(1);
    expect(Date.parse(result.rows[0].changed_at)).toBeGreaterThanOrEqual(Date.parse(newer));
  });

  it('protects a newer publish with identical input millisecond from stale acknowledgement', async () => {
    const docId = 'same-ms-' + Date.now() + '-' + Math.random();
    const when = '2026-10-28T11:10:00.000Z';
    await recordPublishedPendingChange(db, { collectionSlug: 'articles', docId, changedAt: when });
    const first = await db.pool.query('SELECT id, changed_at FROM pending_deploys WHERE collection_slug=$1 AND doc_id=$2', ['articles', docId]);
    await recordPublishedPendingChange(db, { collectionSlug: 'articles', docId, changedAt: when });
    const second = await db.pool.query('SELECT id, changed_at FROM pending_deploys WHERE collection_slug=$1 AND doc_id=$2', ['articles', docId]);
    expect(second.rows).toHaveLength(1);
    expect(second.rows[0].id).toBe(first.rows[0].id);
    expect(Date.parse(second.rows[0].changed_at)).toBeGreaterThan(Date.parse(first.rows[0].changed_at));
    expect(await acknowledgeIndexNowQueueRevision(execute, { id: first.rows[0].id, changedAt: first.rows[0].changed_at })).toBe(false);
    expect(await acknowledgeIndexNowQueueRevision(execute, { id: second.rows[0].id, changedAt: second.rows[0].changed_at })).toBe(true);
  });

  it('rolls back a queued publication with its Payload parent transaction', async () => {
    const docId = `rollback-${Date.now()}-${Math.random()}`;
    const transactionID = await payload.db.beginTransaction();
    expect(transactionID).toBeTruthy();
    try {
      await recordPublishedPendingChange(db, {
        collectionSlug: 'articles', docId, changedAt: '2026-10-28T12:30:00.000Z',
      }, transactionID!);
    } finally {
      await payload.db.rollbackTransaction(transactionID!);
    }
    const rows = await db.pool.query(
      'SELECT id FROM pending_deploys WHERE collection_slug = $1 AND doc_id = $2',
      ['articles', docId],
    );
    expect(rows.rows).toHaveLength(0);
  });

  it('preserves a queued publish when a real parent transaction commits during acknowledgement', async () => {
    const old = '2026-10-28T14:00:00.000Z';
    const newer = '2026-10-28T14:01:00.000Z';
    const pending = await createPending(old);
    const txId = await payload.db.beginTransaction();
    expect(txId).toBeTruthy();
    let open = true;
    try {
      await recordPublishedPendingChange(db, {
        collectionSlug: 'articles', docId: pending.docId, changedAt: newer,
      }, txId!);
      // The acknowledgement must wait for the parent content transaction's
      // row lock and must not erase the committed newer pending revision.
      const acknowledgement = acknowledgeIndexNowQueueRevision(execute, {
        id: pending.id, changedAt: old,
      });
      const state = await Promise.race([
        acknowledgement.then(() => 'finished'),
        new Promise<string>(resolve => setTimeout(() => resolve('blocked'), 40)),
      ]);
      expect(state).toBe('blocked');
      await payload.db.commitTransaction(txId!);
      open = false;
      expect(await acknowledgement).toBe(false);
      const stillQueued = await payload.findByID({ collection: 'pending-deploys', id: pending.id });
      expect(stillQueued.changedAt).toBe(newer);
    } finally {
      if (open) await payload.db.rollbackTransaction(txId!);
    }
  });

  it('recreates a pending record when an older acknowledgement commits before a new publish', async () => {
    const old = '2026-10-28T15:00:00.000Z';
    const newer = '2026-10-28T15:01:00.000Z';
    const pending = await createPending(old);
    expect(await acknowledgeIndexNowQueueRevision(execute, {
      id: pending.id, changedAt: old,
    })).toBe(true);
    expect(await recordPublishedPendingChange(db, {
      collectionSlug: 'articles', docId: pending.docId, changedAt: newer,
    })).toBe('inserted');
    const queued = await payload.find({
      collection: 'pending-deploys', depth: 0,
      where: {
        and: [
          { collectionSlug: { equals: 'articles' } },
          { docId: { equals: pending.docId } },
        ],
      },
      limit: 5,
    });
    expect(queued.totalDocs).toBe(1);
    expect(queued.docs[0]?.changedAt).toBe(newer);
    expect(queued.docs[0]?.id).not.toBe(pending.id);
  });

  it('rejects a stale revision and only deletes the exact revision', async () => {
    const old = '2026-10-28T10:00:00.000Z';
    const updated = '2026-10-28T11:00:00.000Z';
    const pending = await createPending(old);
    await payload.update({ collection: 'pending-deploys', id: pending.id, data: { changedAt: updated } });
    expect(await acknowledgeIndexNowQueueRevision(execute, { id: pending.id, changedAt: old })).toBe(false);
    expect((await payload.findByID({ collection: 'pending-deploys', id: pending.id })).changedAt).toBe(updated);
    expect(await acknowledgeIndexNowQueueRevision(execute, { id: pending.id, changedAt: updated })).toBe(true);
    expect((await payload.find({ collection: 'pending-deploys',
      where: { id: { equals: pending.id } }, limit: 1 })).totalDocs).toBe(0);
  });

  it('waits for an in-flight publisher UPDATE and preserves its newer version', async () => {
    const old = '2026-10-28T12:00:00.000Z';
    const newer = '2026-10-28T12:01:00.000Z';
    const pending = await createPending(old);
    const writer = await db.pool.connect();
    let inTransaction = false;
    try {
      await writer.query('BEGIN');
      inTransaction = true;
      await writer.query('UPDATE pending_deploys SET changed_at = $1 WHERE id = $2', [newer, pending.id]);
      const acknowledgement = acknowledgeIndexNowQueueRevision(execute, { id: pending.id, changedAt: old });
      // The DELETE has to wait on PostgreSQL's row lock, then re-evaluate
      // changed_at after COMMIT. This must never delete the newer revision.
      const observed = await Promise.race([
        acknowledgement.then(() => 'finished'),
        new Promise<string>((resolve) => setTimeout(() => resolve('blocked'), 40)),
      ]);
      expect(observed).toBe('blocked');
      await writer.query('COMMIT');
      inTransaction = false;
      expect(await acknowledgement).toBe(false);
      expect((await payload.findByID({ collection: 'pending-deploys', id: pending.id })).changedAt).toBe(newer);
      expect(await acknowledgeIndexNowQueueRevision(execute, { id: pending.id, changedAt: newer })).toBe(true);
    } finally {
      if (inTransaction) await writer.query('ROLLBACK');
      writer.release();
    }
  });
});
