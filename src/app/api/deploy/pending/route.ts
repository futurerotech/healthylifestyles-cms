import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/deploy/pending — returns the count of pending-deploys.
 *
 * §7.3: Used by the DeployButton admin component to show how many
 * content changes are queued since the last deploy.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const payload = await getPayload({ config });

  // Auth: editor/admin only
  try {
    const { user } = await payload.auth({ headers: req.headers });
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }
    const role = (user as { role?: string }).role;
    if (role !== 'admin' && role !== 'editor') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const result = await payload.find({ collection: 'pending-deploys', limit: 0 });
    return NextResponse.json({ count: result.totalDocs });
  } catch {
    // Table might not exist
    return NextResponse.json({ count: 0 });
  }
}
