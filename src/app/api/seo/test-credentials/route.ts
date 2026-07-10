import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { loadGoogleCredentials, getGoogleAuth } from '../../../../lib/google-auth';
import { GSC_SITE_URL, SITE_BASE_URL } from '../../../../lib/site-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/seo/test-credentials — GSC credential + property self-diagnosis
 * (Phase 14 hotfix, H-TASK 5).
 *
 * SECURITY (both gates required, in this order):
 *  1. Returns 404 (empty body) unless SEO_DEBUG_ENDPOINTS=true — debug routes
 *     must not exist in normal production. (The empty-body 404 is also
 *     distinguishable from Payload's catch-all JSON 404, which is the
 *     deploy-verification fingerprint.)
 *  2. Requires an authenticated Payload ADMIN session — client_email /
 *     project_id / property lists are reconnaissance data.
 *
 * Beyond the parse check, it proves the WHOLE chain and names the fix:
 *  - sites.list(): every property this service account can actually access
 *    (siteUrl + permissionLevel) and whether the configured GSC_SITE_URL
 *    matches one byte-for-byte — this resolves the sc-domain-vs-URL-prefix
 *    ambiguity definitively at runtime.
 *  - a real urlInspection.index.inspect() on the homepage → inspect_ok.
 *
 * Never returns or logs private_key material.
 */
export async function GET(req: Request): Promise<NextResponse> {
  if (process.env.SEO_DEBUG_ENDPOINTS !== 'true') {
    return new NextResponse(null, { status: 404 });
  }

  const payload = await getPayload({ config });
  try {
    const { user } = await payload.auth({ headers: req.headers });
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    if ((user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admin only.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const creds = loadGoogleCredentials();

    const { google } = await import('googleapis');
    const auth = await getGoogleAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // Which properties can this service account ACTUALLY see?
    let properties: { siteUrl: string; permissionLevel: string }[] = [];
    let sitesError: string | null = null;
    try {
      const sites = await searchconsole.sites.list();
      properties = (sites.data.siteEntry || []).map((s) => ({
        siteUrl: s.siteUrl || '',
        permissionLevel: s.permissionLevel || '',
      }));
    } catch (err) {
      sitesError = err instanceof Error ? err.message : 'sites.list failed';
    }
    const propertyMatch = properties.some((p) => p.siteUrl === GSC_SITE_URL);

    // End-to-end proof: a real inspection of the homepage.
    let inspectOk = false;
    let inspectError: string | null = null;
    try {
      const homepage = `${SITE_BASE_URL}/`;
      await searchconsole.urlInspection.index.inspect({
        requestBody: { inspectionUrl: homepage, siteUrl: GSC_SITE_URL },
      });
      inspectOk = true;
    } catch (err) {
      inspectError = err instanceof Error ? err.message : 'inspect failed';
    }

    return NextResponse.json({
      ok: true,
      client_email: creds.client_email,
      project_id: creds.project_id,
      has_key: Boolean(creds.private_key),
      gsc_site_url: GSC_SITE_URL,
      property_match: propertyMatch,
      properties,
      ...(sitesError ? { sites_error: sitesError } : {}),
      inspect_ok: inspectOk,
      ...(inspectError ? { inspect_error: inspectError } : {}),
    });
  } catch (err) {
    // ConfigError messages are remediation text by design — no key material.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'credential check failed' },
      { status: 500 },
    );
  }
}
