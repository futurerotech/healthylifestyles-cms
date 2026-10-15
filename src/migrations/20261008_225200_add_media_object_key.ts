import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// The S3 plugin in Payload 3.90 selects _objectkey when loading media. Existing
// databases that predate the upgrade lack this nullable column, breaking media
// reads and every populated article hero image relation.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media"
    ADD COLUMN IF NOT EXISTS "_objectkey" varchar;
  `)
}

// Preserve existing object keys if a migration is rolled back.
export async function down(_args: MigrateDownArgs): Promise<void> {}
