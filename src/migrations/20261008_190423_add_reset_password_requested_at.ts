import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Payload 3.90's auth query reads this field. Existing databases created before
// the upgrade do not have it, which breaks the admin login before authentication.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;
  `)
}

// Deliberately preserve auth data on rollback; an extra nullable column is safe
// for older Payload versions and may have existed before this migration ran.
export async function down(_args: MigrateDownArgs): Promise<void> {}
