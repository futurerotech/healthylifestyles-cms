import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const stmts = [
    sql`ALTER TABLE \`categories\` ADD \`seo_no_index\` integer DEFAULT false;`,
    sql`ALTER TABLE \`_categories_v\` ADD \`version_seo_no_index\` integer DEFAULT false;`,
    sql`ALTER TABLE \`tools\` ADD \`seo_no_index\` integer DEFAULT false;`,
    sql`ALTER TABLE \`_tools_v\` ADD \`version_seo_no_index\` integer DEFAULT false;`,
    sql`ALTER TABLE \`articles\` ADD \`seo_no_index\` integer DEFAULT false;`,
    sql`ALTER TABLE \`_articles_v\` ADD \`version_seo_no_index\` integer DEFAULT false;`,
    sql`ALTER TABLE \`pages\` ADD \`seo_no_index\` integer DEFAULT false;`,
    sql`ALTER TABLE \`_pages_v\` ADD \`version_seo_no_index\` integer DEFAULT false;`,
  ];
  for (const stmt of stmts) {
    try { await db.run(stmt); } catch { /* column may already exist from auto-sync */ }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const stmts = [
    sql`ALTER TABLE \`categories\` DROP COLUMN \`seo_no_index\`;`,
    sql`ALTER TABLE \`_categories_v\` DROP COLUMN \`version_seo_no_index\`;`,
    sql`ALTER TABLE \`tools\` DROP COLUMN \`seo_no_index\`;`,
    sql`ALTER TABLE \`_tools_v\` DROP COLUMN \`version_seo_no_index\`;`,
    sql`ALTER TABLE \`articles\` DROP COLUMN \`seo_no_index\`;`,
    sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_seo_no_index\`;`,
    sql`ALTER TABLE \`pages\` DROP COLUMN \`seo_no_index\`;`,
    sql`ALTER TABLE \`_pages_v\` DROP COLUMN \`version_seo_no_index\`;`,
  ];
  for (const stmt of stmts) {
    try { await db.run(stmt); } catch {}
  }
}
