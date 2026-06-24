import type { Endpoint, PayloadRequest } from 'payload';

const cors = (origin: string) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

/**
 * Public endpoint for n8n to push subscriber data.
 * Accepts a single subscriber or an array of subscribers.
 *
 * POST /api/subscribers/sync
 * Body: { email: string; name?: string; interests?: string[]; source?: string; metadata?: Record<string, unknown> }
 * Or: [{ email: ... }, { email: ... }]
 */
export const subscriberSync: Endpoint = {
  path: '/subscribers/sync',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const origin = req.headers.get('origin') || '';
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const p = req.payload as any;

    try {
      let body: unknown;
      try { body = req.json ? await req.json() : {}; } catch {
        return Response.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400, headers: cors(origin) });
      }

      // Accept single or array
      const items = Array.isArray(body) ? body : [body];
      let imported = 0;
      let duplicates = 0;
      let failed = 0;
      const errors: string[] = [];

      // Fetch n8n config for forwarding
      const audience = await p.findGlobal({ slug: 'audience', depth: 0 });
      const n8nUrl = audience?.n8nWebhookUrl as string | undefined;
      const n8nKey = audience?.n8nApiKey as string | undefined;

      for (const item of items) {
        const email = (item as Record<string, unknown>).email;
        if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          failed++;
          errors.push(`Invalid email: ${String(email || '')}`);
          continue;
        }

        const data: Record<string, unknown> = {
          email: email.toLowerCase().trim(),
          name: (item as Record<string, unknown>).name || undefined,
          interests: (item as Record<string, unknown>).interests || undefined,
          source: (item as Record<string, unknown>).source || 'api',
          metadata: (item as Record<string, unknown>).metadata || undefined,
          subscribedAt: new Date().toISOString(),
        };

        try {
          await p.create({ collection: 'subscribers', data });
          imported++;

          // Forward to n8n on each new subscriber
          if (n8nUrl && audience?.forwardOnCreate) {
            const n8nHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
            if (n8nKey) n8nHeaders['Authorization'] = `Bearer ${n8nKey}`;

            fetch(n8nUrl, {
              method: 'POST',
              headers: n8nHeaders,
              body: JSON.stringify({
                event: 'subscriber.created',
                email: data.email,
                name: data.name,
                interests: data.interests,
                source: data.source,
                subscribedAt: data.subscribedAt,
              }),
            }).catch(() => { /* fire-and-forget */ });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
            duplicates++;
          } else {
            failed++;
            errors.push(`${data.email}: ${msg}`);
          }
        }
      }

      return Response.json({
        ok: true,
        imported,
        duplicates,
        failed,
        total: items.length,
        errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      }, { status: 200, headers: cors(origin) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({ ok: false, message: msg }, { status: 500, headers: cors(origin) });
    }
  },
};
