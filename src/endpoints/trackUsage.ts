import type { Endpoint, PayloadRequest } from 'payload';

type TrackBody = {
  event: 'start' | 'field' | 'complete' | 'abandon';
  sessionId: string;
  toolId?: string;
  fieldKey?: string;
  totalFields?: number;
  totalFieldsCompleted?: number;
  referrer?: string;
};

/** Lightweight anonymous tracking endpoint for calculator usage.
 *
 *  Three event types flow through the same POST /api/track/usage:
 *    start    → creates a new session record
 *    field    → updates last field reached (debounced on the client)
 *    complete → marks session done, computes duration
 *    abandon  → same as complete without the "completed" flag
 *
 *  Always returns 200 so tracking never disrupts the user experience,
 *  even on error. */
export const trackUsage: Endpoint = {
  path: '/track/usage',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const origin = req.headers.get('origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    let body: TrackBody;
    try {
      body = req.json ? ((await req.json()) as TrackBody) : ({} as TrackBody);
    } catch {
      return Response.json({ ok: true }, { status: 200, headers: cors });
    }

    if (!body.event || !body.sessionId) {
      return Response.json({ ok: true }, { status: 200, headers: cors });
    }

    try {
      const p = req.payload;

      switch (body.event) {
        case 'start': {
          if (!body.toolId) break;
          await p.create({
            collection: 'tool-usage' as never,
            data: {
              tool: body.toolId,
              sessionId: body.sessionId,
              startedAt: new Date().toISOString(),
              totalFields: body.totalFields ?? 0,
              referrer: body.referrer ?? '',
              completed: false,
            } as never,
          });
          break;
        }

        case 'field': {
          const existing = await p.find({
            collection: 'tool-usage' as never,
            where: { sessionId: { equals: body.sessionId } } as never,
            limit: 1,
            depth: 0,
          });
          if ((existing as any).docs?.length) {
            await p.update({
              collection: 'tool-usage' as never,
              id: (existing as any).docs[0].id,
              data: {
                lastFieldReached: body.fieldKey ?? '',
                totalFieldsCompleted: body.totalFieldsCompleted ?? 0,
              } as never,
            });
          }
          break;
        }

        case 'complete':
        case 'abandon': {
          const existing = await p.find({
            collection: 'tool-usage' as never,
            where: { sessionId: { equals: body.sessionId } } as never,
            limit: 1,
            depth: 0,
          });
          if ((existing as any).docs?.length) {
            const record = (existing as any).docs[0];
            const startedAt = new Date(record.startedAt).getTime();
            const now = Date.now();
            await p.update({
              collection: 'tool-usage' as never,
              id: record.id,
              data: {
                ...(body.event === 'complete' ? { completed: true } : {}),
                completedAt: new Date().toISOString(),
                duration: Math.round((now - startedAt) / 1000),
              } as never,
            });
          }
          break;
        }
      }
    } catch (err) {
      req.payload?.logger?.error?.('TrackUsage error: ' + ((err as Error)?.message || 'unknown'));
    }

    return Response.json({ ok: true }, { status: 200, headers: cors });
  },
};
