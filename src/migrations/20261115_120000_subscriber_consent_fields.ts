import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Newsletter consent evidence (three nullable columns). Additive only: no existing row
// is read, rewritten or deleted. Existing subscribers keep NULL consent, because their
// consent was never recorded, so they are ineligible for marketing email (fail-closed).
// Prepared offline; it is applied only by an authorized release, never by this branch.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "consent_at" timestamp(3) with time zone;
    ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "consent_notice_version" varchar;
    ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "consent_method" varchar;
  `)
}

// Deliberately preserve consent evidence on rollback. Extra nullable columns are
// harmless to the previous code, and dropping them would destroy the consent record.
export async function down(_args: MigrateDownArgs): Promise<void> {}
