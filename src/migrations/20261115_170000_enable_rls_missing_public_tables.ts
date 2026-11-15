import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Row-level-security parity. Read-only inspection on 2026-11-15 found that production
// (holy-sea-80468476) has RLS enabled on every public table, but staging
// (small-hall-15225012) had 13 tables without it. All 13 were created by migrations after
// 20260704_010500_enable_rls_public, and neither database has the auto-enable event
// trigger, so new tables are not covered automatically.
// This migration enables RLS on any public table that lacks it. It is idempotent and a
// no-op where RLS is already on (production today). Table owners, including the Payload
// runtime role, are not subject to RLS without FORCE, so the application is unaffected.
// Prepared offline. It is applied only by an authorized release or staging deployment.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE t record;
    BEGIN
      FOR t IN
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
      LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
      END LOOP;
    END $$;
  `)
}

// Deliberately keep RLS on when rolling back. Disabling a security control is never an
// automatic rollback step, and the previous code does not depend on RLS being off.
export async function down(_args: MigrateDownArgs): Promise<void> {}
