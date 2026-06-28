import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

/**
 * TEMPORARY, self-healing migration runner for `20260628_210148_ai_article_fields`
 * — created so the AI-article DB columns can be applied without SSH.
 *
 * It runs ONLY the six fixed, additive `ALTER TABLE … ADD COLUMN` statements for
 * that migration (tolerant of "already exists" so it's safe to re-run) and then
 * records the migration in `payload_migrations`. It does NOT accept or run
 * arbitrary SQL.
 *
 * SECURITY: gated by a shared secret — call with `?key=<INTERNAL_API_KEY>` (or
 * an `x-fix-key` header). Inert (401) when no secret is configured.
 *
 * ⚠️ DELETE THIS FILE once the migration has been applied.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MIGRATION_NAME = '20260628_210148_ai_article_fields';

// Exactly the UP statements from that migration — additive ADD COLUMN only.
const ALTERS: string[] = [
  'ALTER TABLE `articles` ADD `ai_generated` integer DEFAULT false;',
  'ALTER TABLE `articles` ADD `reviewed_by_human` integer DEFAULT false;',
  'ALTER TABLE `articles` ADD `ai_image_prompt` text;',
  'ALTER TABLE `_articles_v` ADD `version_ai_generated` integer DEFAULT false;',
  'ALTER TABLE `_articles_v` ADD `version_reviewed_by_human` integer DEFAULT false;',
  'ALTER TABLE `_articles_v` ADD `version_ai_image_prompt` text;',
];

function authorized(req: Request): boolean {
  const secret = process.env.INTERNAL_API_KEY || process.env.DB_FIX_KEY || '';
  if (!secret) return false;
  const provided = new URL(req.url).searchParams.get('key') || req.headers.get('x-fix-key') || '';
  return provided === secret;
}

const isDuplicateColumn = (msg: string): boolean => /duplicate column name/i.test(msg);

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized. Set INTERNAL_API_KEY in the environment and pass ?key=…' },
      { status: 401 },
    );
  }

  const client = createClient({
    url: process.env.DATABASE_URI || 'file:./payload.db',
    authToken: process.env.DATABASE_TOKEN,
  });

  const added: string[] = [];
  const skipped: string[] = [];

  try {
    for (const stmt of ALTERS) {
      try {
        await client.execute(stmt);
        added.push(stmt);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        if (isDuplicateColumn(m)) skipped.push(stmt); // already applied — fine
        else throw new Error(`${stmt} → ${m}`);
      }
    }

    // Ensure the migrations table exists, then record this migration (once) so
    // Payload's CLI sees it as applied and never re-runs it.
    await client.execute(
      "CREATE TABLE IF NOT EXISTS `payload_migrations` (`id` integer PRIMARY KEY NOT NULL, `name` text, `batch` numeric, `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL, `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL);",
    );
    await client.execute({
      sql:
        "INSERT INTO `payload_migrations` (`name`,`batch`,`updated_at`,`created_at`) " +
        "SELECT ?, (SELECT COALESCE(MAX(`batch`),0)+1 FROM `payload_migrations`), " +
        "strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now') " +
        "WHERE NOT EXISTS (SELECT 1 FROM `payload_migrations` WHERE `name` = ?);",
      args: [MIGRATION_NAME, MIGRATION_NAME],
    });

    return NextResponse.json({
      success: true,
      message: 'Migration applied successfully without SSH',
      migration: MIGRATION_NAME,
      columnsAdded: added.length,
      columnsAlreadyPresent: skipped.length,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Migration failed.' },
      { status: 500 },
    );
  } finally {
    try {
      client.close();
    } catch {
      /* noop */
    }
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  return handle(req);
}

export async function POST(req: Request): Promise<NextResponse> {
  return handle(req);
}
