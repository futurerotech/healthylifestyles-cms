import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/deploy — trigger a manual Vercel deploy.
 *
 * §7.2: Secure server-side deploy endpoint.
 * - Admin-only (Payload session cookie auth).
 * - Debounced: refuses if a deploy was triggered < 5 minutes ago.
 * - Calls VERCEL_DEPLOY_HOOK_URL (server-side only, never exposed to client).
 * - Logs every trigger to deploy-log and clears the pending-deploys queue.
 */
export async function POST(req: Request): Promise<NextResponse> {
  // الحماية ضد هجمات CSRF (التحقق من مصدر الطلب)
  const origin = req.headers.get('origin');
  const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  
  if (origin && origin !== allowedOrigin) {
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

  // Debounce: check if a deploy was triggered < 5 minutes ago
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  try {
    const recent = await payload.find({
      collection: 'deploy-log',
      where: { createdAt: { greater_than: fiveMinAgo } },
      limit: 1,
    });
    if (recent.totalDocs > 0) {
      return NextResponse.json(
        { error: 'A deploy was triggered in the last 5 minutes. Please wait before trying again.' },
        { status: 429 },
      );
    }
  } catch {
    // deploy-log table might not exist yet — continue
  }

  // Count pending changes before clearing
  let pendingCount = 0;
  try {
    const pending = await payload.find({ collection: 'pending-deploys', limit: 0 });
    pendingCount = pending.totalDocs;
  } catch {
    // pending-deploys table might not exist yet
  }

  // Call the Vercel deploy hook
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return NextResponse.json(
      { error: 'VERCEL_DEPLOY_HOOK_URL is not configured. Set it in the server environment.' },
      { status: 503 },
    );
  }

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

  // Log the deploy
  try {
    await payload.create({
      collection: 'deploy-log',
      data: {
        triggeredBy: user.email || 'unknown',
        pendingCount,
      },
    });
  } catch {
    // non-fatal if deploy-log table is missing
  }

  // Clear the pending-deploys queue in one bulk delete (no 500-row cap, so a
  // large backlog fully drains). Non-fatal: the deploy already fired, and a
  // leftover queue entry only means the next deploy shows a stale count.
  if (pendingCount > 0) {
    try {
      await payload.delete({ collection: 'pending-deploys', where: { id: { exists: true } } });
    } catch {
      // non-fatal
    }
  }

  return NextResponse.json({ ok: true, pendingCount });
}