import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_settings_social\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`platform\` text,
  	\`url\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_settings_social\`("_order", "_parent_id", "id", "platform", "url") SELECT "_order", "_parent_id", "id", "platform", "url" FROM \`settings_social\`;`)
  await db.run(sql`DROP TABLE \`settings_social\`;`)
  await db.run(sql`ALTER TABLE \`__new_settings_social\` RENAME TO \`settings_social\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`settings_social_order_idx\` ON \`settings_social\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`settings_social_parent_id_idx\` ON \`settings_social\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`__new__settings_v_version_social\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`platform\` text,
  	\`url\` text NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_settings_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new__settings_v_version_social\`("_order", "_parent_id", "id", "platform", "url", "_uuid") SELECT "_order", "_parent_id", "id", "platform", "url", "_uuid" FROM \`_settings_v_version_social\`;`)
  await db.run(sql`DROP TABLE \`_settings_v_version_social\`;`)
  await db.run(sql`ALTER TABLE \`__new__settings_v_version_social\` RENAME TO \`_settings_v_version_social\`;`)
  await db.run(sql`CREATE INDEX \`_settings_v_version_social_order_idx\` ON \`_settings_v_version_social\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_settings_v_version_social_parent_id_idx\` ON \`_settings_v_version_social\` (\`_parent_id\`);`)
  await db.run(sql`ALTER TABLE \`settings\` ADD \`favicon_id\` integer REFERENCES media(id);`)
  await db.run(sql`ALTER TABLE \`settings\` ADD \`primary_color\` text DEFAULT '#22c55e';`)
  await db.run(sql`ALTER TABLE \`settings\` ADD \`secondary_color\` text DEFAULT '#3b82f6';`)
  await db.run(sql`ALTER TABLE \`settings\` ADD \`copyright_text\` text DEFAULT '© 2026 HealthyLifeStyles. All rights reserved.';`)
  await db.run(sql`CREATE INDEX \`settings_favicon_idx\` ON \`settings\` (\`favicon_id\`);`)
  await db.run(sql`ALTER TABLE \`_settings_v\` ADD \`version_favicon_id\` integer REFERENCES media(id);`)
  await db.run(sql`ALTER TABLE \`_settings_v\` ADD \`version_primary_color\` text DEFAULT '#22c55e';`)
  await db.run(sql`ALTER TABLE \`_settings_v\` ADD \`version_secondary_color\` text DEFAULT '#3b82f6';`)
  await db.run(sql`ALTER TABLE \`_settings_v\` ADD \`version_copyright_text\` text DEFAULT '© 2026 HealthyLifeStyles. All rights reserved.';`)
  await db.run(sql`CREATE INDEX \`_settings_v_version_version_favicon_idx\` ON \`_settings_v\` (\`version_favicon_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`site_title\` text DEFAULT 'HealthyLifeStyles' NOT NULL,
  	\`tagline\` text DEFAULT 'Trusted Wellness',
  	\`description\` text,
  	\`logo_id\` integer,
  	\`default_og_image_id\` integer,
  	\`ga4_id\` text,
  	\`search_console_id\` text,
  	\`ads_enabled\` integer DEFAULT false,
  	\`adsense_client\` text,
  	\`affiliate_disclosure\` text DEFAULT 'As an affiliate we may earn from qualifying purchases — at no extra cost to you.',
  	\`cookie_consent_text\` text,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`default_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_settings\`("id", "site_title", "tagline", "description", "logo_id", "default_og_image_id", "ga4_id", "search_console_id", "ads_enabled", "adsense_client", "affiliate_disclosure", "cookie_consent_text", "updated_at", "created_at") SELECT "id", "site_title", "tagline", "description", "logo_id", "default_og_image_id", "ga4_id", "search_console_id", "ads_enabled", "adsense_client", "affiliate_disclosure", "cookie_consent_text", "updated_at", "created_at" FROM \`settings\`;`)
  await db.run(sql`DROP TABLE \`settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_settings\` RENAME TO \`settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`settings_logo_idx\` ON \`settings\` (\`logo_id\`);`)
  await db.run(sql`CREATE INDEX \`settings_default_og_image_idx\` ON \`settings\` (\`default_og_image_id\`);`)
  await db.run(sql`CREATE TABLE \`__new__settings_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`version_site_title\` text DEFAULT 'HealthyLifeStyles' NOT NULL,
  	\`version_tagline\` text DEFAULT 'Trusted Wellness',
  	\`version_description\` text,
  	\`version_logo_id\` integer,
  	\`version_default_og_image_id\` integer,
  	\`version_ga4_id\` text,
  	\`version_search_console_id\` text,
  	\`version_ads_enabled\` integer DEFAULT false,
  	\`version_adsense_client\` text,
  	\`version_affiliate_disclosure\` text DEFAULT 'As an affiliate we may earn from qualifying purchases — at no extra cost to you.',
  	\`version_cookie_consent_text\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`version_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_default_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new__settings_v\`("id", "version_site_title", "version_tagline", "version_description", "version_logo_id", "version_default_og_image_id", "version_ga4_id", "version_search_console_id", "version_ads_enabled", "version_adsense_client", "version_affiliate_disclosure", "version_cookie_consent_text", "version_updated_at", "version_created_at", "created_at", "updated_at") SELECT "id", "version_site_title", "version_tagline", "version_description", "version_logo_id", "version_default_og_image_id", "version_ga4_id", "version_search_console_id", "version_ads_enabled", "version_adsense_client", "version_affiliate_disclosure", "version_cookie_consent_text", "version_updated_at", "version_created_at", "created_at", "updated_at" FROM \`_settings_v\`;`)
  await db.run(sql`DROP TABLE \`_settings_v\`;`)
  await db.run(sql`ALTER TABLE \`__new__settings_v\` RENAME TO \`_settings_v\`;`)
  await db.run(sql`CREATE INDEX \`_settings_v_version_version_logo_idx\` ON \`_settings_v\` (\`version_logo_id\`);`)
  await db.run(sql`CREATE INDEX \`_settings_v_version_version_default_og_image_idx\` ON \`_settings_v\` (\`version_default_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_settings_v_created_at_idx\` ON \`_settings_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_settings_v_updated_at_idx\` ON \`_settings_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`__new_settings_social\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`platform\` text,
  	\`url\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_settings_social\`("_order", "_parent_id", "id", "platform", "url") SELECT "_order", "_parent_id", "id", "platform", "url" FROM \`settings_social\`;`)
  await db.run(sql`DROP TABLE \`settings_social\`;`)
  await db.run(sql`ALTER TABLE \`__new_settings_social\` RENAME TO \`settings_social\`;`)
  await db.run(sql`CREATE INDEX \`settings_social_order_idx\` ON \`settings_social\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`settings_social_parent_id_idx\` ON \`settings_social\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`__new__settings_v_version_social\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`platform\` text,
  	\`url\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_settings_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new__settings_v_version_social\`("_order", "_parent_id", "id", "platform", "url", "_uuid") SELECT "_order", "_parent_id", "id", "platform", "url", "_uuid" FROM \`_settings_v_version_social\`;`)
  await db.run(sql`DROP TABLE \`_settings_v_version_social\`;`)
  await db.run(sql`ALTER TABLE \`__new__settings_v_version_social\` RENAME TO \`_settings_v_version_social\`;`)
  await db.run(sql`CREATE INDEX \`_settings_v_version_social_order_idx\` ON \`_settings_v_version_social\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_settings_v_version_social_parent_id_idx\` ON \`_settings_v_version_social\` (\`_parent_id\`);`)
}
