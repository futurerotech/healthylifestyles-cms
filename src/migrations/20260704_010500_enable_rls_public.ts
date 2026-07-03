import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * SECURITY: enable Row Level Security on EVERY table in the `public` schema,
 * with deliberately NO policies (deny-by-default).
 *
 * Why: Supabase serves `public` over PostgREST (/rest/v1/). With RLS disabled,
 * the anon role could read every table — including users.api_key,
 * push_subscriptions auth keys, and tool_usage.session_id. With RLS enabled
 * and zero policies, anon/authenticated get nothing.
 *
 * Why this can't break Payload: the app connects directly as the `postgres`
 * role, which (verified) both OWNS all public tables and carries the
 * BYPASSRLS attribute — plain ENABLE (not FORCE) never applies to it.
 *
 * Dynamic on purpose: iterates pg_tables so the 144 current tables are all
 * covered without a hard-coded list. NOTE: tables created by FUTURE migrations
 * default to RLS OFF — either re-run this pattern in those migrations or
 * (better) disable the Supabase Data API for `public` entirely; Payload never
 * uses PostgREST.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE t record;
    BEGIN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
      END LOOP;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Deliberate no-op: an automated rollback must never silently re-expose
  // every table over the public REST API. Disable RLS manually if you truly
  // mean to.
}
