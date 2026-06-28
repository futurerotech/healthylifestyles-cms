import type { Endpoint, PayloadRequest } from 'payload';

/**
 * Strict CORS allow-list. Echoing `origin || '*'` is the classic
 * reflected-origin anti-pattern — a footgun the moment any credentialed
 * endpoint ships. We hardcode known origins; everyone else gets no ACAO.
 */
const ALLOWED_ORIGINS = new Set<string>([
  process.env.NEXT_PUBLIC_SITE_URL || '',
  'https://www.healthylifesstyles.com',
  'http://localhost:4321',
  'http://localhost:3000',
].filter(Boolean));

const cors = (origin: string) => {
  const base: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-sync-secret',
    'Vary': 'Origin',
  };
  if (ALLOWED_ORIGINS.has(origin)) base['Access-Control-Allow-Origin'] = origin;
  return base;
};

/**
 * Reject SSRF targets: localhost, link-local (cloud metadata IPs), and the
 * private RFC1918 ranges. Allows only http(s):// + public hostnames so an
 * admin can’t turn a webhook URL into an internal-network probe.
 */
function isSafePublicUrl(raw: string | undefined | null): boolean {
  if (!raw) return false;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const h = u.hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h === '169.254.169.254' ||                    // AWS/GCP/Azure metadata
    /^127\./.test(h) ||                            // loopback
    /^10\./.test(h) ||                             // RFC1918
    /^192\.168\./.test(h) ||                       // RFC1918
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(h) ||     // RFC1918
    /^::1$/.test(h) ||                             // IPv6 loopback
    /^fe80::/i.test(h) ||                          // IPv6 link-local
    /^fc00::/i.test(h) || /^fd00::/i.test(h)       // IPv6 ULA
  ) return false;
  return true;
}

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

    // Shared-secret auth. Without this, anyone on the internet could write
    // arbitrary records to the Subscribers collection.
    const sharedSecret = process.env.SYNC_SHARED_SECRET;
    if (!sharedSecret && process.env.NODE_ENV === 'production') {
      return Response.json(
        { ok: false, message: 'Server misconfigured.' },
        { status: 500, headers: cors(origin) },
      );
    }
    if (sharedSecret && req.headers.get('x-sync-secret') !== sharedSecret) {
      return Response.json(
        { ok: false, message: 'Unauthorized.' },
        { status: 401, headers: cors(origin) },
      );
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

      // Fetch n8n config for forwarding. The URL is admin-configurable, so
      // we validate it against the SSRF blocklist before any fetch().
      const audience = await p.findGlobal({ slug: 'audience', depth: 0 });
      const rawN8nUrl = audience?.n8nWebhookUrl as string | undefined;
      const n8nUrl = isSafePublicUrl(rawN8nUrl) ? rawN8nUrl : undefined;
      const n8nKey = audience?.n8nApiKey as string | undefined;
      if (rawN8nUrl && !n8nUrl) {
        console.warn('[subscriberSync] n8nWebhookUrl rejected by SSRF guard:', rawN8nUrl);
      }

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
      // Log server-side, return generic to client (no stack/path leak).
      console.error('[subscriberSync] error:', err);
      return Response.json(
        { ok: false, message: 'Sync failed.' },
        { status: 500, headers: cors(origin) },
      );
    }
  },
};
