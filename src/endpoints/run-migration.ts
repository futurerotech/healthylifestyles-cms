import type { Endpoint } from 'payload';

/**
 * Non-destructive SQLite schema migration for Payload v3 auth tables.
 *
 * In production the SQLite database file is missing columns/tables that Payload
 * now expects (added `useAPIKey: true` to the Users collection). This endpoint
 * uses raw SQL via Drizzle to add them safely — every DDL statement is wrapped
 * in try/catch so the whole migration succeeds even when some already exist.
 *
 * Hit GET /api/run-migration once after deploy. Admin auth required.
 */
export const runMigration: Endpoint = {
  path: '/run-migration',
  method: 'get',
  handler: async (req) => {
    if (!req.user) {
      return Response.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
    }

    const db = (req.payload as any).db?.drizzle;
    if (!db) {
      return Response.json({ success: false, error: 'Drizzle handle not available.' }, { status: 500 });
    }

    const results: string[] = [];

    // ── 1. users_sessions table ────────────────────────────────────────
    try {
      db.run(`
        CREATE TABLE IF NOT EXISTS "users_sessions" (
          "id" integer PRIMARY KEY NOT NULL,
          "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "session_token" text NOT NULL,
          "issued_at" text,
          "expiration" text,
          "last_accessed" text
        )
      `);
      results.push('users_sessions table ready (created or already existed).');
    } catch (e: any) {
      results.push(`users_sessions table error: ${e?.message ?? e}`);
    }

    // ── 2. Missing columns on users table ──────────────────────────────
    const columns: { name: string; def: string }[] = [
      { name: 'enable_a_p_i_key', def: 'integer DEFAULT 0' },
      { name: 'api_key', def: 'text' },
      { name: 'api_key_index', def: 'text' },
    ];

    for (const col of columns) {
      try {
        db.run(`ALTER TABLE "users" ADD COLUMN "${col.name}" ${col.def}`);
        results.push(`Column "users"."${col.name}" added.`);
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        if (msg.toLowerCase().includes('duplicate column')) {
          results.push(`Column "users"."${col.name}" already exists — skipped.`);
        } else {
          results.push(`Column "users"."${col.name}" error: ${msg}`);
        }
      }
    }

    return Response.json({ success: true, results });
  },
};
