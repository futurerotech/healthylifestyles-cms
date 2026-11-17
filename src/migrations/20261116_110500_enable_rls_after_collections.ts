import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Restore the established public-table RLS baseline after the later collection
 * migrations. The first catch-all (20260704_010500) ran before 13 new public
 * tables were created; on a standalone PostgreSQL installation the optional
 * auto-enable event trigger does not exist.
 *
 * Idempotent: only ordinary/partitioned public tables with RLS OFF are changed.
 * No policies or FORCE RLS are added. PostgreSQL owners/BYPASSRLS roles retain
 * their normal bypass behavior. Review application roles before production use.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $hls_rls$
    DECLARE target record;
    BEGIN
      FOR target IN
        SELECT n.nspname AS schema_name, c.relname AS table_name
        FROM pg_catalog.pg_class AS c
        JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND NOT c.relrowsecurity
        ORDER BY c.relname
      LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
                       target.schema_name, target.table_name);
      END LOOP;
    END
    $hls_rls$;
  `)
}

/** Never silently disable RLS during rollback. */
export async function down(_args: MigrateDownArgs): Promise<void> {}
