import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_link_prospects_outreach_log_direction" AS ENUM('sent', 'reply', 'note');
  CREATE TYPE "public"."enum_link_prospects_status" AS ENUM('prospect', 'contacted', 'replied', 'won', 'rejected');
  CREATE TYPE "public"."enum_link_prospects_topic_relevance" AS ENUM('high', 'medium', 'low');
  CREATE TYPE "public"."enum_outreach_templates_type" AS ENUM('guest-post', 'free-calculator', 'broken-link', 'data-study', 'custom');
  CREATE TYPE "public"."enum_backlinks_link_type" AS ENUM('dofollow', 'nofollow');
  CREATE TYPE "public"."enum_backlinks_live_status" AS ENUM('pending', 'live', 'lost');
  CREATE TABLE "link_prospects_outreach_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"direction" "enum_link_prospects_outreach_log_direction" DEFAULT 'sent' NOT NULL,
  	"template_id" integer,
  	"subject" varchar,
  	"summary" varchar
  );
  
  CREATE TABLE "link_prospects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_name" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"status" "enum_link_prospects_status" DEFAULT 'prospect' NOT NULL,
  	"domain_authority" numeric,
  	"topic_relevance" "enum_link_prospects_topic_relevance" DEFAULT 'medium',
  	"contact_name" varchar,
  	"contact_email" varchar,
  	"follow_up_date" timestamp(3) with time zone,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "outreach_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"type" "enum_outreach_templates_type" DEFAULT 'custom' NOT NULL,
  	"subject" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "backlinks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"source_url" varchar NOT NULL,
  	"target_page" varchar NOT NULL,
  	"anchor_text" varchar,
  	"link_type" "enum_backlinks_link_type" DEFAULT 'dofollow',
  	"date_earned" timestamp(3) with time zone,
  	"live_status" "enum_backlinks_live_status" DEFAULT 'pending',
  	"last_checked_at" timestamp(3) with time zone,
  	"prospect_id" integer,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "embed_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tool_slug" varchar NOT NULL,
  	"referrer_host" varchar NOT NULL,
  	"referrer_url" varchar,
  	"count" numeric DEFAULT 1,
  	"last_seen_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "link_prospects_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "outreach_templates_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "backlinks_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "embed_logs_id" integer;
  ALTER TABLE "link_prospects_outreach_log" ADD CONSTRAINT "link_prospects_outreach_log_template_id_outreach_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."outreach_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "link_prospects_outreach_log" ADD CONSTRAINT "link_prospects_outreach_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."link_prospects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "backlinks" ADD CONSTRAINT "backlinks_prospect_id_link_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."link_prospects"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "link_prospects_outreach_log_order_idx" ON "link_prospects_outreach_log" USING btree ("_order");
  CREATE INDEX "link_prospects_outreach_log_parent_id_idx" ON "link_prospects_outreach_log" USING btree ("_parent_id");
  CREATE INDEX "link_prospects_outreach_log_template_idx" ON "link_prospects_outreach_log" USING btree ("template_id");
  CREATE INDEX "link_prospects_status_idx" ON "link_prospects" USING btree ("status");
  CREATE INDEX "link_prospects_follow_up_date_idx" ON "link_prospects" USING btree ("follow_up_date");
  CREATE INDEX "link_prospects_updated_at_idx" ON "link_prospects" USING btree ("updated_at");
  CREATE INDEX "link_prospects_created_at_idx" ON "link_prospects" USING btree ("created_at");
  CREATE INDEX "outreach_templates_updated_at_idx" ON "outreach_templates" USING btree ("updated_at");
  CREATE INDEX "outreach_templates_created_at_idx" ON "outreach_templates" USING btree ("created_at");
  CREATE INDEX "backlinks_source_url_idx" ON "backlinks" USING btree ("source_url");
  CREATE INDEX "backlinks_date_earned_idx" ON "backlinks" USING btree ("date_earned");
  CREATE INDEX "backlinks_live_status_idx" ON "backlinks" USING btree ("live_status");
  CREATE INDEX "backlinks_prospect_idx" ON "backlinks" USING btree ("prospect_id");
  CREATE INDEX "backlinks_updated_at_idx" ON "backlinks" USING btree ("updated_at");
  CREATE INDEX "backlinks_created_at_idx" ON "backlinks" USING btree ("created_at");
  CREATE INDEX "embed_logs_tool_slug_idx" ON "embed_logs" USING btree ("tool_slug");
  CREATE INDEX "embed_logs_referrer_host_idx" ON "embed_logs" USING btree ("referrer_host");
  CREATE INDEX "embed_logs_updated_at_idx" ON "embed_logs" USING btree ("updated_at");
  CREATE INDEX "embed_logs_created_at_idx" ON "embed_logs" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_link_prospects_fk" FOREIGN KEY ("link_prospects_id") REFERENCES "public"."link_prospects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_outreach_templates_fk" FOREIGN KEY ("outreach_templates_id") REFERENCES "public"."outreach_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_backlinks_fk" FOREIGN KEY ("backlinks_id") REFERENCES "public"."backlinks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_embed_logs_fk" FOREIGN KEY ("embed_logs_id") REFERENCES "public"."embed_logs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_link_prospects_id_idx" ON "payload_locked_documents_rels" USING btree ("link_prospects_id");
  CREATE INDEX "payload_locked_documents_rels_outreach_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("outreach_templates_id");
  CREATE INDEX "payload_locked_documents_rels_backlinks_id_idx" ON "payload_locked_documents_rels" USING btree ("backlinks_id");
  CREATE INDEX "payload_locked_documents_rels_embed_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("embed_logs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "link_prospects_outreach_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "link_prospects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "outreach_templates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "backlinks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "embed_logs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "link_prospects_outreach_log" CASCADE;
  DROP TABLE "link_prospects" CASCADE;
  DROP TABLE "outreach_templates" CASCADE;
  DROP TABLE "backlinks" CASCADE;
  DROP TABLE "embed_logs" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_link_prospects_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_outreach_templates_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_backlinks_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_embed_logs_fk";
  
  DROP INDEX "payload_locked_documents_rels_link_prospects_id_idx";
  DROP INDEX "payload_locked_documents_rels_outreach_templates_id_idx";
  DROP INDEX "payload_locked_documents_rels_backlinks_id_idx";
  DROP INDEX "payload_locked_documents_rels_embed_logs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "link_prospects_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "outreach_templates_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "backlinks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "embed_logs_id";
  DROP TYPE "public"."enum_link_prospects_outreach_log_direction";
  DROP TYPE "public"."enum_link_prospects_status";
  DROP TYPE "public"."enum_link_prospects_topic_relevance";
  DROP TYPE "public"."enum_outreach_templates_type";
  DROP TYPE "public"."enum_backlinks_link_type";
  DROP TYPE "public"."enum_backlinks_live_status";`)
}
