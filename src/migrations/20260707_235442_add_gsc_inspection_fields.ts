import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_indexing_status_engine" ADD VALUE 'gsc-inspection';
  ALTER TABLE "indexing_status" ADD COLUMN "verdict" varchar;
  ALTER TABLE "indexing_status" ADD COLUMN "coverage_state" varchar;
  ALTER TABLE "indexing_status" ADD COLUMN "last_crawled" varchar;
  ALTER TABLE "indexing_status" ADD COLUMN "canonical_google" varchar;
  ALTER TABLE "indexing_status" ADD COLUMN "canonical_declared" varchar;
  ALTER TABLE "indexing_status" ADD COLUMN "inspected_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "indexing_status" ALTER COLUMN "engine" SET DATA TYPE text;
  DROP TYPE "public"."enum_indexing_status_engine";
  CREATE TYPE "public"."enum_indexing_status_engine" AS ENUM('https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow', 'https://search.yandex.com/indexnow', 'google');
  ALTER TABLE "indexing_status" ALTER COLUMN "engine" SET DATA TYPE "public"."enum_indexing_status_engine" USING "engine"::"public"."enum_indexing_status_engine";
  ALTER TABLE "indexing_status" DROP COLUMN "verdict";
  ALTER TABLE "indexing_status" DROP COLUMN "coverage_state";
  ALTER TABLE "indexing_status" DROP COLUMN "last_crawled";
  ALTER TABLE "indexing_status" DROP COLUMN "canonical_google";
  ALTER TABLE "indexing_status" DROP COLUMN "canonical_declared";
  ALTER TABLE "indexing_status" DROP COLUMN "inspected_at";`)
}
