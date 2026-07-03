import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tools_risk_level" AS ENUM('low', 'medium', 'high');
  CREATE TYPE "public"."enum__tools_v_version_risk_level" AS ENUM('low', 'medium', 'high');
  ALTER TABLE "tools" ADD COLUMN "risk_level" "enum_tools_risk_level" DEFAULT 'low';
  ALTER TABLE "tools" ADD COLUMN "medical_review_required" boolean DEFAULT false;
  ALTER TABLE "tools" ADD COLUMN "medically_reviewed" boolean DEFAULT false;
  ALTER TABLE "tools" ADD COLUMN "reviewed_by" varchar;
  ALTER TABLE "_tools_v" ADD COLUMN "version_risk_level" "enum__tools_v_version_risk_level" DEFAULT 'low';
  ALTER TABLE "_tools_v" ADD COLUMN "version_medical_review_required" boolean DEFAULT false;
  ALTER TABLE "_tools_v" ADD COLUMN "version_medically_reviewed" boolean DEFAULT false;
  ALTER TABLE "_tools_v" ADD COLUMN "version_reviewed_by" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tools" DROP COLUMN "risk_level";
  ALTER TABLE "tools" DROP COLUMN "medical_review_required";
  ALTER TABLE "tools" DROP COLUMN "medically_reviewed";
  ALTER TABLE "tools" DROP COLUMN "reviewed_by";
  ALTER TABLE "_tools_v" DROP COLUMN "version_risk_level";
  ALTER TABLE "_tools_v" DROP COLUMN "version_medical_review_required";
  ALTER TABLE "_tools_v" DROP COLUMN "version_medically_reviewed";
  ALTER TABLE "_tools_v" DROP COLUMN "version_reviewed_by";
  DROP TYPE "public"."enum_tools_risk_level";
  DROP TYPE "public"."enum__tools_v_version_risk_level";`)
}
