import type { Endpoint, PayloadRequest } from 'payload';
import { computeSchemaFlagDrift, type DriftRow } from '../lib/schemaFlagDrift';

/**
 * Phase 11 P2 — weekly schema-flag reconciliation + email report.
 *
 *   GET /api/audit/schema-flags/cron            (logged-in staff session)
 *   GET /api/audit/schema-flags/cron?key=…      (INTERNAL_API_KEY — external cron)
 *
 * Scheduling: this repo's established pattern (see /backlinks/check) is an
 * EXTERNAL cron hitting an authenticated endpoint — no node-cron dependency,
 * survives process restarts. Point a weekly Hostinger/hPanel cron at this URL
 * (Monday 06:00 UTC → `0 6 * * 1`).
 *
 * Behavior:
 *  - READ-ONLY against content (shared drift lib); logs each run via
 *    payload.logger — no DB writes of any kind.
 *  - Emails via payload.sendEmail — the platform transport. With no email
 *    adapter configured (current prod state) Payload logs the mail to console;
 *    once an adapter is added in payload.config, delivery starts with zero
 *    code change here.
 *  - Emails ONLY when drift > 0. Weekly "all clear" digest is opt-in via
 *    DRIFT_ALLCLEAR_DIGEST=true (default off).
 *  - Recipient from DRIFT_REPORT_EMAIL_TO; without it the report is computed
 *    and logged but nothing is sent (reported in the response).
 *  - Dry-run: DRIFT_REPORT_DRY=1 env (global) or ?dry=1 (per-call) returns the
 *    exact email payload WITHOUT sending.
 *  - Idempotent under overlap: a module-level in-flight latch makes
 *    overlapping invocations no-op with { skipped: true }.
 */

let inFlight = false;

const fmtEmail = (drift: DriftRow[], scanned: number, cmsOrigin: string): { subject: string; text: string } => {
  if (drift.length === 0) {
    return {
      subject: `[HealthyLifeStyles CMS] Schema flags all clear (${scanned} articles)`,
      text:
        `Weekly schema-flag reconciliation: no drift.\n\n` +
        `All ${scanned} published articles have isHowTo/isHealthTopic flags matching the current heuristics.\n`,
    };
  }
  const lines = drift.map(
    (d) =>
      `• "${d.title}" (${d.slug}) — ${d.field}: stored=${d.stored ? 'ON' : 'off'} vs heuristic=${d.heuristic ? 'ON' : 'off'}\n` +
      `    ${d.reading}\n` +
      `    review: ${cmsOrigin}/admin/collections/articles/${d.id}`,
  );
  return {
    subject: `[HealthyLifeStyles CMS] Schema-flag drift: ${drift.length} flag(s) need review`,
    text:
      `Weekly schema-flag reconciliation found drift on ${drift.length} flag(s) ` +
      `across ${scanned} published articles.\n\n` +
      `Drift is a signal, not an error — a mismatch can be a missed flag OR a deliberate editor ` +
      `override, so NOTHING was changed automatically. Review each item and set the flag deliberately:\n\n` +
      `${lines.join('\n\n')}\n`,
  };
};

export const schemaFlagsCron: Endpoint = {
  path: '/audit/schema-flags/cron',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const key = req.searchParams?.get('key') || req.headers.get('x-api-key') || '';
    const keyOk = !!process.env.INTERNAL_API_KEY && key === process.env.INTERNAL_API_KEY;
    if (!req.user && !keyOk) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (inFlight) {
      req.payload.logger.info('[schema-flags-cron] overlapping run skipped (already in flight)');
      return Response.json({ skipped: true, reason: 'already running' });
    }
    inFlight = true;

    try {
      const dry =
        process.env.DRIFT_REPORT_DRY === '1' ||
        process.env.DRIFT_REPORT_DRY === 'true' ||
        req.searchParams?.get('dry') === '1';
      const allClearDigest = process.env.DRIFT_ALLCLEAR_DIGEST === 'true';
      const to = process.env.DRIFT_REPORT_EMAIL_TO || '';
      const cmsOrigin = 'https://cms.healthylifesstyles.com';

      const { scanned, drift } = await computeSchemaFlagDrift(req.payload);
      const shouldSend = drift.length > 0 || allClearDigest;
      const email = fmtEmail(drift, scanned, cmsOrigin);

      let sent = false;
      let sendNote = 'not needed (no drift, digest off)';
      if (shouldSend) {
        if (dry) {
          sendNote = 'dry-run — payload returned, nothing sent';
        } else if (!to) {
          sendNote = 'DRIFT_REPORT_EMAIL_TO not set — computed and logged only';
        } else {
          try {
            await req.payload.sendEmail({ to, subject: email.subject, text: email.text });
            sent = true;
            sendNote = `sent to ${to}`;
          } catch (err) {
            sendNote = `send failed: ${(err as Error).message.slice(0, 120)}`;
          }
        }
      }

      req.payload.logger.info(
        `[schema-flags-cron] run complete — scanned=${scanned} drift=${drift.length} sent=${sent} (${sendNote})`,
      );

      return Response.json({
        scanned,
        driftCount: drift.length,
        sent,
        note: sendNote,
        ...(dry && shouldSend ? { dry: true, email } : dry ? { dry: true } : {}),
      });
    } finally {
      inFlight = false;
    }
  },
};
