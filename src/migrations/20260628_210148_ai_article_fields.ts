import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`articles\` ADD \`ai_generated\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`reviewed_by_human\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`ai_image_prompt\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_ai_generated\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_reviewed_by_human\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_ai_image_prompt\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`ai_generated\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`reviewed_by_human\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`ai_image_prompt\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_ai_generated\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_reviewed_by_human\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_ai_image_prompt\`;`)
}
