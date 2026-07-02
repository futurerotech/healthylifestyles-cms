import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_audits_status" AS ENUM('running', 'complete', 'failed');
  CREATE TABLE "site_audits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_site_audits_status" DEFAULT 'running' NOT NULL,
  	"health_score" numeric,
  	"pages_scanned" numeric,
  	"high_count" numeric,
  	"medium_count" numeric,
  	"low_count" numeric,
  	"started_at" timestamp(3) with time zone,
  	"finished_at" timestamp(3) with time zone,
  	"error" varchar,
  	"issues" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "site_audits_id" integer;
  CREATE INDEX "site_audits_status_idx" ON "site_audits" USING btree ("status");
  CREATE INDEX "site_audits_updated_at_idx" ON "site_audits" USING btree ("updated_at");
  CREATE INDEX "site_audits_created_at_idx" ON "site_audits" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_audits_fk" FOREIGN KEY ("site_audits_id") REFERENCES "public"."site_audits"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_site_audits_id_idx" ON "payload_locked_documents_rels" USING btree ("site_audits_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_audits" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "site_audits" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_site_audits_fk";
  
  DROP INDEX "payload_locked_documents_rels_site_audits_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "site_audits_id";
  DROP TYPE "public"."enum_site_audits_status";`)
}
