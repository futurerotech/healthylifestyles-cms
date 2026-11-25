import { sql } from '@payloadcms/db-postgres';

/**
 * Atomically acknowledge ONLY the exact pending revision accepted by IndexNow.
 *
 * Payload 3.91 delete-by-ID and delete-many select matching rows before their
 * DELETE-by-ID operation, so a normal Local API where filter does not protect
 * against a concurrent trackPendingChange update. This Postgres statement
 * checks the row id AND changed_at in the very same DELETE statement.
 *
 * Table/column identifiers are fixed from the existing migration snapshot;
 * record values are bound parameters (never interpolated into SQL text).
 * A missing/superseded row returns false and must NOT be reported as cleared.
 */
export async function acknowledgeIndexNowQueueRevision(
  execute: (statement: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }>,
  record: { id: number | string; changedAt: string },
): Promise<boolean> {
  const validId = typeof record.id === 'number'
    ? Number.isSafeInteger(record.id) && record.id > 0
    : typeof record.id === 'string' && record.id.length > 0;
  if (!validId || typeof record.changedAt !== 'string' ||
      !Number.isFinite(Date.parse(record.changedAt))) return false;

  const response = await execute(sql`
    DELETE FROM "pending_deploys"
    WHERE "id" = ${record.id} AND "changed_at" = ${record.changedAt}
    RETURNING "id"
  `);
  if (!Array.isArray(response?.rows) || response.rows.length !== 1) return false;
  const row = response.rows[0];
  return typeof row === 'object' && row !== null && 'id' in row &&
    String((row as { id: unknown }).id) === String(record.id);
}
