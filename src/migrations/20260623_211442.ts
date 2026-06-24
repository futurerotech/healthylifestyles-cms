import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`social_media_profiles\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`platform\` text NOT NULL,
  	\`url\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`social_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`social_media_profiles_order_idx\` ON \`social_media_profiles\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`social_media_profiles_parent_id_idx\` ON \`social_media_profiles\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`social_media\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`twitter_site\` text,
  	\`facebook_app_id\` text,
  	\`publisher_url\` text,
  	\`default_share_text\` text DEFAULT 'Check this out from HealthyLifeStyles: {title} {url}',
  	\`default_og_image_id\` integer,
  	\`default_twitter_image_id\` integer,
  	\`twitter_card_style\` text DEFAULT 'summary_large_image',
  	\`og_locale\` text DEFAULT 'en_US',
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`default_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`default_twitter_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`social_media_default_og_image_idx\` ON \`social_media\` (\`default_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`social_media_default_twitter_image_idx\` ON \`social_media\` (\`default_twitter_image_id\`);`)
  await db.run(sql`ALTER TABLE \`categories\` ADD \`seo_og_title\` text;`)
  await db.run(sql`ALTER TABLE \`categories\` ADD \`seo_og_description\` text;`)
  await db.run(sql`ALTER TABLE \`categories\` ADD \`seo_twitter_title\` text;`)
  await db.run(sql`ALTER TABLE \`categories\` ADD \`seo_twitter_description\` text;`)
  await db.run(sql`ALTER TABLE \`categories\` ADD \`seo_twitter_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`categories_seo_seo_twitter_image_idx\` ON \`categories\` (\`seo_twitter_image_id\`);`)
  await db.run(sql`ALTER TABLE \`_categories_v\` ADD \`version_seo_og_title\` text;`)
  await db.run(sql`ALTER TABLE \`_categories_v\` ADD \`version_seo_og_description\` text;`)
  await db.run(sql`ALTER TABLE \`_categories_v\` ADD \`version_seo_twitter_title\` text;`)
  await db.run(sql`ALTER TABLE \`_categories_v\` ADD \`version_seo_twitter_description\` text;`)
  await db.run(sql`ALTER TABLE \`_categories_v\` ADD \`version_seo_twitter_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`_categories_v_version_seo_version_seo_twitter_image_idx\` ON \`_categories_v\` (\`version_seo_twitter_image_id\`);`)
  await db.run(sql`ALTER TABLE \`tools\` ADD \`seo_og_title\` text;`)
  await db.run(sql`ALTER TABLE \`tools\` ADD \`seo_og_description\` text;`)
  await db.run(sql`ALTER TABLE \`tools\` ADD \`seo_twitter_title\` text;`)
  await db.run(sql`ALTER TABLE \`tools\` ADD \`seo_twitter_description\` text;`)
  await db.run(sql`ALTER TABLE \`tools\` ADD \`seo_twitter_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`tools_seo_seo_twitter_image_idx\` ON \`tools\` (\`seo_twitter_image_id\`);`)
  await db.run(sql`ALTER TABLE \`_tools_v\` ADD \`version_seo_og_title\` text;`)
  await db.run(sql`ALTER TABLE \`_tools_v\` ADD \`version_seo_og_description\` text;`)
  await db.run(sql`ALTER TABLE \`_tools_v\` ADD \`version_seo_twitter_title\` text;`)
  await db.run(sql`ALTER TABLE \`_tools_v\` ADD \`version_seo_twitter_description\` text;`)
  await db.run(sql`ALTER TABLE \`_tools_v\` ADD \`version_seo_twitter_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`_tools_v_version_seo_version_seo_twitter_image_idx\` ON \`_tools_v\` (\`version_seo_twitter_image_id\`);`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`seo_og_title\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`seo_og_description\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`seo_twitter_title\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`seo_twitter_description\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`seo_twitter_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`articles_seo_seo_twitter_image_idx\` ON \`articles\` (\`seo_twitter_image_id\`);`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_seo_og_title\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_seo_og_description\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_seo_twitter_title\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_seo_twitter_description\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_seo_twitter_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_seo_version_seo_twitter_image_idx\` ON \`_articles_v\` (\`version_seo_twitter_image_id\`);`)
  await db.run(sql`ALTER TABLE \`pages\` ADD \`seo_og_title\` text;`)
  await db.run(sql`ALTER TABLE \`pages\` ADD \`seo_og_description\` text;`)
  await db.run(sql`ALTER TABLE \`pages\` ADD \`seo_twitter_title\` text;`)
  await db.run(sql`ALTER TABLE \`pages\` ADD \`seo_twitter_description\` text;`)
  await db.run(sql`ALTER TABLE \`pages\` ADD \`seo_twitter_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`pages_seo_seo_twitter_image_idx\` ON \`pages\` (\`seo_twitter_image_id\`);`)
  await db.run(sql`ALTER TABLE \`_pages_v\` ADD \`version_seo_og_title\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` ADD \`version_seo_og_description\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` ADD \`version_seo_twitter_title\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` ADD \`version_seo_twitter_description\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` ADD \`version_seo_twitter_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_seo_version_seo_twitter_image_idx\` ON \`_pages_v\` (\`version_seo_twitter_image_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`social_media_profiles\`;`)
  await db.run(sql`DROP TABLE \`social_media\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_categories\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`slug\` text,
  	\`kind\` text DEFAULT 'tool',
  	\`description\` text,
  	\`icon\` text,
  	\`accent_color\` text,
  	\`order\` numeric DEFAULT 0,
  	\`seo_meta_title\` text,
  	\`seo_canonical\` text,
  	\`seo_meta_description\` text,
  	\`seo_no_index\` integer DEFAULT false,
  	\`seo_og_image_id\` integer,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_categories\`("id", "name", "slug", "kind", "description", "icon", "accent_color", "order", "seo_meta_title", "seo_canonical", "seo_meta_description", "seo_no_index", "seo_og_image_id", "updated_at", "created_at") SELECT "id", "name", "slug", "kind", "description", "icon", "accent_color", "order", "seo_meta_title", "seo_canonical", "seo_meta_description", "seo_no_index", "seo_og_image_id", "updated_at", "created_at" FROM \`categories\`;`)
  await db.run(sql`DROP TABLE \`categories\`;`)
  await db.run(sql`ALTER TABLE \`__new_categories\` RENAME TO \`categories\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`categories_slug_idx\` ON \`categories\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`categories_seo_seo_og_image_idx\` ON \`categories\` (\`seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`categories_updated_at_idx\` ON \`categories\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`categories_created_at_idx\` ON \`categories\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`__new__categories_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_name\` text NOT NULL,
  	\`version_slug\` text,
  	\`version_kind\` text DEFAULT 'tool',
  	\`version_description\` text,
  	\`version_icon\` text,
  	\`version_accent_color\` text,
  	\`version_order\` numeric DEFAULT 0,
  	\`version_seo_meta_title\` text,
  	\`version_seo_canonical\` text,
  	\`version_seo_meta_description\` text,
  	\`version_seo_no_index\` integer DEFAULT false,
  	\`version_seo_og_image_id\` integer,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new__categories_v\`("id", "parent_id", "version_name", "version_slug", "version_kind", "version_description", "version_icon", "version_accent_color", "version_order", "version_seo_meta_title", "version_seo_canonical", "version_seo_meta_description", "version_seo_no_index", "version_seo_og_image_id", "version_updated_at", "version_created_at", "created_at", "updated_at") SELECT "id", "parent_id", "version_name", "version_slug", "version_kind", "version_description", "version_icon", "version_accent_color", "version_order", "version_seo_meta_title", "version_seo_canonical", "version_seo_meta_description", "version_seo_no_index", "version_seo_og_image_id", "version_updated_at", "version_created_at", "created_at", "updated_at" FROM \`_categories_v\`;`)
  await db.run(sql`DROP TABLE \`_categories_v\`;`)
  await db.run(sql`ALTER TABLE \`__new__categories_v\` RENAME TO \`_categories_v\`;`)
  await db.run(sql`CREATE INDEX \`_categories_v_parent_idx\` ON \`_categories_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_categories_v_version_version_slug_idx\` ON \`_categories_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_categories_v_version_seo_version_seo_og_image_idx\` ON \`_categories_v\` (\`version_seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_categories_v_version_version_updated_at_idx\` ON \`_categories_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_categories_v_version_version_created_at_idx\` ON \`_categories_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_categories_v_created_at_idx\` ON \`_categories_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_categories_v_updated_at_idx\` ON \`_categories_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`__new_tools\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`category_id\` integer,
  	\`tool_type\` text DEFAULT 'formula',
  	\`coded_component\` text,
  	\`icon\` text,
  	\`gradient\` text DEFAULT 'blue',
  	\`accent_color\` text,
  	\`minutes_badge\` text,
  	\`enabled\` integer DEFAULT true,
  	\`featured\` integer DEFAULT false,
  	\`what_it_is\` text,
  	\`how_calculated\` text,
  	\`how_to_read\` text,
  	\`seo_meta_title\` text,
  	\`seo_canonical\` text,
  	\`seo_meta_description\` text,
  	\`seo_no_index\` integer DEFAULT false,
  	\`seo_og_image_id\` integer,
  	\`slug\` text,
  	\`sort_order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_tools\`("id", "name", "category_id", "tool_type", "coded_component", "icon", "gradient", "accent_color", "minutes_badge", "enabled", "featured", "what_it_is", "how_calculated", "how_to_read", "seo_meta_title", "seo_canonical", "seo_meta_description", "seo_no_index", "seo_og_image_id", "slug", "sort_order", "updated_at", "created_at", "_status") SELECT "id", "name", "category_id", "tool_type", "coded_component", "icon", "gradient", "accent_color", "minutes_badge", "enabled", "featured", "what_it_is", "how_calculated", "how_to_read", "seo_meta_title", "seo_canonical", "seo_meta_description", "seo_no_index", "seo_og_image_id", "slug", "sort_order", "updated_at", "created_at", "_status" FROM \`tools\`;`)
  await db.run(sql`DROP TABLE \`tools\`;`)
  await db.run(sql`ALTER TABLE \`__new_tools\` RENAME TO \`tools\`;`)
  await db.run(sql`CREATE INDEX \`tools_category_idx\` ON \`tools\` (\`category_id\`);`)
  await db.run(sql`CREATE INDEX \`tools_seo_seo_og_image_idx\` ON \`tools\` (\`seo_og_image_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`tools_slug_idx\` ON \`tools\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`tools_updated_at_idx\` ON \`tools\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`tools_created_at_idx\` ON \`tools\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`tools__status_idx\` ON \`tools\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`__new__tools_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_name\` text,
  	\`version_category_id\` integer,
  	\`version_tool_type\` text DEFAULT 'formula',
  	\`version_coded_component\` text,
  	\`version_icon\` text,
  	\`version_gradient\` text DEFAULT 'blue',
  	\`version_accent_color\` text,
  	\`version_minutes_badge\` text,
  	\`version_enabled\` integer DEFAULT true,
  	\`version_featured\` integer DEFAULT false,
  	\`version_what_it_is\` text,
  	\`version_how_calculated\` text,
  	\`version_how_to_read\` text,
  	\`version_seo_meta_title\` text,
  	\`version_seo_canonical\` text,
  	\`version_seo_meta_description\` text,
  	\`version_seo_no_index\` integer DEFAULT false,
  	\`version_seo_og_image_id\` integer,
  	\`version_slug\` text,
  	\`version_sort_order\` numeric DEFAULT 0,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	\`autosave\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`tools\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new__tools_v\`("id", "parent_id", "version_name", "version_category_id", "version_tool_type", "version_coded_component", "version_icon", "version_gradient", "version_accent_color", "version_minutes_badge", "version_enabled", "version_featured", "version_what_it_is", "version_how_calculated", "version_how_to_read", "version_seo_meta_title", "version_seo_canonical", "version_seo_meta_description", "version_seo_no_index", "version_seo_og_image_id", "version_slug", "version_sort_order", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest", "autosave") SELECT "id", "parent_id", "version_name", "version_category_id", "version_tool_type", "version_coded_component", "version_icon", "version_gradient", "version_accent_color", "version_minutes_badge", "version_enabled", "version_featured", "version_what_it_is", "version_how_calculated", "version_how_to_read", "version_seo_meta_title", "version_seo_canonical", "version_seo_meta_description", "version_seo_no_index", "version_seo_og_image_id", "version_slug", "version_sort_order", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest", "autosave" FROM \`_tools_v\`;`)
  await db.run(sql`DROP TABLE \`_tools_v\`;`)
  await db.run(sql`ALTER TABLE \`__new__tools_v\` RENAME TO \`_tools_v\`;`)
  await db.run(sql`CREATE INDEX \`_tools_v_parent_idx\` ON \`_tools_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_tools_v_version_version_category_idx\` ON \`_tools_v\` (\`version_category_id\`);`)
  await db.run(sql`CREATE INDEX \`_tools_v_version_seo_version_seo_og_image_idx\` ON \`_tools_v\` (\`version_seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_tools_v_version_version_slug_idx\` ON \`_tools_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_tools_v_version_version_updated_at_idx\` ON \`_tools_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_tools_v_version_version_created_at_idx\` ON \`_tools_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_tools_v_version_version__status_idx\` ON \`_tools_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_tools_v_created_at_idx\` ON \`_tools_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_tools_v_updated_at_idx\` ON \`_tools_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_tools_v_latest_idx\` ON \`_tools_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_tools_v_autosave_idx\` ON \`_tools_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`__new_articles\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`excerpt\` text,
  	\`hero_image_id\` integer,
  	\`seo_meta_title\` text,
  	\`seo_canonical\` text,
  	\`seo_meta_description\` text,
  	\`seo_no_index\` integer DEFAULT false,
  	\`seo_og_image_id\` integer,
  	\`slug\` text,
  	\`category_id\` integer,
  	\`author_id\` integer,
  	\`reviewer_id\` integer,
  	\`publish_date\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`author_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`reviewer_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_articles\`("id", "title", "excerpt", "hero_image_id", "seo_meta_title", "seo_canonical", "seo_meta_description", "seo_no_index", "seo_og_image_id", "slug", "category_id", "author_id", "reviewer_id", "publish_date", "updated_at", "created_at", "_status") SELECT "id", "title", "excerpt", "hero_image_id", "seo_meta_title", "seo_canonical", "seo_meta_description", "seo_no_index", "seo_og_image_id", "slug", "category_id", "author_id", "reviewer_id", "publish_date", "updated_at", "created_at", "_status" FROM \`articles\`;`)
  await db.run(sql`DROP TABLE \`articles\`;`)
  await db.run(sql`ALTER TABLE \`__new_articles\` RENAME TO \`articles\`;`)
  await db.run(sql`CREATE INDEX \`articles_hero_image_idx\` ON \`articles\` (\`hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_seo_seo_og_image_idx\` ON \`articles\` (\`seo_og_image_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`articles_slug_idx\` ON \`articles\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`articles_category_idx\` ON \`articles\` (\`category_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_author_idx\` ON \`articles\` (\`author_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_reviewer_idx\` ON \`articles\` (\`reviewer_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_updated_at_idx\` ON \`articles\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`articles_created_at_idx\` ON \`articles\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`articles__status_idx\` ON \`articles\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`__new__articles_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_excerpt\` text,
  	\`version_hero_image_id\` integer,
  	\`version_seo_meta_title\` text,
  	\`version_seo_canonical\` text,
  	\`version_seo_meta_description\` text,
  	\`version_seo_no_index\` integer DEFAULT false,
  	\`version_seo_og_image_id\` integer,
  	\`version_slug\` text,
  	\`version_category_id\` integer,
  	\`version_author_id\` integer,
  	\`version_reviewer_id\` integer,
  	\`version_publish_date\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	\`autosave\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_author_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_reviewer_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new__articles_v\`("id", "parent_id", "version_title", "version_excerpt", "version_hero_image_id", "version_seo_meta_title", "version_seo_canonical", "version_seo_meta_description", "version_seo_no_index", "version_seo_og_image_id", "version_slug", "version_category_id", "version_author_id", "version_reviewer_id", "version_publish_date", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest", "autosave") SELECT "id", "parent_id", "version_title", "version_excerpt", "version_hero_image_id", "version_seo_meta_title", "version_seo_canonical", "version_seo_meta_description", "version_seo_no_index", "version_seo_og_image_id", "version_slug", "version_category_id", "version_author_id", "version_reviewer_id", "version_publish_date", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest", "autosave" FROM \`_articles_v\`;`)
  await db.run(sql`DROP TABLE \`_articles_v\`;`)
  await db.run(sql`ALTER TABLE \`__new__articles_v\` RENAME TO \`_articles_v\`;`)
  await db.run(sql`CREATE INDEX \`_articles_v_parent_idx\` ON \`_articles_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_hero_image_idx\` ON \`_articles_v\` (\`version_hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_seo_version_seo_og_image_idx\` ON \`_articles_v\` (\`version_seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_slug_idx\` ON \`_articles_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_category_idx\` ON \`_articles_v\` (\`version_category_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_author_idx\` ON \`_articles_v\` (\`version_author_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_reviewer_idx\` ON \`_articles_v\` (\`version_reviewer_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_updated_at_idx\` ON \`_articles_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_created_at_idx\` ON \`_articles_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version__status_idx\` ON \`_articles_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_created_at_idx\` ON \`_articles_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_updated_at_idx\` ON \`_articles_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_latest_idx\` ON \`_articles_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_autosave_idx\` ON \`_articles_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`__new_pages\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`hero_image_id\` integer,
  	\`seo_meta_title\` text,
  	\`seo_canonical\` text,
  	\`seo_meta_description\` text,
  	\`seo_no_index\` integer DEFAULT false,
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
  await db.run(sql`INSERT INTO \`__new_pages\`("id", "title", "hero_image_id", "seo_meta_title", "seo_canonical", "seo_meta_description", "seo_no_index", "seo_og_image_id", "slug", "publish_date", "updated_at", "created_at", "_status") SELECT "id", "title", "hero_image_id", "seo_meta_title", "seo_canonical", "seo_meta_description", "seo_no_index", "seo_og_image_id", "slug", "publish_date", "updated_at", "created_at", "_status" FROM \`pages\`;`)
  await db.run(sql`DROP TABLE \`pages\`;`)
  await db.run(sql`ALTER TABLE \`__new_pages\` RENAME TO \`pages\`;`)
  await db.run(sql`CREATE INDEX \`pages_hero_image_idx\` ON \`pages\` (\`hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_seo_seo_og_image_idx\` ON \`pages\` (\`seo_og_image_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_slug_idx\` ON \`pages\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`pages_updated_at_idx\` ON \`pages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pages_created_at_idx\` ON \`pages\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`pages__status_idx\` ON \`pages\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`__new__pages_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_hero_image_id\` integer,
  	\`version_seo_meta_title\` text,
  	\`version_seo_canonical\` text,
  	\`version_seo_meta_description\` text,
  	\`version_seo_no_index\` integer DEFAULT false,
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
  await db.run(sql`INSERT INTO \`__new__pages_v\`("id", "parent_id", "version_title", "version_hero_image_id", "version_seo_meta_title", "version_seo_canonical", "version_seo_meta_description", "version_seo_no_index", "version_seo_og_image_id", "version_slug", "version_publish_date", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest", "autosave") SELECT "id", "parent_id", "version_title", "version_hero_image_id", "version_seo_meta_title", "version_seo_canonical", "version_seo_meta_description", "version_seo_no_index", "version_seo_og_image_id", "version_slug", "version_publish_date", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest", "autosave" FROM \`_pages_v\`;`)
  await db.run(sql`DROP TABLE \`_pages_v\`;`)
  await db.run(sql`ALTER TABLE \`__new__pages_v\` RENAME TO \`_pages_v\`;`)
  await db.run(sql`CREATE INDEX \`_pages_v_parent_idx\` ON \`_pages_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_hero_image_idx\` ON \`_pages_v\` (\`version_hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_seo_version_seo_og_image_idx\` ON \`_pages_v\` (\`version_seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_slug_idx\` ON \`_pages_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_updated_at_idx\` ON \`_pages_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_created_at_idx\` ON \`_pages_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version__status_idx\` ON \`_pages_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_created_at_idx\` ON \`_pages_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_updated_at_idx\` ON \`_pages_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_latest_idx\` ON \`_pages_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_autosave_idx\` ON \`_pages_v\` (\`autosave\`);`)
}
