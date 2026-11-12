import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPayload } from 'payload';
import type { PostgresAdapter } from '@payloadcms/db-postgres';
import { acknowledgeIndexNowQueueRevision } from '../../src/lib/indexnow-queue-ack';
import { recordPublishedPendingChange } from '../../src/lib/indexnow-pending-queue';
import { reserveManualDeployAttempt } from '../../src/lib/manual-deploy-reservation';
import { trackPendingChange } from '../../src/hooks/trackPendingChange';
import { withIndexNowSubmissionLock } from '../../src/lib/indexnow-submission-lock';
import { reserveIndexNowAttempt, markIndexNowDispatching, cancelReservedIndexNowAttempt, finishIndexNowAttempt, authorizeIndexNowRetry } from '../../src/lib/indexnow-attempts';

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

  it('persists an unresolved attempt and blocks overlapping confirmations on PostgreSQL', async () => {
    const pending = await createPending('2026-11-11T10:00:00.000Z');
    const input = { actorId: 'ci-admin', buildStartedAt: '2026-11-11T11:00:00.000Z', items: [{ id: pending.id,
      changedAt: pending.changedAt, url: 'https://www.healthylifesstyles.com/wellness-hub/ci-test' }] };
    const results = await Promise.all([reserveIndexNowAttempt(db, input), reserveIndexNowAttempt(db, input)]);
    expect(results.filter(r => r.status === 'reserved')).toHaveLength(1);
    expect(results.filter(r => r.status === 'review_required')).toHaveLength(1);
    const reserved = results.find(r => r.status === 'reserved');
    if (!reserved || reserved.status !== 'reserved') throw new Error('Reservation missing');
    // Simulate interruption both before dispatch and after dispatch begins.
    expect(await reserveIndexNowAttempt(db, input)).toEqual({ status: 'review_required' });
    expect(await markIndexNowDispatching(db, reserved.attemptId)).toBe(true);
    expect(await markIndexNowDispatching(db, reserved.attemptId)).toBe(false);
    expect(await reserveIndexNowAttempt(db, input)).toEqual({ status: 'review_required' });
    expect(await finishIndexNowAttempt(db, reserved.attemptId, 'unknown', null)).toBe('unknown');
    expect(await reserveIndexNowAttempt(db, input)).toEqual({ status: 'review_required' });
    expect((await payload.findByID({ collection: 'pending-deploys', id: pending.id })).changedAt).toBe(pending.changedAt);
  });

  it('acknowledges only an exact revision after a simulated provider receipt', async () => {
    const pending = await createPending('2026-11-11T12:00:00.000Z');
    const input = { actorId: 'ci-admin', buildStartedAt: '2026-11-11T13:00:00.000Z', items: [{ id: pending.id,
      changedAt: pending.changedAt, url: 'https://www.healthylifesstyles.com/tools/bmr-calculator' }] };
    const reserved = await reserveIndexNowAttempt(db, input);
    if (reserved.status !== 'reserved') throw new Error('Reservation missing');
    expect(await markIndexNowDispatching(db, reserved.attemptId)).toBe(true);
    expect(await finishIndexNowAttempt(db, reserved.attemptId, 'received', 200)).toBe('acknowledged');
    expect((await payload.find({ collection: 'pending-deploys', where: { id: { equals: pending.id } } })).totalDocs).toBe(0);
  });

  it('allows exactly one of dispatch or cancellation to win a reserved attempt', async () => {
    const pending = await createPending('2026-11-11T12:30:00.000Z');
    const input = { actorId: 'ci-admin', buildStartedAt: '2026-11-11T13:30:00.000Z', items: [{ id: pending.id,
      changedAt: pending.changedAt, url: 'https://www.healthylifesstyles.com/tools/bmr-calculator' }] };
    const reserved = await reserveIndexNowAttempt(db, input);
    if (reserved.status !== 'reserved') throw new Error('Reservation missing');
    const [sent, cancelled] = await Promise.all([
      markIndexNowDispatching(db, reserved.attemptId),
      cancelReservedIndexNowAttempt(db, reserved.attemptId, 'ci-admin'),
    ]);
    expect(Number(sent) + Number(cancelled)).toBe(1);
    const next = await reserveIndexNowAttempt(db, input);
    expect(next.status).toBe(sent ? 'review_required' : 'reserved');
  });

  it('preserves a newer revision if the provider receives an older reserved batch', async () => {
    const pending = await createPending('2026-11-11T14:00:00.000Z');
    const input = { actorId: 'ci-admin', buildStartedAt: '2026-11-11T15:00:00.000Z', items: [{ id: pending.id,
      changedAt: pending.changedAt, url: 'https://www.healthylifesstyles.com/tools/bmr-calculator' }] };
    const reserved = await reserveIndexNowAttempt(db, input);
    if (reserved.status !== 'reserved') throw new Error('Reservation missing');
    expect(await markIndexNowDispatching(db, reserved.attemptId)).toBe(true);
    const newer = '2026-11-11T14:01:00.000Z';
    await payload.update({ collection: 'pending-deploys', id: pending.id, data: { changedAt: newer } });
    expect(await finishIndexNowAttempt(db, reserved.attemptId, 'received', 200)).toBe('received');
    expect((await payload.findByID({ collection: 'pending-deploys', id: pending.id })).changedAt).toBe(newer);
    const updated = { ...input, items: [{ ...input.items[0], changedAt: newer }] };
    expect(await reserveIndexNowAttempt(db, updated)).toEqual({ status: 'review_required' });
  });

  it('requires an audited exact-snapshot decision before retrying an unknown outcome', async () => {
    const pending = await createPending('2026-11-11T16:00:00.000Z');
    const input = { actorId: 'ci-admin', buildStartedAt: '2026-11-11T17:00:00.000Z', items: [{ id: pending.id,
      changedAt: pending.changedAt, url: 'https://www.healthylifesstyles.com/tools/bmr-calculator' }] };
    const reserved = await reserveIndexNowAttempt(db, input);
    if (reserved.status !== 'reserved') throw new Error('Reservation missing');
    expect(await markIndexNowDispatching(db, reserved.attemptId)).toBe(true);
    const review = { attemptId: reserved.attemptId, actorId: 'ci-admin', confirmRisk: true, items: input.items };
    expect(await authorizeIndexNowRetry(db, review)).toBe('not_reviewable');
    expect(await finishIndexNowAttempt(db, reserved.attemptId, 'unknown', null)).toBe('unknown');
    expect(await reserveIndexNowAttempt(db, input)).toEqual({ status: 'review_required' });
    expect(await authorizeIndexNowRetry(db, { ...review, confirmRisk: false })).toBe('stale');
    expect(await authorizeIndexNowRetry(db, review)).toBe('authorized');
    expect(await authorizeIndexNowRetry(db, review)).toBe('not_reviewable');
    const audit = await db.pool.query('SELECT decision, reason_code FROM indexnow_attempt_reviews WHERE attempt_id=$1', [reserved.attemptId]);
    expect(audit.rows).toEqual([{ decision: 'authorize_retry', reason_code: 'reviewed_duplicate_risk' }]);
    expect((await reserveIndexNowAttempt(db, input)).status).toBe('reserved');
  });

  it('serializes simultaneous confirmed submissions on real PostgreSQL and rejects a stale retry', async () => {
    const pending = await createPending('2026-10-28T10:00:00.000Z');
    let release!: () => void;
    let entered!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    let sends = 0;
    const rev = { id: pending.id, changedAt: pending.changedAt };
    const first = withIndexNowSubmissionLock(db, [rev], async query => {
      sends++; entered(); await wait;
      expect(await acknowledgeIndexNowQueueRevision(query, rev)).toBe(true);
      return 'accepted';
    });
    try {
      await started;
      expect(await withIndexNowSubmissionLock(db, [rev], async () => { sends++; })).toEqual({ status: 'busy' });
    } finally { release(); }
    expect(await first).toEqual({ status: 'completed', value: 'accepted' });
    expect(await withIndexNowSubmissionLock(db, [rev], async () => { sends++; })).toEqual({ status: 'stale' });
    expect(sends).toBe(1);
  });

  it('queues actual article publishes and updates but not draft saves or isolated staging', async () => {
    const slug = `ci-article-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const article = await payload.create({
      collection: 'articles', draft: true,
      data: { title: 'CI article lifecycle', slug, _status: 'draft' },
    });
    const queue = () => payload.find({
      collection: 'pending-deploys', depth: 0, limit: 10,
      where: { and: [
        { collectionSlug: { equals: 'articles' } },
        { docId: { equals: String(article.id) } },
      ] },
    });
    expect((await queue()).totalDocs).toBe(0);

    await payload.update({ collection: 'articles', id: article.id, draft: false,
      data: { title: 'CI published article', _status: 'published' } });
    const published = await queue();
    expect(published.totalDocs).toBe(1);
    const initial = published.docs[0]!;

    await payload.update({ collection: 'articles', id: article.id, draft: true,
      data: { title: 'CI draft revision' } });
    const afterDraft = await queue();
    expect(afterDraft.totalDocs).toBe(1);
    expect(afterDraft.docs[0]!.changedAt).toBe(initial.changedAt);
    const publicArticle = await payload.findByID({
      collection: 'articles', id: article.id, draft: false, overrideAccess: false,
    });
    expect(publicArticle.title).toBe('CI published article');

    await payload.update({ collection: 'articles', id: article.id, draft: false,
      data: { title: 'CI published revision', _status: 'published' } });
    const updated = await queue();
    expect(updated.totalDocs).toBe(1);
    expect(updated.docs[0]!.id).toBe(initial.id);
    expect(Date.parse(updated.docs[0]!.changedAt)).toBeGreaterThan(Date.parse(initial.changedAt));

    const priorStage = process.env.HLS_ISOLATED_STAGING;
    try {
      process.env.HLS_ISOLATED_STAGING = 'true';
      await payload.update({ collection: 'articles', id: article.id, draft: false,
        data: { title: 'CI isolated staging revision', _status: 'published' } });
    } finally {
      if (priorStage === undefined) delete process.env.HLS_ISOLATED_STAGING;
      else process.env.HLS_ISOLATED_STAGING = priorStage;
    }
    const afterStage = await queue();
    expect(afterStage.totalDocs).toBe(1);
    expect(afterStage.docs[0]!.changedAt).toBe(updated.docs[0]!.changedAt);
  });

  it('rolls back the article and queue together if a later Payload hook fails', async () => {
    const slug = `ci-article-rollback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const article = await payload.create({
      collection: 'articles', draft: false,
      data: { title: 'CI rollback original', slug, _status: 'published' },
    });
    const findQueue = () => payload.find({
      collection: 'pending-deploys', depth: 0, limit: 10,
      where: { and: [
        { collectionSlug: { equals: 'articles' } },
        { docId: { equals: String(article.id) } },
      ] },
    });
    const before = await findQueue();
    expect(before.totalDocs).toBe(1);
    const hooks = payload.collections.articles.config.hooks.afterChange;
    const failAfterQueue = () => { throw new Error('CI deliberate post-queue failure'); };
    hooks.push(failAfterQueue);
    try {
      await expect(payload.update({
        collection: 'articles', id: article.id, draft: false,
        data: { title: 'CI rolled back update', _status: 'published' },
      })).rejects.toThrow('CI deliberate post-queue failure');
    } finally {
      const index = hooks.indexOf(failAfterQueue);
      if (index !== -1) hooks.splice(index, 1);
    }
    const stored = await payload.findByID({ collection: 'articles', id: article.id, draft: false });
    const after = await findQueue();
    expect(stored.title).toBe('CI rollback original');
    expect(after.totalDocs).toBe(1);
    expect(after.docs[0]!.id).toBe(before.docs[0]!.id);
    expect(after.docs[0]!.changedAt).toBe(before.docs[0]!.changedAt);
  });

  it.each(['articles', 'tools'] as const)('does not queue published-parent drafts or isolated staging saves for %s', async collectionSlug => {
    const docId = `draft-isolation-${collectionSlug}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const base = { doc: { id: docId, _status: 'published' }, collection: { slug: collectionSlug },
      req: { payload, query: {}, transactionID: undefined } };
    const oldStage = process.env.HLS_ISOLATED_STAGING;
    try {
      for (const draft of [true, 'true']) {
        await trackPendingChange({ ...base, req: { ...base.req, query: { draft } } } as never);
      }
      process.env.HLS_ISOLATED_STAGING = 'true';
      await trackPendingChange(base as never);
    } finally {
      if (oldStage === undefined) delete process.env.HLS_ISOLATED_STAGING;
      else process.env.HLS_ISOLATED_STAGING = oldStage;
    }
    const before = await payload.count({ collection: 'pending-deploys', where: { and: [
      { collectionSlug: { equals: collectionSlug } }, { docId: { equals: docId } },
    ] } });
    expect(before.totalDocs).toBe(0);
    try {
      process.env.HLS_ISOLATED_STAGING = 'false';
      await trackPendingChange(base as never);
    } finally {
      if (oldStage === undefined) delete process.env.HLS_ISOLATED_STAGING;
      else process.env.HLS_ISOLATED_STAGING = oldStage;
    }
    const after = await payload.count({ collection: 'pending-deploys', where: { and: [
      { collectionSlug: { equals: collectionSlug } }, { docId: { equals: docId } },
    ] } });
    expect(after.totalDocs).toBe(1);
  });

  it('reserves exactly one of two competing manual deploy triggers', async () => {
    // Isolated CI database only. Test is independent of the provider hook.
    await db.pool.query("DELETE FROM deploy_log WHERE triggered_by = 'ci-indexnow-reservation@example.invalid'");
    const attempts = await Promise.all([
      reserveManualDeployAttempt(db, 'ci-indexnow-reservation@example.invalid'),
      reserveManualDeployAttempt(db, 'ci-indexnow-reservation@example.invalid'),
    ]);
    expect(attempts.filter(x => x.status === 'reserved')).toHaveLength(1);
    expect(attempts.filter(x => x.status === 'cooldown')).toHaveLength(1);
    const logs = await db.pool.query(
      "SELECT id FROM deploy_log WHERE triggered_by = 'ci-indexnow-reservation@example.invalid'",
    );
    expect(logs.rows).toHaveLength(1);
  });

  it('detects duplicate historical queue identities even when records are on different pages', async () => {
    const docId = 'historical-duplicate-' + Date.now() + '-' + Math.random();
    await payload.create({ collection: 'pending-deploys', data: {
      collectionSlug: 'articles', docId, changedAt: '2026-10-28T08:00:00.000Z',
    } });
    await payload.create({ collection: 'pending-deploys', data: {
      collectionSlug: 'articles', docId, changedAt: '2026-10-28T08:01:00.000Z',
    } });
    const duplicates = await payload.count({ collection: 'pending-deploys',
      where: { and: [
        { collectionSlug: { equals: 'articles' } },
        { docId: { equals: docId } },
      ] },
    });
    expect(duplicates.totalDocs).toBe(2);
  });

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
