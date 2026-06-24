import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`ad_management_slots\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`placement\` text NOT NULL,
  	\`enabled\` integer DEFAULT true,
  	\`format\` text DEFAULT 'auto',
  	\`label\` text,
  	\`adsense_slot_id\` text,
  	\`custom_code\` text,
  	\`affiliate_banner_image_id\` integer,
  	\`affiliate_banner_alt\` text,
  	\`affiliate_banner_url\` text,
  	\`affiliate_banner_width\` numeric,
  	\`affiliate_banner_height\` numeric,
  	FOREIGN KEY (\`affiliate_banner_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`ad_management\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`ad_management_slots_order_idx\` ON \`ad_management_slots\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`ad_management_slots_parent_id_idx\` ON \`ad_management_slots\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`ad_management_slots_affiliate_banner_affiliate_banner_im_idx\` ON \`ad_management_slots\` (\`affiliate_banner_image_id\`);`)
  await db.run(sql`CREATE TABLE \`ad_management_affiliates_target_slots\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` text NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`ad_management_affiliates\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`ad_management_affiliates_target_slots_order_idx\` ON \`ad_management_affiliates_target_slots\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`ad_management_affiliates_target_slots_parent_idx\` ON \`ad_management_affiliates_target_slots\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`ad_management_affiliates\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`enabled\` integer DEFAULT true,
  	\`url\` text NOT NULL,
  	\`image_id\` integer NOT NULL,
  	\`alt\` text,
  	\`width\` numeric,
  	\`height\` numeric,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`ad_management\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`ad_management_affiliates_order_idx\` ON \`ad_management_affiliates\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`ad_management_affiliates_parent_id_idx\` ON \`ad_management_affiliates\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`ad_management_affiliates_image_idx\` ON \`ad_management_affiliates\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`ad_management\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`adsense_enabled\` integer DEFAULT false,
  	\`adsense_client\` text,
  	\`lazy_load\` integer DEFAULT true,
  	\`partytown_enabled\` integer DEFAULT true,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`ALTER TABLE \`users\` ADD \`enable_a_p_i_key\` integer;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`api_key\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`api_key_index\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`ad_management_slots\`;`)
  await db.run(sql`DROP TABLE \`ad_management_affiliates_target_slots\`;`)
  await db.run(sql`DROP TABLE \`ad_management_affiliates\`;`)
  await db.run(sql`DROP TABLE \`ad_management\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`enable_a_p_i_key\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`api_key\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`api_key_index\`;`)
}
