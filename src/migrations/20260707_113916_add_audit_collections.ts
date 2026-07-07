import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_audit_log_type" AS ENUM('meta-description', 'broken-links', 'cannibalization', 'schema', 'full');
  CREATE TYPE "public"."enum_audit_log_status" AS ENUM('pending', 'running', 'completed', 'failed');
  CREATE TYPE "public"."enum_prompt_registry_type" AS ENUM('detector', 'fixer', 'analyzer');
  CREATE TYPE "public"."enum_prompt_registry_model" AS ENUM('gemini-2.0-flash', 'gemini-1.5-flash', 'deepseek-chat');
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"run_id" varchar NOT NULL,
  	"type" "enum_audit_log_type" DEFAULT 'meta-description' NOT NULL,
  	"status" "enum_audit_log_status" DEFAULT 'completed' NOT NULL,
  	"scanned_count" numeric,
  	"issue_count" numeric,
  	"findings" jsonb,
  	"summary" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "prompt_registry" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"type" "enum_prompt_registry_type" NOT NULL,
  	"version" numeric DEFAULT 1 NOT NULL,
  	"active" boolean DEFAULT false,
  	"prompt" varchar NOT NULL,
  	"model" "enum_prompt_registry_model" DEFAULT 'gemini-2.0-flash',
  	"variables" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pending_deploys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"collection_slug" varchar NOT NULL,
  	"doc_id" varchar NOT NULL,
  	"changed_at" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "deploy_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"triggered_by" varchar,
  	"pending_count" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "audit_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "prompt_registry_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pending_deploys_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "deploy_log_id" integer;
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  CREATE INDEX "prompt_registry_slug_idx" ON "prompt_registry" USING btree ("slug");
  CREATE INDEX "prompt_registry_updated_at_idx" ON "prompt_registry" USING btree ("updated_at");
  CREATE INDEX "prompt_registry_created_at_idx" ON "prompt_registry" USING btree ("created_at");
  CREATE INDEX "pending_deploys_updated_at_idx" ON "pending_deploys" USING btree ("updated_at");
  CREATE INDEX "pending_deploys_created_at_idx" ON "pending_deploys" USING btree ("created_at");
  CREATE INDEX "deploy_log_updated_at_idx" ON "deploy_log" USING btree ("updated_at");
  CREATE INDEX "deploy_log_created_at_idx" ON "deploy_log" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_prompt_registry_fk" FOREIGN KEY ("prompt_registry_id") REFERENCES "public"."prompt_registry"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pending_deploys_fk" FOREIGN KEY ("pending_deploys_id") REFERENCES "public"."pending_deploys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_deploy_log_fk" FOREIGN KEY ("deploy_log_id") REFERENCES "public"."deploy_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");
  CREATE INDEX "payload_locked_documents_rels_prompt_registry_id_idx" ON "payload_locked_documents_rels" USING btree ("prompt_registry_id");
  CREATE INDEX "payload_locked_documents_rels_pending_deploys_id_idx" ON "payload_locked_documents_rels" USING btree ("pending_deploys_id");
  CREATE INDEX "payload_locked_documents_rels_deploy_log_id_idx" ON "payload_locked_documents_rels" USING btree ("deploy_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "audit_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "prompt_registry" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pending_deploys" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "deploy_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "audit_log" CASCADE;
  DROP TABLE "prompt_registry" CASCADE;
  DROP TABLE "pending_deploys" CASCADE;
  DROP TABLE "deploy_log" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_prompt_registry_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_pending_deploys_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_deploy_log_fk";
  
  DROP INDEX "payload_locked_documents_rels_audit_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_prompt_registry_id_idx";
  DROP INDEX "payload_locked_documents_rels_pending_deploys_id_idx";
  DROP INDEX "payload_locked_documents_rels_deploy_log_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "audit_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "prompt_registry_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pending_deploys_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "deploy_log_id";
  DROP TYPE "public"."enum_audit_log_type";
  DROP TYPE "public"."enum_audit_log_status";
  DROP TYPE "public"."enum_prompt_registry_type";
  DROP TYPE "public"."enum_prompt_registry_model";`)
}
