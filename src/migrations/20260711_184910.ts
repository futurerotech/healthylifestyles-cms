import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * P15 localization migration — HARDENED for existing data.
 *
 * Two safety changes vs the generated version (both required to run against a
 * populated database without data loss):
 *
 * 1. NOT-NULL `_locale` on ALREADY-POPULATED child tables is added in two steps
 *    — `ADD COLUMN … DEFAULT 'en' NOT NULL` (backfills existing rows to the
 *    default locale) then `ALTER COLUMN … DROP DEFAULT` (so Payload must supply
 *    the locale on future writes). The column type is the enum `"_locales"`
 *    (NOT varchar) to match Payload's generated Drizzle schema. New/empty tables
 *    (articles_takeaways, …_locales, …_version_takeaways) keep a plain NOT NULL.
 *
 * 2. `title`/`excerpt` (and their version-table counterparts) are COPIED into
 *    the new `_locales` tables under 'en' BEFORE the base columns are dropped.
 *    The generated migration dropped them with no backfill; because the whole
 *    up() is one transaction and it had been failing at step (1), those drops
 *    never ran and the values are still present on the base tables — this
 *    backfill preserves them. Idempotent via the (_locale,_parent_id) unique
 *    indexes created below.
 *
 * MUST be dry-run on a restored production-shaped snapshot before deploy.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'es', 'ar');
  CREATE TYPE "public"."enum__tools_v_published_locale" AS ENUM('en', 'es', 'ar');
  CREATE TYPE "public"."enum__articles_v_published_locale" AS ENUM('en', 'es', 'ar');
  CREATE TYPE "public"."enum__pages_v_published_locale" AS ENUM('en', 'es', 'ar');
  CREATE TABLE "articles_takeaways" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );

  CREATE TABLE "articles_locales" (
  	"title" varchar,
  	"excerpt" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );

  CREATE TABLE "_articles_v_version_takeaways" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );

  CREATE TABLE "_articles_v_locales" (
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );

  ALTER TABLE "_tools_v" ADD COLUMN "snapshot" boolean;
  ALTER TABLE "_tools_v" ADD COLUMN "published_locale" "enum__tools_v_published_locale";
  ALTER TABLE "articles_blocks_hero" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_hero" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_calculator_embed" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_calculator_embed" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_two_column" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_two_column" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_viral_hook_banner" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_viral_hook_banner" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_tool_embed" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_tool_embed" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_people_also_ask_items" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_people_also_ask_items" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_people_also_ask" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_people_also_ask" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_text" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_text" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_list_items" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_list_items" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_list" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_list" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_callout" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_callout" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_table_rows" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_table_rows" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_blocks_table" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_blocks_table" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles_faq" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "articles_faq" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "articles" ADD COLUMN "has_f_a_q" boolean DEFAULT false;
  ALTER TABLE "articles_texts" ADD COLUMN "locale" "_locales";
  ALTER TABLE "_articles_v_blocks_hero" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_hero" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_calculator_embed" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_calculator_embed" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_two_column" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_two_column" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_viral_hook_banner" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_viral_hook_banner" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_tool_embed" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_tool_embed" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_people_also_ask_items" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_people_also_ask_items" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_people_also_ask" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_people_also_ask" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_text" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_text" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_list_items" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_list_items" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_list" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_list" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_callout" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_callout" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_table_rows" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_table_rows" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_blocks_table" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_blocks_table" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v_version_faq" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_articles_v_version_faq" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_articles_v" ADD COLUMN "version_has_f_a_q" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "snapshot" boolean;
  ALTER TABLE "_articles_v" ADD COLUMN "published_locale" "enum__articles_v_published_locale";
  ALTER TABLE "_articles_v_texts" ADD COLUMN "locale" "_locales";
  ALTER TABLE "_pages_v" ADD COLUMN "snapshot" boolean;
  ALTER TABLE "_pages_v" ADD COLUMN "published_locale" "enum__pages_v_published_locale";
  ALTER TABLE "articles_takeaways" ADD CONSTRAINT "articles_takeaways_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_locales" ADD CONSTRAINT "articles_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_takeaways" ADD CONSTRAINT "_articles_v_version_takeaways_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_locales" ADD CONSTRAINT "_articles_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_takeaways_order_idx" ON "articles_takeaways" USING btree ("_order");
  CREATE INDEX "articles_takeaways_parent_id_idx" ON "articles_takeaways" USING btree ("_parent_id");
  CREATE INDEX "articles_takeaways_locale_idx" ON "articles_takeaways" USING btree ("_locale");
  CREATE UNIQUE INDEX "articles_locales_locale_parent_id_unique" ON "articles_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_articles_v_version_takeaways_order_idx" ON "_articles_v_version_takeaways" USING btree ("_order");
  CREATE INDEX "_articles_v_version_takeaways_parent_id_idx" ON "_articles_v_version_takeaways" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_takeaways_locale_idx" ON "_articles_v_version_takeaways" USING btree ("_locale");
  CREATE UNIQUE INDEX "_articles_v_locales_locale_parent_id_unique" ON "_articles_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_tools_v_snapshot_idx" ON "_tools_v" USING btree ("snapshot");
  CREATE INDEX "_tools_v_published_locale_idx" ON "_tools_v" USING btree ("published_locale");
  CREATE INDEX "articles_blocks_hero_locale_idx" ON "articles_blocks_hero" USING btree ("_locale");
  CREATE INDEX "articles_blocks_calculator_embed_locale_idx" ON "articles_blocks_calculator_embed" USING btree ("_locale");
  CREATE INDEX "articles_blocks_two_column_locale_idx" ON "articles_blocks_two_column" USING btree ("_locale");
  CREATE INDEX "articles_blocks_viral_hook_banner_locale_idx" ON "articles_blocks_viral_hook_banner" USING btree ("_locale");
  CREATE INDEX "articles_blocks_tool_embed_locale_idx" ON "articles_blocks_tool_embed" USING btree ("_locale");
  CREATE INDEX "articles_blocks_people_also_ask_items_locale_idx" ON "articles_blocks_people_also_ask_items" USING btree ("_locale");
  CREATE INDEX "articles_blocks_people_also_ask_locale_idx" ON "articles_blocks_people_also_ask" USING btree ("_locale");
  CREATE INDEX "articles_blocks_text_locale_idx" ON "articles_blocks_text" USING btree ("_locale");
  CREATE INDEX "articles_blocks_list_items_locale_idx" ON "articles_blocks_list_items" USING btree ("_locale");
  CREATE INDEX "articles_blocks_list_locale_idx" ON "articles_blocks_list" USING btree ("_locale");
  CREATE INDEX "articles_blocks_callout_locale_idx" ON "articles_blocks_callout" USING btree ("_locale");
  CREATE INDEX "articles_blocks_table_rows_locale_idx" ON "articles_blocks_table_rows" USING btree ("_locale");
  CREATE INDEX "articles_blocks_table_locale_idx" ON "articles_blocks_table" USING btree ("_locale");
  CREATE INDEX "articles_faq_locale_idx" ON "articles_faq" USING btree ("_locale");
  CREATE INDEX "articles_texts_locale_parent" ON "articles_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_articles_v_blocks_hero_locale_idx" ON "_articles_v_blocks_hero" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_calculator_embed_locale_idx" ON "_articles_v_blocks_calculator_embed" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_two_column_locale_idx" ON "_articles_v_blocks_two_column" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_viral_hook_banner_locale_idx" ON "_articles_v_blocks_viral_hook_banner" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_tool_embed_locale_idx" ON "_articles_v_blocks_tool_embed" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_people_also_ask_items_locale_idx" ON "_articles_v_blocks_people_also_ask_items" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_people_also_ask_locale_idx" ON "_articles_v_blocks_people_also_ask" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_text_locale_idx" ON "_articles_v_blocks_text" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_list_items_locale_idx" ON "_articles_v_blocks_list_items" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_list_locale_idx" ON "_articles_v_blocks_list" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_callout_locale_idx" ON "_articles_v_blocks_callout" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_table_rows_locale_idx" ON "_articles_v_blocks_table_rows" USING btree ("_locale");
  CREATE INDEX "_articles_v_blocks_table_locale_idx" ON "_articles_v_blocks_table" USING btree ("_locale");
  CREATE INDEX "_articles_v_version_faq_locale_idx" ON "_articles_v_version_faq" USING btree ("_locale");
  CREATE INDEX "_articles_v_snapshot_idx" ON "_articles_v" USING btree ("snapshot");
  CREATE INDEX "_articles_v_published_locale_idx" ON "_articles_v" USING btree ("published_locale");
  CREATE INDEX "_articles_v_texts_locale_parent" ON "_articles_v_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_pages_v_snapshot_idx" ON "_pages_v" USING btree ("snapshot");
  CREATE INDEX "_pages_v_published_locale_idx" ON "_pages_v" USING btree ("published_locale");
  INSERT INTO "articles_locales" ("_locale","_parent_id","title","excerpt")
    SELECT 'en', "id", "title", "excerpt" FROM "articles"
    ON CONFLICT ("_locale","_parent_id") DO NOTHING;
  INSERT INTO "_articles_v_locales" ("_locale","_parent_id","version_title","version_excerpt")
    SELECT 'en', "id", "version_title", "version_excerpt" FROM "_articles_v"
    ON CONFLICT ("_locale","_parent_id") DO NOTHING;
  UPDATE "articles_texts" SET "locale" = 'en' WHERE "locale" IS NULL;
  UPDATE "_articles_v_texts" SET "locale" = 'en' WHERE "locale" IS NULL;
  ALTER TABLE "articles" DROP COLUMN "title";
  ALTER TABLE "articles" DROP COLUMN "excerpt";
  ALTER TABLE "_articles_v" DROP COLUMN "version_title";
  ALTER TABLE "_articles_v" DROP COLUMN "version_excerpt";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "title" varchar;
  ALTER TABLE "articles" ADD COLUMN "excerpt" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_title" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_excerpt" varchar;
  UPDATE "articles" a SET "title" = l."title", "excerpt" = l."excerpt"
    FROM "articles_locales" l WHERE l."_parent_id" = a."id" AND l."_locale" = 'en';
  UPDATE "_articles_v" v SET "version_title" = l."version_title", "version_excerpt" = l."version_excerpt"
    FROM "_articles_v_locales" l WHERE l."_parent_id" = v."id" AND l."_locale" = 'en';
  ALTER TABLE "articles_takeaways" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "articles_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v_version_takeaways" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "articles_takeaways" CASCADE;
  DROP TABLE "articles_locales" CASCADE;
  DROP TABLE "_articles_v_version_takeaways" CASCADE;
  DROP TABLE "_articles_v_locales" CASCADE;
  DROP INDEX "_tools_v_snapshot_idx";
  DROP INDEX "_tools_v_published_locale_idx";
  DROP INDEX "articles_blocks_hero_locale_idx";
  DROP INDEX "articles_blocks_calculator_embed_locale_idx";
  DROP INDEX "articles_blocks_two_column_locale_idx";
  DROP INDEX "articles_blocks_viral_hook_banner_locale_idx";
  DROP INDEX "articles_blocks_tool_embed_locale_idx";
  DROP INDEX "articles_blocks_people_also_ask_items_locale_idx";
  DROP INDEX "articles_blocks_people_also_ask_locale_idx";
  DROP INDEX "articles_blocks_text_locale_idx";
  DROP INDEX "articles_blocks_list_items_locale_idx";
  DROP INDEX "articles_blocks_list_locale_idx";
  DROP INDEX "articles_blocks_callout_locale_idx";
  DROP INDEX "articles_blocks_table_rows_locale_idx";
  DROP INDEX "articles_blocks_table_locale_idx";
  DROP INDEX "articles_faq_locale_idx";
  DROP INDEX "articles_texts_locale_parent";
  DROP INDEX "_articles_v_blocks_hero_locale_idx";
  DROP INDEX "_articles_v_blocks_calculator_embed_locale_idx";
  DROP INDEX "_articles_v_blocks_two_column_locale_idx";
  DROP INDEX "_articles_v_blocks_viral_hook_banner_locale_idx";
  DROP INDEX "_articles_v_blocks_tool_embed_locale_idx";
  DROP INDEX "_articles_v_blocks_people_also_ask_items_locale_idx";
  DROP INDEX "_articles_v_blocks_people_also_ask_locale_idx";
  DROP INDEX "_articles_v_blocks_text_locale_idx";
  DROP INDEX "_articles_v_blocks_list_items_locale_idx";
  DROP INDEX "_articles_v_blocks_list_locale_idx";
  DROP INDEX "_articles_v_blocks_callout_locale_idx";
  DROP INDEX "_articles_v_blocks_table_rows_locale_idx";
  DROP INDEX "_articles_v_blocks_table_locale_idx";
  DROP INDEX "_articles_v_version_faq_locale_idx";
  DROP INDEX "_articles_v_snapshot_idx";
  DROP INDEX "_articles_v_published_locale_idx";
  DROP INDEX "_articles_v_texts_locale_parent";
  DROP INDEX "_pages_v_snapshot_idx";
  DROP INDEX "_pages_v_published_locale_idx";
  ALTER TABLE "_tools_v" DROP COLUMN "snapshot";
  ALTER TABLE "_tools_v" DROP COLUMN "published_locale";
  ALTER TABLE "articles_blocks_hero" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_calculator_embed" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_two_column" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_viral_hook_banner" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_tool_embed" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_people_also_ask_items" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_people_also_ask" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_text" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_list_items" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_list" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_callout" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_table_rows" DROP COLUMN "_locale";
  ALTER TABLE "articles_blocks_table" DROP COLUMN "_locale";
  ALTER TABLE "articles_faq" DROP COLUMN "_locale";
  ALTER TABLE "articles" DROP COLUMN "has_f_a_q";
  ALTER TABLE "articles_texts" DROP COLUMN "locale";
  ALTER TABLE "_articles_v_blocks_hero" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_calculator_embed" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_two_column" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_viral_hook_banner" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_tool_embed" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_people_also_ask_items" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_people_also_ask" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_text" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_list_items" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_list" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_callout" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_table_rows" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_blocks_table" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v_version_faq" DROP COLUMN "_locale";
  ALTER TABLE "_articles_v" DROP COLUMN "version_has_f_a_q";
  ALTER TABLE "_articles_v" DROP COLUMN "snapshot";
  ALTER TABLE "_articles_v" DROP COLUMN "published_locale";
  ALTER TABLE "_articles_v_texts" DROP COLUMN "locale";
  ALTER TABLE "_pages_v" DROP COLUMN "snapshot";
  ALTER TABLE "_pages_v" DROP COLUMN "published_locale";
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum__tools_v_published_locale";
  DROP TYPE "public"."enum__articles_v_published_locale";
  DROP TYPE "public"."enum__pages_v_published_locale";`)
}
