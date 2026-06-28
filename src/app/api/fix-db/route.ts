import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

/**
 * TEMPORARY, self-healing DB patch — created to apply the `semanticEntities`
 * schema when SSH access to the host is unavailable. It runs ONLY the two
 * fixed, idempotent (IF NOT EXISTS) DDL statements below — it does NOT accept
 * or execute arbitrary SQL.
 *
 * SECURITY: gated behind a shared secret so it can't be triggered by the public.
 * Set `DB_FIX_KEY` (or reuse `INTERNAL_API_KEY`) in the host environment, then
 * call this route with `?key=<that value>` (or an `x-fix-key` header). With no
 * secret configured the route is INERT (always 401).
 *
 * ⚠️ DELETE THIS FILE once the patch has run successfully.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Exactly the statements from migration 20260628_145554_semantic_entities — additive + idempotent.
const STATEMENTS: string[] = [
  'CREATE TABLE IF NOT EXISTS `articles_semantic_entities` (`_order` integer NOT NULL,`_parent_id` integer NOT NULL,`id` text PRIMARY KEY NOT NULL,`term` text,`url` text,FOREIGN KEY (`_parent_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade);',
  'CREATE INDEX IF NOT EXISTS `articles_semantic_entities_order_idx` ON `articles_semantic_entities` (`_order`);',
  'CREATE INDEX IF NOT EXISTS `articles_semantic_entities_parent_id_idx` ON `articles_semantic_entities` (`_parent_id`);',
  'CREATE TABLE IF NOT EXISTS `_articles_v_version_semantic_entities` (`_order` integer NOT NULL,`_parent_id` integer NOT NULL,`id` integer PRIMARY KEY NOT NULL,`term` text,`url` text,`_uuid` text,FOREIGN KEY (`_parent_id`) REFERENCES `_articles_v`(`id`) ON UPDATE no action ON DELETE cascade);',
  'CREATE INDEX IF NOT EXISTS `_articles_v_version_semantic_entities_order_idx` ON `_articles_v_version_semantic_entities` (`_order`);',
  'CREATE INDEX IF NOT EXISTS `_articles_v_version_semantic_entities_parent_id_idx` ON `_articles_v_version_semantic_entities` (`_parent_id`);',
];

function authorized(req: Request): boolean {
  const secret = process.env.DB_FIX_KEY || process.env.INTERNAL_API_KEY || '';
  if (!secret) return false; // no secret configured → route is inert
  const provided = new URL(req.url).searchParams.get('key') || req.headers.get('x-fix-key') || '';
  return provided === secret;
}

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized. Set DB_FIX_KEY in the environment and pass ?key=…' },
      { status: 401 },
    );
  }

  const client = createClient({
    url: process.env.DATABASE_URI || 'file:./payload.db',
    authToken: process.env.DATABASE_TOKEN,
  });

  try {
    for (const stmt of STATEMENTS) {
      await client.execute(stmt);
    }
    const check = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%semantic_entities%' ORDER BY name;",
    );
    const tables = check.rows.map((r) => String((r as Record<string, unknown>).name));
    return NextResponse.json({ success: true, message: 'DB Patched', tables });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Patch failed.' },
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
