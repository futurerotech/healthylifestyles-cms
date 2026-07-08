import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ai_settings_task_model_map_task_type" AS ENUM('meta_trim', 'faq_gen', 'cannibalization', 'article_gen', 'link_fix');
  CREATE TABLE "ai_settings_providers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"provider_url" varchar DEFAULT 'https://api.openai.com/v1' NOT NULL,
  	"api_key" varchar NOT NULL,
  	"enabled" boolean DEFAULT true
  );
  
  CREATE TABLE "ai_settings_task_model_map" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"task_type" "enum_ai_settings_task_model_map_task_type" NOT NULL,
  	"model" varchar NOT NULL,
  	"max_tokens" numeric DEFAULT 4096,
  	"temperature" numeric DEFAULT 0.3
  );
  
  CREATE TABLE "ai_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"default_model" varchar DEFAULT 'glm-5.2-plan' NOT NULL,
  	"request_timeout_ms" numeric DEFAULT 60000,
  	"daily_cost_cap_usd" numeric DEFAULT 20,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "ai_settings_providers" ADD CONSTRAINT "ai_settings_providers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ai_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_settings_task_model_map" ADD CONSTRAINT "ai_settings_task_model_map_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ai_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "ai_settings_providers_order_idx" ON "ai_settings_providers" USING btree ("_order");
  CREATE INDEX "ai_settings_providers_parent_id_idx" ON "ai_settings_providers" USING btree ("_parent_id");
  CREATE INDEX "ai_settings_task_model_map_order_idx" ON "ai_settings_task_model_map" USING btree ("_order");
  CREATE INDEX "ai_settings_task_model_map_parent_id_idx" ON "ai_settings_task_model_map" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "ai_settings_providers" CASCADE;
  DROP TABLE "ai_settings_task_model_map" CASCADE;
  DROP TABLE "ai_settings" CASCADE;
  DROP TYPE "public"."enum_ai_settings_task_model_map_task_type";`)
}
