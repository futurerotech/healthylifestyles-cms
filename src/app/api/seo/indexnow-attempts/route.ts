import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import config from '@payload-config';
import { isAllowedIndexNowPreviewOrigin, ISOLATED_STAGING_CMS_ORIGIN } from '@/lib/allowedOrigins';
import { authorizeIndexNowRetry, cancelReservedIndexNowAttempt } from '@/lib/indexnow-attempts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Admin-only read/review. Never invokes the provider or clears the queue. */
export async function POST(req: Request): Promise<NextResponse> {
  if (!isAllowedIndexNowPreviewOrigin(req.headers.get('origin'))) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers }).catch(() => ({ user: null }));
  if (!user || (user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Admin login required' }, { status: 403 });
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 });
  const input = body as Record<string, unknown>;
  const db = payload.db as unknown as PostgresAdapter;
  try {
    if (input.action === 'list') {
      const result = await db.execute({ drizzle: db.drizzle as Parameters<PostgresAdapter['execute']>[0]['drizzle'], sql: sql`
        SELECT a.id, a.state, a.provider_status, a.approved_build, a.created_at,
          coalesce((SELECT json_agg(json_build_object('decision', r.decision, 'reasonCode', r.reason_code, 'actorId', r.actor_id,
            'createdAt', r.created_at) ORDER BY r.created_at) FROM indexnow_attempt_reviews r WHERE r.attempt_id = a.id), '[]'::json) AS reviews,
          coalesce(json_agg(json_build_object('id', i.pending_id, 'changedAt', i.changed_at,
            'url', i.url, 'current', (p.id IS NOT NULL AND p.changed_at = i.changed_at)) ORDER BY i.pending_id)
            FILTER (WHERE i.pending_id IS NOT NULL), '[]'::json) AS items
        FROM indexnow_attempts a JOIN indexnow_attempt_items i ON i.attempt_id = a.id
        LEFT JOIN pending_deploys p ON p.id = i.pending_id
        GROUP BY a.id ORDER BY a.created_at DESC LIMIT 100
      ` });
      return NextResponse.json({ attempts: result.rows });
    }
    if (ISOLATED_STAGING_CMS_ORIGIN) return NextResponse.json({ error: 'Action unavailable' }, { status: 403 });
    if (input.action === 'cancel_reserved') {
      if (typeof input.attemptId !== 'string' || input.confirm !== true) return NextResponse.json({ error: 'Explicit confirmation required' }, { status: 400 });
      const cancelled = await cancelReservedIndexNowAttempt(db, input.attemptId, String(user.id));
      if (!cancelled) return NextResponse.json({ error: 'Attempt is no longer reserved; review its current state.' }, { status: 409 });
      return NextResponse.json({ ok: true, message: 'Unsent reservation cancelled; run a fresh preview.' });
    }
    if (input.action !== 'authorize_retry' && input.action !== 'resolve_changed') return NextResponse.json({ error: 'Action unavailable' }, { status: 403 });
    if (typeof input.attemptId !== 'string' || input.confirmRisk !== true || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20 ||
        !input.items.every(x => x && typeof x === 'object' && !Array.isArray(x) &&
          (typeof x.id === 'string' || typeof x.id === 'number') && typeof x.changedAt === 'string' && typeof x.url === 'string')) {
      return NextResponse.json({ error: 'Exact reviewed snapshot and explicit risk confirmation required' }, { status: 400 });
    }
    const result = await authorizeIndexNowRetry(db, { attemptId: input.attemptId, actorId: String(user.id),
      confirmRisk: true, resolveChanged: input.action === 'resolve_changed', items: input.items as { id: string | number; changedAt: string; url: string }[] });
    if (result !== 'authorized') return NextResponse.json({ error: result === 'stale'
      ? 'Snapshot or queued revision changed; review again.'
      : 'Attempt is not reviewable; an in-flight attempt requires separately verified recovery.' }, { status: 409 });
    return NextResponse.json({ ok: true, message: input.action === 'resolve_changed'
      ? 'Old attempt reviewed; changed pending entries remain. Run a fresh preview.'
      : 'Retry authorized for review only; run a fresh preview before any new submission.' });
  } catch {
    return NextResponse.json({ error: 'Attempt review unavailable; no retry was authorized.' }, { status: 503 });
  }
}
