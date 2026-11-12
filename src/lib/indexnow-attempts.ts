import { randomUUID } from 'node:crypto';
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import { acknowledgeIndexNowQueueRevision } from './indexnow-queue-ack';
import { classifyIndexNowResponse } from './indexnow-postdeploy';

type Tx = NonNullable<Parameters<PostgresAdapter['execute']>[0]['db']>;
type Item = { id: number | string; changedAt: string; url: string };
type Outcome = 'received' | 'pending' | 'rejected' | 'unknown';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The committed in_flight state is conservatively UNKNOWN after an interruption.
 * It never expires automatically and blocks overlapping revisions until review. */
export async function reserveIndexNowAttempt(db: PostgresAdapter, input: {
  actorId: string; buildStartedAt: string; items: readonly Item[];
}): Promise<{ status: 'reserved'; attemptId: string } | { status: 'stale' | 'review_required' }> {
  if (!input.actorId || !Number.isFinite(Date.parse(input.buildStartedAt)) || !input.items.length ||
      new Set(input.items.map(x => String(x.id))).size !== input.items.length ||
      new Set(input.items.map(x => x.url)).size !== input.items.length ||
      input.items.some(x => !/^\d+$/.test(String(x.id)) || !Number.isFinite(Date.parse(x.changedAt)) ||
        !/^https:\/\/www\.healthylifesstyles\.com\/(?:wellness-hub|tools)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.url))) {
    return { status: 'stale' };
  }
  return db.drizzle.transaction(async tx => {
    const query = (statement: ReturnType<typeof sql>) => db.execute({ db: tx as Tx, sql: statement });
    // A short transaction-scoped gate prevents overlapping reservations across
    // workers. It is committed before any external request can be started.
    await query(sql`SELECT pg_advisory_xact_lock(hashtext(${'healthylifestyles:indexnow'}::text), hashtext(${'attempt-reservation'}::text))`);
    for (const item of input.items) {
      const row = await query(sql`SELECT id FROM pending_deploys WHERE id = ${item.id} AND changed_at = ${item.changedAt} FOR UPDATE`);
      if (row.rows.length !== 1 || String((row.rows[0] as { id?: unknown }).id) !== String(item.id)) return { status: 'stale' as const };
      const previous = await query(sql`SELECT a.id FROM indexnow_attempts a JOIN indexnow_attempt_items i ON i.attempt_id = a.id
        WHERE i.pending_id = ${item.id} AND a.state IN ('reserved', 'in_flight', 'unknown', 'pending', 'rejected', 'received') LIMIT 1`);
      if (previous.rows.length) return { status: 'review_required' as const };
    }
    const attemptId = randomUUID();
    await query(sql`INSERT INTO indexnow_attempts (id, state, approved_build, actor_id)
      VALUES (${attemptId}::uuid, 'reserved', ${input.buildStartedAt}, ${input.actorId})`);
    for (const item of input.items) {
      await query(sql`INSERT INTO indexnow_attempt_items (attempt_id, pending_id, changed_at, url)
        VALUES (${attemptId}::uuid, ${item.id}, ${item.changedAt}, ${item.url})`);
    }
    return { status: 'reserved' as const, attemptId };
  });
}

/** Commit this conditional transition before opening the provider request.
 * A crash after it is ambiguous even if the request was never transmitted. */
export async function markIndexNowDispatching(db: PostgresAdapter, attemptId: string): Promise<boolean> {
  if (!UUID.test(attemptId)) return false;
  return db.drizzle.transaction(async tx => {
    const query = (statement: ReturnType<typeof sql>) => db.execute({ db: tx as Tx, sql: statement });
    await query(sql`SELECT pg_advisory_xact_lock(hashtext(${'healthylifestyles:indexnow'}::text), hashtext(${'attempt-reservation'}::text))`);
    const attempt = await query(sql`SELECT id FROM indexnow_attempts WHERE id = ${attemptId}::uuid AND state = 'reserved' FOR UPDATE`);
    if (attempt.rows.length !== 1) return false;
    const items = await query(sql`SELECT pending_id, changed_at FROM indexnow_attempt_items WHERE attempt_id = ${attemptId}::uuid ORDER BY pending_id`);
    if (!items.rows.length) return false;
    for (const item of items.rows as { pending_id: number; changed_at: string }[]) {
      const row = await query(sql`SELECT id FROM pending_deploys WHERE id = ${item.pending_id} AND changed_at = ${item.changed_at} FOR UPDATE`);
      if (row.rows.length !== 1) return false;
    }
    const result = await query(sql`UPDATE indexnow_attempts SET state = 'in_flight', updated_at = now()
      WHERE id = ${attemptId}::uuid AND state = 'reserved' RETURNING id`);
    return result.rows.length === 1 && String((result.rows[0] as { id?: unknown }).id) === attemptId;
  });
}

/** A reserved attempt has not started transmission. A conditional update
 * races safely with markIndexNowDispatching; exactly one can win. */
export async function cancelReservedIndexNowAttempt(db: PostgresAdapter, attemptId: string, actorId: string): Promise<boolean> {
  if (!UUID.test(attemptId) || !actorId) return false;
  return db.drizzle.transaction(async tx => {
    const query = (statement: ReturnType<typeof sql>) => db.execute({ db: tx as Tx, sql: statement });
    await query(sql`SELECT pg_advisory_xact_lock(hashtext(${'healthylifestyles:indexnow'}::text), hashtext(${'attempt-reservation'}::text))`);
    const updated = await query(sql`UPDATE indexnow_attempts SET state = 'not_sent', updated_at = now()
      WHERE id = ${attemptId}::uuid AND state = 'reserved' RETURNING id`);
    if (updated.rows.length !== 1) return false;
    await query(sql`INSERT INTO indexnow_attempt_reviews (id, attempt_id, actor_id, decision, reason_code)
      VALUES (${randomUUID()}::uuid, ${attemptId}::uuid, ${actorId}, 'cancel_reserved', 'dispatch_not_started')`);
    return true;
  });
}

/** Reconcile only the exact saved revisions. A failed commit leaves the
 * previously committed in_flight record intact and therefore review-required. */
export async function finishIndexNowAttempt(db: PostgresAdapter, attemptId: string,
  outcome: Outcome, providerStatus: number | null): Promise<'acknowledged' | 'received' | 'pending' | 'rejected' | 'unknown'> {
  if (!UUID.test(attemptId)) throw new Error('Invalid attempt ID');
  if (classifyIndexNowResponse(providerStatus) !== outcome) throw new Error('Provider response does not match outcome');
  return db.drizzle.transaction(async tx => {
    const query = (statement: ReturnType<typeof sql>) => db.execute({ db: tx as Tx, sql: statement });
    const attempt = await query(sql`SELECT id FROM indexnow_attempts WHERE id = ${attemptId}::uuid AND state = 'in_flight' FOR UPDATE`);
    if (attempt.rows.length !== 1) throw new Error('Attempt is not awaiting a response');
    let state: 'acknowledged' | Outcome = outcome;
    if (outcome === 'received') {
      const items = await query(sql`SELECT pending_id, changed_at FROM indexnow_attempt_items WHERE attempt_id = ${attemptId}::uuid ORDER BY pending_id`);
      if (!items.rows.length) throw new Error('Attempt has no revisions');
      // Check all first: no partial acknowledgement for a stale batch.
      let exact = true;
      for (const item of items.rows as { pending_id: number; changed_at: string }[]) {
        const row = await query(sql`SELECT id FROM pending_deploys WHERE id = ${item.pending_id} AND changed_at = ${item.changed_at} FOR UPDATE`);
        if (row.rows.length !== 1) exact = false;
      }
      if (exact) {
        for (const item of items.rows as { pending_id: number; changed_at: string }[]) {
          if (!await acknowledgeIndexNowQueueRevision(query, { id: item.pending_id, changedAt: item.changed_at })) throw new Error('Acknowledgement failed');
        }
        state = 'acknowledged';
      }
    }
    const result = await query(sql`UPDATE indexnow_attempts SET state = ${state}, provider_status = ${providerStatus}, updated_at = now()
      WHERE id = ${attemptId}::uuid AND state = 'in_flight' RETURNING id`);
    if (result.rows.length !== 1) throw new Error('Attempt state changed');
    return state;
  });
}

/** Record an explicit admin decision against the exact reviewed snapshot.
 * in_flight is intentionally NOT eligible: elapsed time cannot prove the
 * original process has stopped. Resolving a crashed worker needs a separately
 * verified operational recovery procedure, not automatic lease expiry. */
export async function authorizeIndexNowRetry(db: PostgresAdapter, input: {
  attemptId: string; actorId: string; confirmRisk: boolean; items: readonly Item[]; resolveChanged?: boolean;
}): Promise<'authorized' | 'stale' | 'not_reviewable'> {
  if (!UUID.test(input.attemptId) || !input.actorId || input.confirmRisk !== true || !Array.isArray(input.items) || !input.items.length ||
      new Set(input.items.map(x => String(x.id))).size !== input.items.length) return 'stale';
  return db.drizzle.transaction(async tx => {
    const query = (statement: ReturnType<typeof sql>) => db.execute({ db: tx as Tx, sql: statement });
    await query(sql`SELECT pg_advisory_xact_lock(hashtext(${'healthylifestyles:indexnow'}::text), hashtext(${'attempt-reservation'}::text))`);
    const attempt = await query(sql`SELECT state FROM indexnow_attempts WHERE id = ${input.attemptId}::uuid FOR UPDATE`);
    const state = (attempt.rows[0] as { state?: string } | undefined)?.state;
    if (!state || !['unknown', 'pending', 'rejected', 'received'].includes(state)) return 'not_reviewable';
    const saved = await query(sql`SELECT pending_id, changed_at, url FROM indexnow_attempt_items WHERE attempt_id = ${input.attemptId}::uuid ORDER BY pending_id`);
    if (saved.rows.length !== input.items.length) return 'stale';
    const supplied = new Map(input.items.map(x => [String(x.id), x]));
    let changed = false;
    for (const row of saved.rows as { pending_id: number; changed_at: string; url: string }[]) {
      const item = supplied.get(String(row.pending_id));
      if (!item || item.changedAt !== row.changed_at || item.url !== row.url) return 'stale';
      const current = await query(sql`SELECT id FROM pending_deploys WHERE id = ${row.pending_id} AND changed_at = ${row.changed_at} FOR UPDATE`);
      if (current.rows.length !== 1) changed = true;
    }
    if (changed !== (input.resolveChanged === true)) return 'stale';
    const decision = changed ? 'resolve_changed' : 'authorize_retry';
    const reason = changed ? 'content_changed' : state === 'rejected' ? 'provider_rejected' : 'reviewed_duplicate_risk';
    const nextState = changed ? 'resolved_changed' : 'retry_authorized';
    await query(sql`INSERT INTO indexnow_attempt_reviews (id, attempt_id, actor_id, decision, reason_code)
      VALUES (${randomUUID()}::uuid, ${input.attemptId}::uuid, ${input.actorId}, ${decision}, ${reason})`);
    const updated = await query(sql`UPDATE indexnow_attempts SET state = ${nextState}, updated_at = now()
      WHERE id = ${input.attemptId}::uuid AND state = ${state} RETURNING id`);
    if (updated.rows.length !== 1) throw new Error('Attempt state changed');
    return 'authorized';
  });
}
