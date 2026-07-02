import type { Endpoint, PayloadRequest } from 'payload';
import { runSiteAudit } from '../lib/siteAudit';

/**
 * Kick off a site audit. POST /api/audit/run (staff session, or
 * x-api-key/?key= matching INTERNAL_API_KEY for cron use).
 *
 * The scan takes 1–3 minutes, so it runs DETACHED: this endpoint creates a
 * site-audits doc with status "running" and returns its id immediately; the
 * dashboard polls the doc until status flips to complete/failed. Safe on
 * Hostinger because the CMS is a persistent Node server (a background promise
 * survives the response). A second run while one is in flight returns the
 * running audit's id instead of starting another crawl.
 */
export const runAudit: Endpoint = {
  path: '/audit/run',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const key = req.searchParams?.get('key') || req.headers.get('x-api-key') || '';
    const keyOk = !!process.env.INTERNAL_API_KEY && key === process.env.INTERNAL_API_KEY;
    if (!req.user && !keyOk) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const p = req.payload;

    // Reuse an in-flight audit (stale "running" docs older than 15 min are ignored —
    // e.g. a server restart mid-scan leaves one behind).
    const inFlight = await p.find({
      collection: 'site-audits' as never,
      where: { status: { equals: 'running' } } as never,
      limit: 1,
      sort: '-createdAt',
      depth: 0,
    });
    const running = (inFlight as any).docs?.[0];
    if (running && Date.now() - new Date(running.startedAt || running.createdAt).getTime() < 15 * 60 * 1000) {
      return Response.json({ ok: true, id: running.id, reused: true });
    }

    const doc = await p.create({
      collection: 'site-audits' as never,
      data: { status: 'running', startedAt: new Date().toISOString() } as never,
    });
    const id = (doc as any).id;

    void (async () => {
      try {
        const result = await runSiteAudit(p);
        await p.update({
          collection: 'site-audits' as never,
          id,
          data: {
            status: 'complete',
            finishedAt: new Date().toISOString(),
            healthScore: result.healthScore,
            pagesScanned: result.pagesScanned,
            highCount: result.high,
            mediumCount: result.medium,
            lowCount: result.low,
            issues: result.issues,
          } as never,
        });
        p.logger.info(`Site audit ${id} complete: score ${result.healthScore}, ${result.issues.length} issues over ${result.pagesScanned} pages.`);
      } catch (err) {
        const msg = (err as Error)?.message || 'unknown error';
        p.logger.error(`Site audit ${id} failed: ${msg}`);
        try {
          await p.update({
            collection: 'site-audits' as never,
            id,
            data: { status: 'failed', finishedAt: new Date().toISOString(), error: msg.slice(0, 500) } as never,
          });
        } catch {}
      }
    })();

    return Response.json({ ok: true, id });
  },
};
