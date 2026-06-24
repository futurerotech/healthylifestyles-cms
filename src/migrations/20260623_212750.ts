import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`pseo_templates\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`status\` text DEFAULT 'draft',
  	\`headline_template\` text NOT NULL,
  	\`subheadline_template\` text,
  	\`body_template\` text NOT NULL,
  	\`cta_template\` text,
  	\`cta_link\` text,
  	\`meta_title_template\` text NOT NULL,
  	\`meta_desc_template\` text NOT NULL,
  	\`h1_template\` text,
  	\`slug_template\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pseo_templates_slug_idx\` ON \`pseo_templates\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`pseo_templates_updated_at_idx\` ON \`pseo_templates\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pseo_templates_created_at_idx\` ON \`pseo_templates\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`pseo_datasets\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`template_id\` integer NOT NULL,
  	\`status\` text DEFAULT 'draft',
  	\`csv_file_id\` integer NOT NULL,
  	\`columns\` text,
  	\`row_count\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`template_id\`) REFERENCES \`pseo_templates\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`csv_file_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`pseo_datasets_template_idx\` ON \`pseo_datasets\` (\`template_id\`);`)
  await db.run(sql`CREATE INDEX \`pseo_datasets_csv_file_idx\` ON \`pseo_datasets\` (\`csv_file_id\`);`)
  await db.run(sql`CREATE INDEX \`pseo_datasets_updated_at_idx\` ON \`pseo_datasets\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pseo_datasets_created_at_idx\` ON \`pseo_datasets\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`pseo_pages\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`slug\` text NOT NULL,
  	\`status\` text DEFAULT 'published',
  	\`template_id\` integer NOT NULL,
  	\`dataset_id\` integer NOT NULL,
  	\`keyword\` text,
  	\`variables\` text,
  	\`headline\` text,
  	\`subheadline\` text,
  	\`body_html\` text,
  	\`cta_text\` text,
  	\`cta_url\` text,
  	\`seo_meta_title\` text,
  	\`seo_meta_description\` text,
  	\`seo_og_image_id\` integer,
  	\`seo_no_index\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`template_id\`) REFERENCES \`pseo_templates\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`dataset_id\`) REFERENCES \`pseo_datasets\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pseo_pages_slug_idx\` ON \`pseo_pages\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`pseo_pages_template_idx\` ON \`pseo_pages\` (\`template_id\`);`)
  await db.run(sql`CREATE INDEX \`pseo_pages_dataset_idx\` ON \`pseo_pages\` (\`dataset_id\`);`)
  await db.run(sql`CREATE INDEX \`pseo_pages_seo_seo_og_image_idx\` ON \`pseo_pages\` (\`seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`pseo_pages_updated_at_idx\` ON \`pseo_pages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pseo_pages_created_at_idx\` ON \`pseo_pages\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`pseo_templates_id\` integer REFERENCES pseo_templates(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`pseo_datasets_id\` integer REFERENCES pseo_datasets(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`pseo_pages_id\` integer REFERENCES pseo_pages(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pseo_templates_id_idx\` ON \`payload_locked_documents_rels\` (\`pseo_templates_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pseo_datasets_id_idx\` ON \`payload_locked_documents_rels\` (\`pseo_datasets_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pseo_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pseo_pages_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`pseo_templates\`;`)
  await db.run(sql`DROP TABLE \`pseo_datasets\`;`)
  await db.run(sql`DROP TABLE \`pseo_pages\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`media_id\` integer,
  	\`categories_id\` integer,
  	\`authors_id\` integer,
  	\`tools_id\` integer,
  	\`articles_id\` integer,
  	\`pages_id\` integer,
  	\`redirects_id\` integer,
  	\`tool_usage_id\` integer,
  	\`personas_id\` integer,
  	\`profiles_id\` integer,
  	\`indexing_status_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`authors_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tools_id\`) REFERENCES \`tools\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`articles_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`redirects_id\`) REFERENCES \`redirects\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tool_usage_id\`) REFERENCES \`tool_usage\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`personas_id\`) REFERENCES \`personas\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`profiles_id\`) REFERENCES \`profiles\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`indexing_status_id\`) REFERENCES \`indexing_status\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "media_id", "categories_id", "authors_id", "tools_id", "articles_id", "pages_id", "redirects_id", "tool_usage_id", "personas_id", "profiles_id", "indexing_status_id") SELECT "id", "order", "parent_id", "path", "users_id", "media_id", "categories_id", "authors_id", "tools_id", "articles_id", "pages_id", "redirects_id", "tool_usage_id", "personas_id", "profiles_id", "indexing_status_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_authors_id_idx\` ON \`payload_locked_documents_rels\` (\`authors_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_tools_id_idx\` ON \`payload_locked_documents_rels\` (\`tools_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_articles_id_idx\` ON \`payload_locked_documents_rels\` (\`articles_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_redirects_id_idx\` ON \`payload_locked_documents_rels\` (\`redirects_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_tool_usage_id_idx\` ON \`payload_locked_documents_rels\` (\`tool_usage_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_personas_id_idx\` ON \`payload_locked_documents_rels\` (\`personas_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_profiles_id_idx\` ON \`payload_locked_documents_rels\` (\`profiles_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_indexing_status_id_idx\` ON \`payload_locked_documents_rels\` (\`indexing_status_id\`);`)
}
