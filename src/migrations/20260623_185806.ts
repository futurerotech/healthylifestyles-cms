import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`articles_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`subtitle\` text,
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`background_image_id\` integer,
  	\`overlay\` text DEFAULT 'dark',
  	\`block_name\` text,
  	FOREIGN KEY (\`background_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_hero_order_idx\` ON \`articles_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_hero_parent_id_idx\` ON \`articles_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_hero_path_idx\` ON \`articles_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_hero_background_image_idx\` ON \`articles_blocks_hero\` (\`background_image_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`articles_blocks_calculator_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`tool_id\` integer,
  	\`variant\` text DEFAULT 'inline',
  	\`block_name\` text,
  	FOREIGN KEY (\`tool_id\`) REFERENCES \`tools\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_calculator_embed_order_idx\` ON \`articles_blocks_calculator_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_calculator_embed_parent_id_idx\` ON \`articles_blocks_calculator_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_calculator_embed_path_idx\` ON \`articles_blocks_calculator_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_calculator_embed_tool_idx\` ON \`articles_blocks_calculator_embed\` (\`tool_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`articles_blocks_two_column\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`image_side\` text DEFAULT 'left',
  	\`heading\` text,
  	\`text\` text,
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_two_column_order_idx\` ON \`articles_blocks_two_column\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_two_column_parent_id_idx\` ON \`articles_blocks_two_column\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_two_column_path_idx\` ON \`articles_blocks_two_column\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_two_column_image_idx\` ON \`articles_blocks_two_column\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`articles_blocks_viral_hook_banner\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`hook\` text,
  	\`subtext\` text,
  	\`bg_color\` text DEFAULT '#f0fdf4',
  	\`text_color\` text DEFAULT '#166534',
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_viral_hook_banner_order_idx\` ON \`articles_blocks_viral_hook_banner\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_viral_hook_banner_parent_id_idx\` ON \`articles_blocks_viral_hook_banner\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`articles_blocks_viral_hook_banner_path_idx\` ON \`articles_blocks_viral_hook_banner\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_articles_v_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`subtitle\` text,
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`background_image_id\` integer,
  	\`overlay\` text DEFAULT 'dark',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`background_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_articles_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_hero_order_idx\` ON \`_articles_v_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_hero_parent_id_idx\` ON \`_articles_v_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_hero_path_idx\` ON \`_articles_v_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_hero_background_image_idx\` ON \`_articles_v_blocks_hero\` (\`background_image_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_articles_v_blocks_calculator_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tool_id\` integer,
  	\`variant\` text DEFAULT 'inline',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`tool_id\`) REFERENCES \`tools\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_articles_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_calculator_embed_order_idx\` ON \`_articles_v_blocks_calculator_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_calculator_embed_parent_id_idx\` ON \`_articles_v_blocks_calculator_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_calculator_embed_path_idx\` ON \`_articles_v_blocks_calculator_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_calculator_embed_tool_idx\` ON \`_articles_v_blocks_calculator_embed\` (\`tool_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_articles_v_blocks_two_column\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`image_side\` text DEFAULT 'left',
  	\`heading\` text,
  	\`text\` text,
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_articles_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_two_column_order_idx\` ON \`_articles_v_blocks_two_column\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_two_column_parent_id_idx\` ON \`_articles_v_blocks_two_column\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_two_column_path_idx\` ON \`_articles_v_blocks_two_column\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_two_column_image_idx\` ON \`_articles_v_blocks_two_column\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_articles_v_blocks_viral_hook_banner\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`hook\` text,
  	\`subtext\` text,
  	\`bg_color\` text DEFAULT '#f0fdf4',
  	\`text_color\` text DEFAULT '#166534',
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_articles_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_viral_hook_banner_order_idx\` ON \`_articles_v_blocks_viral_hook_banner\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_viral_hook_banner_parent_id_idx\` ON \`_articles_v_blocks_viral_hook_banner\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_articles_v_blocks_viral_hook_banner_path_idx\` ON \`_articles_v_blocks_viral_hook_banner\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`subtitle\` text,
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`background_image_id\` integer,
  	\`overlay\` text DEFAULT 'dark',
  	\`block_name\` text,
  	FOREIGN KEY (\`background_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hero_order_idx\` ON \`pages_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hero_parent_id_idx\` ON \`pages_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hero_path_idx\` ON \`pages_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hero_background_image_idx\` ON \`pages_blocks_hero\` (\`background_image_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_calculator_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`tool_id\` integer,
  	\`variant\` text DEFAULT 'inline',
  	\`block_name\` text,
  	FOREIGN KEY (\`tool_id\`) REFERENCES \`tools\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_calculator_embed_order_idx\` ON \`pages_blocks_calculator_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_calculator_embed_parent_id_idx\` ON \`pages_blocks_calculator_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_calculator_embed_path_idx\` ON \`pages_blocks_calculator_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_calculator_embed_tool_idx\` ON \`pages_blocks_calculator_embed\` (\`tool_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_two_column\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`image_side\` text DEFAULT 'left',
  	\`heading\` text,
  	\`text\` text,
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_two_column_order_idx\` ON \`pages_blocks_two_column\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_two_column_parent_id_idx\` ON \`pages_blocks_two_column\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_two_column_path_idx\` ON \`pages_blocks_two_column\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_two_column_image_idx\` ON \`pages_blocks_two_column\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_viral_hook_banner\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`hook\` text,
  	\`subtext\` text,
  	\`bg_color\` text DEFAULT '#f0fdf4',
  	\`text_color\` text DEFAULT '#166534',
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_viral_hook_banner_order_idx\` ON \`pages_blocks_viral_hook_banner\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_viral_hook_banner_parent_id_idx\` ON \`pages_blocks_viral_hook_banner\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_viral_hook_banner_path_idx\` ON \`pages_blocks_viral_hook_banner\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`hero_image_id\` integer,
  	\`seo_meta_title\` text,
  	\`seo_canonical\` text,
  	\`seo_meta_description\` text,
  	\`seo_og_image_id\` integer,
  	\`slug\` text,
  	\`publish_date\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_hero_image_idx\` ON \`pages\` (\`hero_image_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_seo_seo_og_image_idx\` ON \`pages\` (\`seo_og_image_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`pages_slug_idx\` ON \`pages\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_updated_at_idx\` ON \`pages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_created_at_idx\` ON \`pages\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages__status_idx\` ON \`pages\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_texts_order_parent\` ON \`pages_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_pages_v_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`subtitle\` text,
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`background_image_id\` integer,
  	\`overlay\` text DEFAULT 'dark',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`background_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_hero_order_idx\` ON \`_pages_v_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_hero_parent_id_idx\` ON \`_pages_v_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_hero_path_idx\` ON \`_pages_v_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_hero_background_image_idx\` ON \`_pages_v_blocks_hero\` (\`background_image_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_pages_v_blocks_calculator_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tool_id\` integer,
  	\`variant\` text DEFAULT 'inline',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`tool_id\`) REFERENCES \`tools\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_calculator_embed_order_idx\` ON \`_pages_v_blocks_calculator_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_calculator_embed_parent_id_idx\` ON \`_pages_v_blocks_calculator_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_calculator_embed_path_idx\` ON \`_pages_v_blocks_calculator_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_calculator_embed_tool_idx\` ON \`_pages_v_blocks_calculator_embed\` (\`tool_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_pages_v_blocks_two_column\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`image_side\` text DEFAULT 'left',
  	\`heading\` text,
  	\`text\` text,
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_two_column_order_idx\` ON \`_pages_v_blocks_two_column\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_two_column_parent_id_idx\` ON \`_pages_v_blocks_two_column\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_two_column_path_idx\` ON \`_pages_v_blocks_two_column\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_two_column_image_idx\` ON \`_pages_v_blocks_two_column\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_pages_v_blocks_viral_hook_banner\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`hook\` text,
  	\`subtext\` text,
  	\`bg_color\` text DEFAULT '#f0fdf4',
  	\`text_color\` text DEFAULT '#166534',
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_viral_hook_banner_order_idx\` ON \`_pages_v_blocks_viral_hook_banner\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_viral_hook_banner_parent_id_idx\` ON \`_pages_v_blocks_viral_hook_banner\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_blocks_viral_hook_banner_path_idx\` ON \`_pages_v_blocks_viral_hook_banner\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_pages_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_hero_image_id\` integer,
  	\`version_seo_meta_title\` text,
  	\`version_seo_canonical\` text,
  	\`version_seo_meta_description\` text,
  	\`version_seo_og_image_id\` integer,
  	\`version_slug\` text,
  	\`version_publish_date\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	\`autosave\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_parent_idx\` ON \`_pages_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_version_version_hero_image_idx\` ON \`_pages_v\` (\`version_hero_image_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_version_seo_version_seo_og_image_idx\` ON \`_pages_v\` (\`version_seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_version_version_slug_idx\` ON \`_pages_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_version_version_updated_at_idx\` ON \`_pages_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_version_version_created_at_idx\` ON \`_pages_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_version_version__status_idx\` ON \`_pages_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_created_at_idx\` ON \`_pages_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_updated_at_idx\` ON \`_pages_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_latest_idx\` ON \`_pages_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_autosave_idx\` ON \`_pages_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_pages_v_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`_pages_v_texts_order_parent\` ON \`_pages_v_texts\` (\`order\`,\`parent_id\`);`)
  try { await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`pages_id\` integer REFERENCES pages(id);`); } catch {}
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  try { await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`content\`;`); } catch {}
  try { await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_content\`;`); } catch {}
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`articles_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`articles_blocks_calculator_embed\`;`)
  await db.run(sql`DROP TABLE \`articles_blocks_two_column\`;`)
  await db.run(sql`DROP TABLE \`articles_blocks_viral_hook_banner\`;`)
  await db.run(sql`DROP TABLE \`_articles_v_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`_articles_v_blocks_calculator_embed\`;`)
  await db.run(sql`DROP TABLE \`_articles_v_blocks_two_column\`;`)
  await db.run(sql`DROP TABLE \`_articles_v_blocks_viral_hook_banner\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_calculator_embed\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_two_column\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_viral_hook_banner\`;`)
  await db.run(sql`DROP TABLE \`pages\`;`)
  await db.run(sql`DROP TABLE \`pages_texts\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_calculator_embed\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_two_column\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_viral_hook_banner\`;`)
  await db.run(sql`DROP TABLE \`_pages_v\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_texts\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`__new_payload_locked_documents_rels\` (
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
  	\`redirects_id\` integer,
  	\`tool_usage_id\` integer,
  	\`personas_id\` integer,
  	\`profiles_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`authors_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tools_id\`) REFERENCES \`tools\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`articles_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`redirects_id\`) REFERENCES \`redirects\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tool_usage_id\`) REFERENCES \`tool_usage\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`personas_id\`) REFERENCES \`personas\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`profiles_id\`) REFERENCES \`profiles\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "media_id", "categories_id", "authors_id", "tools_id", "articles_id", "redirects_id", "tool_usage_id", "personas_id", "profiles_id") SELECT "id", "order", "parent_id", "path", "users_id", "media_id", "categories_id", "authors_id", "tools_id", "articles_id", "redirects_id", "tool_usage_id", "personas_id", "profiles_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_authors_id_idx\` ON \`payload_locked_documents_rels\` (\`authors_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_tools_id_idx\` ON \`payload_locked_documents_rels\` (\`tools_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_articles_id_idx\` ON \`payload_locked_documents_rels\` (\`articles_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_redirects_id_idx\` ON \`payload_locked_documents_rels\` (\`redirects_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_tool_usage_id_idx\` ON \`payload_locked_documents_rels\` (\`tool_usage_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_personas_id_idx\` ON \`payload_locked_documents_rels\` (\`personas_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_profiles_id_idx\` ON \`payload_locked_documents_rels\` (\`profiles_id\`);`)
  try { await db.run(sql`ALTER TABLE \`articles\` ADD \`content\` text;`); } catch {}
  try { await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_content\` text;`); } catch {}
}
