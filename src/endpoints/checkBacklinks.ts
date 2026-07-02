import type { Endpoint, PayloadRequest } from 'payload';

/**
 * Backlink live-checker. Fetches each backlink's source page and confirms a
 * link to our domain is still present, updating liveStatus + lastCheckedAt.
 *
 *   GET /api/backlinks/check            (logged-in staff session)
 *   GET /api/backlinks/check?key=…      (INTERNAL_API_KEY — for external cron)
 *
 * Checks the least-recently-checked 20 links per call, oldest first, so an
 * hourly/daily cron naturally rotates through the whole set. Network errors
 * leave liveStatus untouched (a flaky host must not mark a link "lost");
 * only a successful fetch WITHOUT our domain in the HTML marks it lost.
 */

const OUR_DOMAIN = 'healthylifesstyles.com';
const BATCH = 20;
const FETCH_TIMEOUT_MS = 8000;

export const checkBacklinks: Endpoint = {
  path: '/backlinks/check',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const key = req.searchParams?.get('key') || req.headers.get('x-api-key') || '';
    const keyOk = !!process.env.INTERNAL_API_KEY && key === process.env.INTERNAL_API_KEY;
    if (!req.user && !keyOk) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const p = req.payload;
    const { docs } = await p.find({
      collection: 'backlinks' as never,
      limit: BATCH,
      sort: 'lastCheckedAt',
      depth: 0,
    });

    let live = 0;
    let lost = 0;
    let errors = 0;

    for (const doc of docs as any[]) {
      const now = new Date().toISOString();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(doc.sourceUrl, {
          signal: controller.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'HealthyLifeStyles-LinkCheck/1.0 (+https://www.healthylifesstyles.com)' },
        });
        clearTimeout(timer);

        if (res.status === 404 || res.status === 410) {
          lost++;
          await p.update({ collection: 'backlinks' as never, id: doc.id, data: { liveStatus: 'lost', lastCheckedAt: now } as never });
          continue;
        }
        if (!res.ok) {
          // 5xx / 403 etc. — inconclusive; do not flip status.
          errors++;
          await p.update({ collection: 'backlinks' as never, id: doc.id, data: { lastCheckedAt: now } as never });
          continue;
        }

        const html = (await res.text()).toLowerCase();
        const found = html.includes(OUR_DOMAIN);
        if (found) live++;
        else lost++;
        await p.update({
          collection: 'backlinks' as never,
          id: doc.id,
          data: { liveStatus: found ? 'live' : 'lost', lastCheckedAt: now } as never,
        });
      } catch (err) {
        // Timeout / DNS / network — inconclusive; keep current status.
        errors++;
        try {
          await p.update({ collection: 'backlinks' as never, id: doc.id, data: { lastCheckedAt: now } as never });
        } catch {}
        p.logger?.warn?.(`backlink check failed for ${doc.sourceUrl}: ${(err as Error)?.message || 'unknown'}`);
      }
    }

    return Response.json({ ok: true, checked: (docs as any[]).length, live, lost, inconclusive: errors });
  },
};
