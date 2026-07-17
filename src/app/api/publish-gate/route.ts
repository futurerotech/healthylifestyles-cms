import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { runPublishGate } from '@/lib/publishGate';
import { buildGateContext } from '@/hooks/publishGateHook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/publish-gate?id=<articleId> — full gate results (blocks + warns)
 * for the editor sidebar (PublishGatePanel). Staff-only, read-only. Uses the
 * DRAFT state so the panel reflects what the editor is actually working on.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const payload = await getPayload({ config });

  let user: { role?: string } | null = null;
  try {
    user = (await payload.auth({ headers: req.headers })).user as { role?: string } | null;
  } catch {
    /* fall through to 401 */
  }
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ?id.' }, { status: 400 });

  try {
    const doc = (await payload.findByID({ collection: 'articles', id, depth: 0, draft: true })) as unknown as Record<string, unknown>;
    const heroImage = doc.heroImage as number | { id?: number } | null | undefined;
    const heroId = typeof heroImage === 'object' && heroImage !== null ? heroImage.id : heroImage;
    const ctx = await buildGateContext(payload as never, heroId ?? null);
    const result = runPublishGate(doc as never, ctx);
    return NextResponse.json({ ...result, checkedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
