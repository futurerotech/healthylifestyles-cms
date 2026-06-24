import type { Endpoint, PayloadRequest } from 'payload';
import { summarizeUsage, evaluatePersonas } from '../lib/segmentation';

/* ---------------------------------------------------------------------------
 * Public profile endpoints — no auth required (these are anonymous users).
 *
 * POST /api/profile/identify
 *   { profileId?: string }
 *   → Creates or retrieves a profile. If profileId is provided and exists,
 *     returns it. Otherwise creates a new profile with a new UUID.
 *
 * POST /api/profile/record-usage
 *   { profileId, toolId, action: 'start' | 'complete' }
 *   → Records tool usage, updates profile's persona assignment.
 *
 * GET /api/profile/{profileId}
 *   → Returns the profile with computed personas.
 * ------------------------------------------------------------------------- */

const cors = (origin: string) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ── Identify (create-or-retrieve) ─────────────────────────────────────── */

export const profileIdentify: Endpoint = {
  path: '/profile/identify',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const origin = req.headers.get('origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

    let body: { profileId?: string };
    try { body = req.json ? ((await req.json()) as { profileId?: string }) : {}; } catch {
      return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: cors(origin) });
    }

    const p = req.payload;

    /* If profileId provided, try to find existing */
    if (body.profileId) {
      const existing = await p.find({
        collection: 'profiles' as never,
        where: { profileId: { equals: body.profileId } } as never,
        limit: 1,
        depth: 0,
      });

      if ((existing as any).docs?.length) {
        return Response.json({
          ok: true,
          profile: (existing as any).docs[0],
          isNew: false,
        }, { headers: cors(origin) });
      }
    }

    /* Create new profile */
    const profileId = body.profileId || uuid();
    const created = await p.create({
      collection: 'profiles' as never,
      data: {
        profileId,
        personas: [],
        toolUsageCount: 0,
        lastActiveAt: new Date().toISOString(),
      } as never,
    });

    return Response.json({
      ok: true,
      profile: created,
      isNew: true,
    }, { status: 201, headers: cors(origin) });
  },
};

/* ── Record usage + recompute personas ─────────────────────────────────── */

export const profileRecordUsage: Endpoint = {
  path: '/profile/record-usage',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const origin = req.headers.get('origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

    let body: { profileId?: string; toolId?: string; action?: string };
    try { body = req.json ? ((await req.json()) as typeof body) : {}; } catch {
      return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: cors(origin) });
    }

    if (!body.profileId || !body.toolId) {
      return Response.json({ ok: false, error: 'Missing profileId or toolId' }, { status: 400, headers: cors(origin) });
    }

    const p = req.payload;

    /* Find or create profile */
    const existing = await p.find({
      collection: 'profiles' as never,
      where: { profileId: { equals: body.profileId } } as never,
      limit: 1,
      depth: 0,
    });

    let profile: any;
    if ((existing as any).docs?.length) {
      profile = (existing as any).docs[0];
    } else {
      profile = await p.create({
        collection: 'profiles' as never,
        data: {
          profileId: body.profileId,
          personas: [],
          toolUsageCount: 0,
          lastActiveAt: new Date().toISOString(),
        } as never,
      });
    }

    /* Record a usage session */
    const sessionId = uuid();
    const now = new Date().toISOString();

    await p.create({
      collection: 'tool-usage' as never,
      data: {
        tool: body.toolId,
        sessionId,
        profile: profile.id,
        startedAt: now,
        completed: body.action === 'complete',
        ...(body.action === 'complete' ? { completedAt: now, duration: 0 } : {}),
      } as never,
    });

    /* Recompute personas */
    const newPersonas = await recomputeProfilePersonas(p, profile.id);

    /* Update profile */
    const updated = await p.update({
      collection: 'profiles' as never,
      id: profile.id,
      data: {
        personas: newPersonas,
        toolUsageCount: ((profile as any).toolUsageCount || 0) + 1,
        lastActiveAt: now,
      } as never,
    });

    return Response.json({
      ok: true,
      profile: updated,
      personas: newPersonas,
    }, { headers: cors(origin) });
  },
};

/* ── Get profile by profileId ──────────────────────────────────────────── */

export const profileGet: Endpoint = {
  path: '/profile/:id',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const origin = req.headers.get('origin') || '';
    const profileId = req.routeParams?.id as string;
    if (!profileId) {
      return Response.json({ ok: false, error: 'Missing profile ID' }, { status: 400, headers: cors(origin) });
    }

    const p = req.payload;
    const existing = await p.find({
      collection: 'profiles' as never,
      where: { profileId: { equals: profileId } } as never,
      limit: 1,
      depth: 1,
    });

    if (!(existing as any).docs?.length) {
      return Response.json({ ok: false, error: 'Profile not found' }, { status: 404, headers: cors(origin) });
    }

    return Response.json({
      ok: true,
      profile: (existing as any).docs[0],
    }, { headers: cors(origin) });
  },
};

/* ── Recompute personas for a profile ──────────────────────────────────── */

async function recomputeProfilePersonas(
  payload: any,
  profileId: number | string,
): Promise<number[]> {
  /* Fetch all usage records for this profile */
  const usages = await payload.find({
    collection: 'tool-usage' as never,
    where: { profile: { equals: profileId } } as never,
    limit: 10000,
    depth: 1,
  });

  const usageDocs: any[] = (usages as any)?.docs || [];
  if (usageDocs.length === 0) return [];

  /* Fetch all active persona definitions */
  const personasResult = await payload.find({
    collection: 'personas' as never,
    where: { enabled: { equals: true } } as never,
    limit: 100,
    depth: 1,
  });

  const personaDefs: any[] = (personasResult as any)?.docs || [];
  if (personaDefs.length === 0) return [];

  /* Compute usage summary */
  const summary = summarizeUsage(usageDocs.map((u) => ({
    tool: typeof u.tool === 'object' ? { id: u.tool.id, category: u.tool.category } : u.tool,
  })));

  /* Evaluate personas */
  const assigned = evaluatePersonas(summary, personaDefs.map((pd) => ({
    id: pd.id,
    name: pd.name,
    slug: pd.slug,
    rules: (pd.rules || []).map((r: any) => ({
      matchType: r.matchType,
      tool: typeof r.tool === 'object' ? r.tool.id : r.tool,
      category: typeof r.category === 'object' ? r.category.id : r.category,
      minUsage: r.minUsage ?? 1,
    })),
  })));

  /* Update persona profile counts */
  for (const def of personaDefs) {
    const shouldHave = assigned.includes(def.id);
    const currentlyHas = (def.profilesCount || 0) > 0;

    /* We won't do precise counting here to avoid N+1 queries.
     * The profilesCount is maintained by a separate nightly/scheduled job. */
    if (!currentlyHas && shouldHave) {
      await payload.update({
        collection: 'personas' as never,
        id: def.id,
        data: { profilesCount: (def.profilesCount || 0) + 1 } as never,
      });
    }
  }

  return assigned.map((id) => Number(id));
}
