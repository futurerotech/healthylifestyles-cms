import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { isAllowedOrigin } from '@/lib/allowedOrigins';
import { SITE_BASE_URL } from '@/lib/site-config';
import { selectPublishedProof, verifyDeployedHtml, matchesApprovedIndexNowSnapshot } from '@/lib/indexnow-postdeploy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manual admin-only reconciliation: safe to run after Vercel reports Production Ready.
// Never submits drafts, noncanonical URLs, or a CMS change absent from deployed manifest.
// For the first release the operator must opt into actual submission (confirm=true).
// No new secrets, schema changes, background jobs, or automatic production writes.
export async function POST(req: Request): Promise<NextResponse> {
  if (!isAllowedOrigin(req.headers.get('origin'))) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers }).catch(() => ({ user: null }));
  if (!user || (user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Admin login required' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({})) as { confirm?: boolean; approvedUrls?: unknown; approvedVersions?: unknown; approvedBuildStartedAt?: unknown };
  const origin = new URL(SITE_BASE_URL);
  if (origin.protocol !== 'https:') return NextResponse.json({ error: 'HTTPS site required' }, { status: 503 });
  const publicOrigin = origin.origin;
  const fetchPublic = async (pathname: string) => {
    const response = await fetch(publicOrigin + pathname, {
      cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { 'Accept': pathname.endsWith('.json') ? 'application/json' : 'text/html' },
    });
    return response;
  };
  // Vercel's static manifest is a build proof; never use an old build against fresh CMS writes.
  let manifest: { buildStartedAt?: string; source?: string; records?: Array<{
    collection: string; docId: string; updatedAt?: string; path?: string | null; noIndex?: boolean;
  }> };
  try {
    const response = await fetchPublic('/content-manifest.json');
    if (!response.ok) throw new Error('manifest ' + response.status);
    manifest = await response.json();
    if (manifest.source !== 'cms' || !Array.isArray(manifest.records) ||
        !manifest.buildStartedAt || !Number.isFinite(Date.parse(manifest.buildStartedAt))) {
      throw new Error('invalid CMS-backed build manifest');
    }
  } catch (e) {
    return NextResponse.json({ error: 'Cannot verify public Vercel build', detail: String(e) }, { status: 503 });
  }
  // Bound each request; a later call processes the remaining queue.
  const pending = await payload.find({ collection: 'pending-deploys', limit: 20, depth: 0, sort: 'changedAt' });
  const ready: Array<{ id: number | string; path: string; changedAt: string }> = [];
  const deferred: Array<{ id: number | string; reason: string }> = [];
  for (const p of pending.docs) {
    const record = p as unknown as { id: number | string; collectionSlug?: string; docId?: string; changedAt?: string };
    const type = record.collectionSlug;
    const collection = type === 'articles' ? 'articles' : type === 'tools' ? 'tools' : null;
    if (!collection || !record.docId || !record.changedAt) {
      deferred.push({ id: record.id, reason: 'unsupported collection or incomplete entry' }); continue;
    }
    try {
      const current = await payload.findByID({ collection, id: record.docId, depth: 0, draft: false }) as {
        _status?: string; enabled?: boolean; seo?: { noIndex?: boolean }; updatedAt?: string;
      };
      const proof = selectPublishedProof(manifest.buildStartedAt!, manifest.records!, record, current);
      if (!proof.ok) {
        deferred.push({ id: record.id, reason: proof.reason }); continue;
      }
      const match = proof.record;
      const deployedPath = match.path;
      if (!deployedPath) { deferred.push({ id: record.id, reason: 'missing deployed path' }); continue; }
      const page = await fetchPublic(deployedPath);
      if (page.status !== 200) {
        deferred.push({ id: record.id, reason: 'public page status ' + page.status }); continue;
      }
      const html = await page.text();
      const canonicalUrl = publicOrigin + deployedPath;
      const verification = verifyDeployedHtml(html, canonicalUrl, page.url,
        page.headers.get('content-type'), page.headers.get('x-robots-tag'));
      if (!verification.ok) {
        deferred.push({ id: record.id, reason: verification.reason }); continue;
      }
      ready.push({ id: record.id, path: deployedPath, changedAt: record.changedAt });
    } catch (e) {
      deferred.push({ id: record.id, reason: 'validation failed: ' + String(e).slice(0,100) });
    }
  }
  const readyVersions = ready.map(x => ({ url: publicOrigin + x.path, changedAt: x.changedAt }));
  const report = { dryRun: body.confirm !== true, ready: ready.map(x => publicOrigin + x.path), readyVersions,
    deferred, queuedTotal: pending.totalDocs, buildStartedAt: manifest.buildStartedAt };
  if (!body.confirm || !ready.length) return NextResponse.json(report);
  // Require the admin to approve precisely the URL list returned by preview.
  if (!matchesApprovedIndexNowSnapshot(body, { ready: report.ready, readyVersions, buildStartedAt: manifest.buildStartedAt! })) {
    return NextResponse.json({ ...report, error: 'Preview URLs changed or not approved. Run a fresh dry-run before confirming.' }, { status: 409 });
  }

  // A dry-run is useful even when IndexNow is not yet configured. Guard only
  // the actual submission; never log/return the configured ownership key.
  if (process.env.INDEXNOW_DISABLE === 'true') {
    return NextResponse.json({ ...report, error: 'IndexNow disabled; queue preserved' }, { status: 503 });
  }
  const key = (process.env.INDEXNOW_API_KEY || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(key)) {
    return NextResponse.json({ ...report, error: 'IndexNow key is missing or invalid; queue preserved' }, { status: 503 });
  }

  // Key proof MUST be public on the same host. Do not disclose the key in logs.
  const proof = await fetchPublic('/' + key + '.txt').catch(() => null);
  if (!proof?.ok || (await proof.text()).trim() !== key) {
    return NextResponse.json({ ...report, error: 'IndexNow key proof unavailable or does not match' }, { status: 503 });
  }
  let response: Response;
  try {
    response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ host: origin.hostname, key, keyLocation: publicOrigin + '/' + key + '.txt',
        urlList: ready.map(x => publicOrigin + x.path) }),
    });
  } catch {
    return NextResponse.json({ ...report, error: 'IndexNow endpoint unavailable; queue preserved' }, { status: 502 });
  }
  // 202 is acknowledged but its key is still pending verification. Keep entries until 200.
  if (response.status !== 200) {
    return NextResponse.json({ ...report, httpStatus: response.status,
      error: response.status === 202 ? 'IndexNow key pending verification; queue preserved' : 'IndexNow rejected; queue preserved' }, { status: 502 });
  }
  const acknowledged: string[] = [];
  for (const item of ready) {
    try {
      const latest = await payload.findByID({ collection: 'pending-deploys', id: item.id, depth: 0 }) as { changedAt?: string };
      if (latest.changedAt !== item.changedAt) continue; // concurrent newer edits must remain pending
      await payload.delete({ collection: 'pending-deploys', id: item.id });
      acknowledged.push(publicOrigin + item.path);
    } catch { /* preserve unresolved entries for the next review */ }
  }
  return NextResponse.json({ ...report, dryRun: false, httpStatus: response.status, acknowledged });
}
