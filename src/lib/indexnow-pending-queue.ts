import type { PostgresAdapter } from '@payloadcms/db-postgres';

/**
 * A single publisher-owned pending row per document, without schema changes.
 *
 * Two simultaneous Payload afterChange hooks otherwise both find an empty
 * queue and independently INSERT. A transaction-scoped PostgreSQL advisory
 * lock serializes writers for the same (collection, doc ID), and a SECOND
 * statement (new READ COMMITTED snapshot) checks for a committed row after
 * taking that lock.
 *
 * A concurrent IndexNow acknowledgement deletes by (id, changed_at) in one
 * atomic statement. Its row lock and this transaction's SELECT FOR UPDATE
 * ensure that a newer published change survives either ordering.
 *
 * Historical duplicate rows are NOT deleted or rewritten here. They require
 * a separate read-only audit and explicit remediation.
 */
export async function recordPublishedPendingChange(
  pool: Pick<PostgresAdapter['pool'], 'connect'>,
  input: { collectionSlug: 'articles' | 'tools'; docId: string; changedAt: string },
): Promise<'inserted' | 'updated'> {
  if (!input.docId || typeof input.changedAt !== 'string' ||
      !Number.isFinite(Date.parse(input.changedAt))) {
    throw new Error('Invalid published-change queue identity or timestamp');
  }
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    // The two hashes are only lock keys, not database identifiers. Collisions
    // at worst serialize unrelated keys; they cannot mix rows in the SQL WHERE.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1::text), hashtext($2::text))',
      [input.collectionSlug, input.docId],
    );
    const existing = await client.query<{ id: number; changed_at: string }>(
      'SELECT id, changed_at FROM pending_deploys WHERE collection_slug = $1 AND doc_id = $2 ORDER BY id ASC FOR UPDATE',
      [input.collectionSlug, input.docId],
    );
    const previous = existing.rows.reduce((max, row) => {
      const parsed = Date.parse(row.changed_at);
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, Date.parse(input.changedAt));
    const newestChangedAt = new Date(previous).toISOString();
    const first = existing.rows[0];
    if (first) {
      await client.query(
        'UPDATE pending_deploys SET changed_at = $1, updated_at = NOW() WHERE id = $2',
        [newestChangedAt, first.id],
      );
    } else {
      await client.query(
        'INSERT INTO pending_deploys (collection_slug, doc_id, changed_at, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
        [input.collectionSlug, input.docId, newestChangedAt],
      );
    }
    await client.query('COMMIT');
    transactionOpen = false;
    return first ? 'updated' : 'inserted';
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
