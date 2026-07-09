import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { isAllowedOrigin } from '@/lib/allowedOrigins';
import { computeSchemaFlagDrift } from '@/lib/schemaFlagDrift';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/audit/schema-flags/report — READ-ONLY schema-flag drift report for
 * the admin dashboard panel (Phase 11 P1). Computes drift on demand via the
 * shared lib (nothing is persisted, nothing is written).
 *
 * Auth: admin only (payload.auth). Origin policy: a PRESENT-but-unlisted
 * Origin is rejected; a MISSING Origin is allowed — browsers omit Origin on
 * same-origin GETs (the panel's own fetch), this route has no side effects,
 * and payload.auth remains the primary gate.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const origin = req.headers.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    return NextResponse.json({ error: 'Forbidden: Invalid Origin' }, { status: 403 });
  }

  const payload = await getPayload({ config });

  let role: string | undefined;
  try {
    const { user } = await payload.auth({ headers: req.headers });
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    role = (user as { role?: string }).role;
  } catch {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only.' }, { status: 403 });
  }

  const { scanned, drift } = await computeSchemaFlagDrift(payload);
  return NextResponse.json({ scanned, driftCount: drift.length, drift });
}
