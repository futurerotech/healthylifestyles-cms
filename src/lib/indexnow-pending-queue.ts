import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';

type TransactionDB = NonNullable<Parameters<PostgresAdapter['execute']>[0]['db']>;
type PendingIdentity = {
  collectionSlug: 'articles' | 'tools';
  docId: string;
  changedAt: string;
};

/**
 * Record publish changes inside the SAME Payload transaction as the content
 * save. This avoids queue events surviving an aborted publication and avoids
 * taking a second pool connection while Payload is holding its first one.
 *
 * Without a Payload transaction, create a small independent PostgreSQL
 * transaction. An advisory transaction lock serializes writers for the same
 * document; the lock and the SELECT/UPSERT sequence share the same connection.
 *
 * Do not rewrite/delete historical duplicate rows: they require a separately
 * approved audit. Concurrent IndexNow acknowledgement uses an exact-revision
 * atomic DELETE; publication writes lock the same queue rows via FOR UPDATE.
 */
export async function recordPublishedPendingChange(
  db: PostgresAdapter,
  input: PendingIdentity,
  payloadTransactionID?: number | string | Promise<number | string>,
): Promise<'inserted' | 'updated'> {
  const changedMillis = typeof input.changedAt === 'string' ? Date.parse(input.changedAt) : NaN;
  if ((input.collectionSlug !== 'articles' && input.collectionSlug !== 'tools') ||
      typeof input.docId !== 'string' || !input.docId.trim() ||
      !Number.isFinite(changedMillis)) {
    throw new Error('Invalid published-change queue identity or timestamp');
  }

  const write = async (tx: TransactionDB): Promise<'inserted' | 'updated'> => {
    const query = (statement: ReturnType<typeof sql>) =>
      db.execute({ db: tx, sql: statement });

    // Advisory keys are a serializing gate, not part of the row WHERE clause.
    // Any hash collision merely serializes unrelated documents.
    await query(sql`SELECT pg_advisory_xact_lock(
      hashtext(${input.collectionSlug}::text),
      hashtext(${input.docId}::text)
    )`);

    const existing = await query(sql`
      SELECT id, changed_at FROM pending_deploys
      WHERE collection_slug = ${input.collectionSlug} AND doc_id = ${input.docId}
      ORDER BY id ASC FOR UPDATE
    `);
    const newestMillis = existing.rows.reduce((max: number, row) => {
      const value = (row as { changed_at?: unknown }).changed_at;
      const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, changedMillis);
    const changedAt = new Date(newestMillis).toISOString();
    const first = existing.rows[0] as { id?: number } | undefined;
    if (first) {
      await query(sql`
        UPDATE pending_deploys SET changed_at = ${changedAt}, updated_at = NOW()
        WHERE id = ${first.id}
      `);
    } else {
      await query(sql`
        INSERT INTO pending_deploys
          (collection_slug, doc_id, changed_at, created_at, updated_at)
        VALUES (${input.collectionSlug}, ${input.docId}, ${changedAt}, NOW(), NOW())
      `);
    }
    return first ? 'updated' : 'inserted';
  };

  if (payloadTransactionID !== undefined) {
    const sessionId = String(await payloadTransactionID);
    const session = db.sessions[sessionId];
    if (!session) throw new Error('Active Payload transaction unavailable; queue write aborted');
    return write(session.db as TransactionDB);
  }
  return db.drizzle.transaction(async (tx) => write(tx as TransactionDB));
}
