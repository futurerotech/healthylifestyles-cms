import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';

type TransactionDB = NonNullable<Parameters<PostgresAdapter['execute']>[0]['db']>;
type Revision = { id: number | string; changedAt: string };

/** Serialize confirmed batches and recheck their rows in the same transaction.
 * A network timeout or process crash after provider acceptance is ambiguous;
 * this lock cannot guarantee exactly-once delivery across such failures.
 */
export async function withIndexNowSubmissionLock<T>(
  db: PostgresAdapter,
  revisions: readonly Revision[],
  submit: (execute: (statement: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }>) => Promise<T>,
): Promise<{ status: 'busy' } | { status: 'stale' } | { status: 'completed'; value: T }> {
  if (!revisions.length || new Set(revisions.map(r => String(r.id))).size !== revisions.length) {
    return { status: 'stale' };
  }
  return db.drizzle.transaction(async tx => {
    const execute = (statement: ReturnType<typeof sql>) => db.execute({ db: tx as TransactionDB, sql: statement });
    const lock = await execute(sql`SELECT pg_try_advisory_xact_lock(
      hashtext(${'healthylifestyles:indexnow'}::text), hashtext(${'confirmed-submission'}::text)
    ) AS acquired`);
    if ((lock.rows[0] as { acquired?: unknown } | undefined)?.acquired !== true) return { status: 'busy' as const };
    for (const revision of revisions) {
      if (!Number.isFinite(Date.parse(revision.changedAt))) return { status: 'stale' as const };
      const row = await execute(sql`SELECT id FROM pending_deploys
        WHERE id = ${revision.id} AND changed_at = ${revision.changedAt} FOR UPDATE`);
      if (row.rows.length !== 1 || String((row.rows[0] as { id?: unknown }).id) !== String(revision.id)) {
        return { status: 'stale' as const };
      }
    }
    return { status: 'completed' as const, value: await submit(execute) };
  });
}
