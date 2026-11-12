import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres';

/** Additive only. An unresolved send remains an audit record across restarts. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS indexnow_attempts (
      id uuid PRIMARY KEY,
      state text NOT NULL CHECK (state IN ('reserved', 'in_flight', 'not_sent', 'unknown', 'pending', 'rejected', 'received', 'acknowledged', 'retry_authorized', 'resolved_changed')),
      approved_build text NOT NULL,
      provider_status integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      actor_id text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS indexnow_attempt_items (
      attempt_id uuid NOT NULL REFERENCES indexnow_attempts(id),
      pending_id integer NOT NULL,
      changed_at text NOT NULL,
      url text NOT NULL,
      PRIMARY KEY (attempt_id, pending_id)
    );
    CREATE INDEX IF NOT EXISTS indexnow_attempt_items_pending_idx ON indexnow_attempt_items(pending_id);
    CREATE TABLE IF NOT EXISTS indexnow_attempt_reviews (
      id uuid PRIMARY KEY,
      attempt_id uuid NOT NULL REFERENCES indexnow_attempts(id),
      actor_id text NOT NULL,
      decision text NOT NULL CHECK (decision IN ('authorize_retry', 'cancel_reserved', 'resolve_changed')),
      reason_code text NOT NULL CHECK (reason_code IN ('dispatch_not_started', 'content_changed', 'provider_rejected', 'reviewed_duplicate_risk')),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE indexnow_attempts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE indexnow_attempt_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE indexnow_attempt_reviews ENABLE ROW LEVEL SECURITY;
  `);
}

// Never drop audit records during a rollback; a separately approved recovery
// procedure is required to remove them.
export async function down(_args: MigrateDownArgs): Promise<void> {}
