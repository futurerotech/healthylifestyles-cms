import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Newsletter consent evidence (two nullable columns). Additive only: no existing row
// is read, rewritten or deleted, and existing subscribers keep NULL consent, because
// their consent was not recorded at signup. Prepared offline; it is applied only by an
// authorized release, never by this branch.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "consent_at" timestamp(3) with time zone;
    ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "consent_notice_version" varchar;
  `)
}

// Deliberately preserve consent evidence on rollback. Two extra nullable columns are
// harmless to the previous code, and dropping them would destroy the consent record.
export async function down(_args: MigrateDownArgs): Promise<void> {}
