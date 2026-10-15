import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/** Refuse duplicate data; never delete or rename content to force an index through. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of ['articles', 'tools', 'pages', 'authors', 'tags']) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        IF EXISTS (SELECT slug FROM "${table}" WHERE slug IS NOT NULL GROUP BY slug HAVING count(*) > 1) THEN
          RAISE EXCEPTION 'Duplicate slugs in ${table}; review content before running this migration.';
        END IF;
      END $$;
      DROP INDEX IF EXISTS "${table}_slug_idx";
      CREATE UNIQUE INDEX "${table}_slug_idx" ON "${table}" (slug);
    `));
  }
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS categories_kind_slug_idx ON categories (kind, slug);
  `);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Keep uniqueness on rollback; dropping it would reintroduce ambiguous URLs.
}
