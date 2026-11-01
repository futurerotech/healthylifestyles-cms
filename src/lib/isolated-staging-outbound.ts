/**
 * Real Hostinger staging must NEVER perform production-facing outbound sends.
 *
 * Reusable handler guard for APIs which send push notifications, synchronize
 * subscriber details to third parties or use external AI services.
 *
 * This gate applies only when HLS_ISOLATED_STAGING=true; normal CMS behavior
 * remains unchanged. A separate startup guard verifies isolated DB/R2 origins.
 */
export function denyIsolatedStagingOutbound(): Response | null {
  if (process.env.HLS_ISOLATED_STAGING !== 'true') return null;
  return Response.json(
    { ok: false, error: 'External integration disabled in isolated staging.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
