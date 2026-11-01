import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import { verifiedCollectionCount } from './deploy-readiness';

type TransactionDB = NonNullable<Parameters<PostgresAdapter['execute']>[0]['db']>;
export type ManualDeployReservation =
  | { status: 'reserved'; pendingCount: number }
  | { status: 'cooldown' };

/**
 * Reserve one manual deploy attempt BEFORE an external Vercel call.
 *
 * The transaction-scoped advisory lock serializes competing admin requests.
 * The cooldown read, queue count, and durable reservation log are committed
 * together. If logging fails, the transaction rolls back and the caller MUST
 * NOT invoke the deploy hook. An ambiguous/rejected Vercel request retains the
 * reservation for five minutes to avoid uncontrolled duplicate submissions.
 *
 * The deploy log records a trigger ATTEMPT, not proof of a Ready deployment.
 * Queued changes are never removed here.
 */
export async function reserveManualDeployAttempt(
  db: PostgresAdapter,
  triggeredBy: string | null,
): Promise<ManualDeployReservation> {
  return db.drizzle.transaction(async (tx): Promise<ManualDeployReservation> => {
    const query = (statement: ReturnType<typeof sql>) =>
      db.execute({ db: tx as TransactionDB, sql: statement });

    await query(sql`SELECT pg_advisory_xact_lock(
      hashtext(${'healthylifestyles:deploy'}::text),
      hashtext(${'manual-deploy-trigger'}::text)
    )`);

    const recent = await query(sql`
      SELECT id FROM deploy_log
      WHERE created_at > NOW() - INTERVAL '5 minutes'
      LIMIT 1
    `);
    if (recent.rows.length > 0) return { status: 'cooldown' };

    const countRows = await query(sql`
      SELECT COUNT(*)::integer AS total_docs FROM pending_deploys
    `);
    if (countRows.rows.length !== 1) throw new Error('Queue count unavailable');
    const pendingCount = verifiedCollectionCount({
      totalDocs: (countRows.rows[0] as { total_docs?: unknown }).total_docs,
    });

    const reserved = await query(sql`
      INSERT INTO deploy_log (triggered_by, pending_count, created_at, updated_at)
      VALUES (${triggeredBy}, ${pendingCount}, NOW(), NOW())
      RETURNING id
    `);
    if (reserved.rows.length !== 1) throw new Error('Deploy attempt reservation failed');
    return { status: 'reserved', pendingCount };
  });
}
