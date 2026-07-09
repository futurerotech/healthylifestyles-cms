import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "is_how_to" boolean DEFAULT false;
  ALTER TABLE "articles" ADD COLUMN "is_health_topic" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_is_how_to" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_is_health_topic" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN "is_how_to";
  ALTER TABLE "articles" DROP COLUMN "is_health_topic";
  ALTER TABLE "_articles_v" DROP COLUMN "version_is_how_to";
  ALTER TABLE "_articles_v" DROP COLUMN "version_is_health_topic";`)
}
