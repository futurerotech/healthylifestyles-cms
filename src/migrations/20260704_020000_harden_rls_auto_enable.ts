import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * SECURITY: harden public.rls_auto_enable() — the event-trigger function
 * (ensure_rls, ddl_command_end) that auto-enables RLS on newly created public
 * tables. It shipped with Postgres' default EXECUTE grant to PUBLIC (so
 * anon/authenticated could target it via /rest/v1/rpc) and SECURITY DEFINER.
 *
 * Kept (it closes the "future tables default to RLS off" gap) but:
 *  - EXECUTE revoked from PUBLIC/anon/authenticated/service_role — event
 *    triggers fire internally and never check EXECUTE, so nothing breaks.
 *  - Switched to SECURITY INVOKER — DDL here only ever runs as `postgres`
 *    (Payload migrations, dashboard SQL), which owns the tables, so the
 *    trigger still works while removing the definer-escalation surface.
 *
 * (Functions returning `event_trigger` can't be called directly anyway —
 * Postgres rejects them outside trigger context — so this is defense-in-depth
 * per the linter, not an actively exploitable hole.)
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
      ) THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM service_role;
        ALTER FUNCTION public.rls_auto_enable() SECURITY INVOKER;
      END IF;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Deliberate no-op — never re-grant EXECUTE to anonymous roles on rollback.
}
