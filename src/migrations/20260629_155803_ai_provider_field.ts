import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`articles\` ADD \`ai_provider\` text DEFAULT 'gemini';`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_ai_provider\` text DEFAULT 'gemini';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`ai_provider\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_ai_provider\`;`)
}
