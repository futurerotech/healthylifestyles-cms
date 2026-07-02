import type { Endpoint, PayloadRequest } from 'payload';

/**
 * Embed-load tracker. The /embed/[slug] page on the Astro site fires a
 * fire-and-forget POST here with its document.referrer (= the page embedding
 * the iframe). We upsert one embed-logs row per (toolSlug, referrerHost) so the
 * Link Building dashboard can show who's embedding which calculator.
 *
 * Always returns 200 — tracking must never break an embed. Self-referrals and
 * empty referrers are ignored.
 */

const OWN_HOSTS = /(^|\.)healthylifesstyles\.com$|^localhost$|^127\.0\.0\.1$/i;

export const trackEmbed: Endpoint = {
  path: '/track/embed',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    // Embeds live on arbitrary third-party origins — CORS must be open.
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      const body = req.json ? ((await req.json()) as { toolSlug?: string; referrer?: string }) : {};
      const toolSlug = (body.toolSlug || '').slice(0, 200).trim();
      const referrer = (body.referrer || '').slice(0, 1000).trim();
      if (!toolSlug || !referrer) return Response.json({ ok: true }, { status: 200, headers: cors });

      let host = '';
      try {
        host = new URL(referrer).hostname.toLowerCase();
      } catch {
        return Response.json({ ok: true }, { status: 200, headers: cors });
      }
      if (!host || OWN_HOSTS.test(host)) return Response.json({ ok: true }, { status: 200, headers: cors });

      const p = req.payload;
      const existing = await p.find({
        collection: 'embed-logs' as never,
        where: { and: [{ toolSlug: { equals: toolSlug } }, { referrerHost: { equals: host } }] } as never,
        limit: 1,
        depth: 0,
      });

      if ((existing as any).docs?.length) {
        const doc = (existing as any).docs[0];
        await p.update({
          collection: 'embed-logs' as never,
          id: doc.id,
          data: { count: (doc.count || 0) + 1, lastSeenAt: new Date().toISOString(), referrerUrl: referrer } as never,
        });
      } else {
        await p.create({
          collection: 'embed-logs' as never,
          data: { toolSlug, referrerHost: host, referrerUrl: referrer, count: 1, lastSeenAt: new Date().toISOString() } as never,
        });
      }
    } catch (err) {
      req.payload?.logger?.error?.('trackEmbed error: ' + ((err as Error)?.message || 'unknown'));
    }

    return Response.json({ ok: true }, { status: 200, headers: cors });
  },
};
