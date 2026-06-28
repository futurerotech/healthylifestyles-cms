import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Additive migration for the Articles `semanticEntities` array field.
 *
 * Payload backs an array field on a versioned collection with TWO tables:
 *   - `articles_semantic_entities`              (published / current docs)
 *   - `_articles_v_version_semantic_entities`   (version snapshots) ← the table
 *     whose absence crashed /admin/collections/articles in production.
 *
 * IMPORTANT: `migrate:create` regenerated the FULL schema, because the committed
 * migration snapshots had drifted far behind the live (push-synced) production
 * schema (tags, subscribers, push, leads, audience, the articles featured/
 * updated_date/primary_tool columns, etc. were all added via dev push without a
 * migration). Running that full schema against production — which already has
 * every one of those tables — would fail with "table already exists".
 *
 * So UP/DOWN here are intentionally scoped to ONLY the new field and use
 * IF NOT EXISTS, making this migration safe to apply against ANY environment
 * regardless of its prior push/migration state. The accompanying .json snapshot
 * still records the full schema, so future `migrate:create` diffs are clean.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`articles_semantic_entities\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`term\` text,
  	\`url\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_semantic_entities_order_idx\` ON \`articles_semantic_entities\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_semantic_entities_parent_id_idx\` ON \`articles_semantic_entities\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_articles_v_version_semantic_entities\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`term\` text,
  	\`url\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_articles_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_version_semantic_entities_order_idx\` ON \`_articles_v_version_semantic_entities\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_version_semantic_entities_parent_id_idx\` ON \`_articles_v_version_semantic_entities\` (\`_parent_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS \`articles_semantic_entities\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`_articles_v_version_semantic_entities\`;`)
}
