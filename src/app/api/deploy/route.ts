import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { PostgresAdapter } from '@payloadcms/db-postgres';
import { reserveManualDeployAttempt } from '@/lib/manual-deploy-reservation';
import { isAllowedOrigin } from '@/lib/allowedOrigins';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/deploy — trigger a manual Vercel deploy.
 *
 * §7.2: Secure server-side deploy endpoint.
 * - Admin-only (Payload session cookie auth).
 * - Debounced: refuses if a deploy was triggered < 5 minutes ago.
 * - Calls VERCEL_DEPLOY_HOOK_URL (server-side only, never exposed to client).
 * - Logs every trigger; pending content is preserved until production is verified and IndexNow accepts it.
 */
export async function POST(req: Request): Promise<NextResponse> {
  // CSRF guard — this endpoint triggers production deploys, so the browser's
  // Origin must be one of OUR origins (shared whitelist: src/lib/allowedOrigins).
  // A MISSING Origin is rejected too: same-origin POSTs always send it, and
  // curl/server-to-server is not a supported path here. payload.auth below
  // stays the primary gate.
  if (!isAllowedOrigin(req.headers.get('origin'))) {
    return NextResponse.json({ error: 'Forbidden: Invalid Origin' }, { status: 403 });
  }

  const payload = await getPayload({ config });

  // Auth: admin only
  let user: { email?: string; role?: string } | null = null;
  try {
    const authResult = await payload.auth({ headers: req.headers });
    user = authResult.user as { email?: string; role?: string } | null;
  } catch {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only.' }, { status: 403 });
  }

  // A missing hook must not create a reservation.
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return NextResponse.json({ error: 'VERCEL_DEPLOY_HOOK_URL is not configured.' }, { status: 503 });
  }

  let pendingCount: number;
  try {
    const reservation = await reserveManualDeployAttempt(
      payload.db as unknown as PostgresAdapter, user.email || null,
    );
    if (reservation.status === 'cooldown') {
      return NextResponse.json({ error: 'A deploy was attempted in the last 5 minutes.' }, { status: 429 });
    }
    pendingCount = reservation.pendingCount;
  } catch {
    return NextResponse.json({ error: 'Cannot reserve deploy attempt; no Vercel request sent.' }, { status: 503 });
  }

  // Call the Vercel deploy hook
  try {
    const res = await fetch(hookUrl, { method: 'POST' });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Vercel hook failed (${res.status} ${res.statusText}).` },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach Vercel: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Do NOT clear pending-deploys here: Vercel accepted a build request, not a successful deployment.
  // An authenticated post-deployment reconciliation explicitly confirms the content manifest
  // and public URLs before submitting any IndexNow notification.

  return NextResponse.json({ ok: true, pendingCount, message: 'Vercel build request accepted; production readiness not yet verified.' });
}