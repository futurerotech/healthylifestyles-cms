import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import type { PostgresAdapter } from '@payloadcms/db-postgres';
import config from '@payload-config';
import { isAllowedIndexNowPreviewOrigin, ISOLATED_STAGING_CMS_ORIGIN, CMS_ORIGIN } from '@/lib/allowedOrigins';
import { SITE_BASE_URL } from '@/lib/site-config';
import { reserveIndexNowAttempt, markIndexNowDispatching, finishIndexNowAttempt } from '@/lib/indexnow-attempts';
import { selectPublishedProof, verifyDeployedHtml, matchesApprovedIndexNowSnapshot, isExplicitIndexNowSubmitRequest, mapWithBoundedConcurrency, matchesIndexNowOwnershipProof, isTrustedIndexNowManifest, isIndexNowLiveSubmissionEnabled, classifyIndexNowResponse, fetchDirectIndexNowPublicResource, readBoundedIndexNowProofText } from '@/lib/indexnow-postdeploy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manual admin-only reconciliation: safe to run after Vercel reports Production Ready.
// Never submits drafts, noncanonical URLs, or a CMS change absent from deployed manifest.
// For the first release the operator must opt into actual submission (confirm=true).
// No new secrets, schema changes, background jobs, or automatic production writes.
export async function POST(req: Request): Promise<NextResponse> {
  if (!isAllowedIndexNowPreviewOrigin(req.headers.get('origin'))) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers }).catch(() => ({ user: null }));
  if (!user || (user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Admin login required' }, { status: 403 });
  }
  const parsedBody: unknown = await req.json().catch(() => ({}));
  if (parsedBody === null || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 });
  }
  const body = parsedBody as { confirm?: unknown; page?: unknown; approvedUrls?: unknown; approvedVersions?: unknown; approvedBuildStartedAt?: unknown };
  const explicitlyConfirmed = isExplicitIndexNowSubmitRequest(body);
  // No queue acknowledgement, public proof or provider request can occur
  // after a confirmed submit in the deliberately isolated staging mode.
  if (ISOLATED_STAGING_CMS_ORIGIN && explicitlyConfirmed) {
    return NextResponse.json({
      error: 'Isolated staging permits admin preview only; IndexNow submission is disabled.',
    }, { status: 403 });
  }
  // CI-only defense in depth: preview would otherwise fetch the live site's
  // content-manifest.json BEFORE the IndexNow live-submit guard. The offline
  // container additionally has no external network interfaces or host gateway.
  // Production's authenticated public-build verification is unchanged.
  if (process.env.HLS_CI_OFFLINE_CONTAINER === '1' &&
      process.env.HLS_CI_BLOCK_PUBLIC_MANIFEST === '1') {
    return NextResponse.json({
      error: 'Public manifest verification is disabled in network-isolated CI.',
    }, { status: 503 });
  }
  const origin = new URL(SITE_BASE_URL);
  if (origin.protocol !== 'https:') return NextResponse.json({ error: 'HTTPS site required' }, { status: 503 });
  const publicOrigin = origin.origin;
  const fetchPublic = (pathname: string) =>
    fetchDirectIndexNowPublicResource(publicOrigin, pathname);
  // Vercel's static manifest is a build proof; never use an old build against fresh CMS writes.
  let manifest: import('@/lib/indexnow-postdeploy').TrustedIndexNowManifest;
  try {
    const response = await fetchPublic('/content-manifest.json');
    if (!response.ok) throw new Error('manifest ' + response.status);
    if (response.url !== publicOrigin + '/content-manifest.json') {
      throw new Error('manifest redirect or host mismatch');
    }
    const manifestJson: unknown = JSON.parse(await readBoundedIndexNowProofText(response, 2 * 1024 * 1024));
    if (!isTrustedIndexNowManifest(manifestJson, CMS_ORIGIN)) {
      throw new Error('invalid or untrusted CMS-backed build manifest');
    }
    manifest = manifestJson;
  } catch (e) {
    return NextResponse.json({ error: 'Cannot verify public Vercel build', detail: String(e) }, { status: 503 });
  }
  // Paginate explicitly: deferred or unpublishable entries must not permanently
  // starve newer eligible URLs beyond the first 20. The same page is re-read
  // at confirmation and the exact URL/revision/build approval still applies.
  const requestedPage = body.page === undefined ? 1 : body.page;
  if (typeof requestedPage !== 'number' || !Number.isInteger(requestedPage) ||
      requestedPage < 1 || requestedPage > 1000) {
    return NextResponse.json({ error: 'page must be an integer from 1 to 1000' }, { status: 400 });
  }
  const pending = await payload.find({
    collection: 'pending-deploys', limit: 20, page: requestedPage, depth: 0, sort: 'changedAt',
  });
  // Remote checks are limited to four in flight; results still match the
  // original queue order so the exact preview approval remains deterministic.
  type Checked =
    | { kind: 'ready'; id: number | string; path: string; changedAt: string }
    | { kind: 'deferred'; id: number | string; reason: string };
  const checked = await mapWithBoundedConcurrency(pending.docs, 4, async (p): Promise<Checked> => {
    const record = p as unknown as { id: number | string; collectionSlug?: string; docId?: string; changedAt?: string };
    const type = record.collectionSlug;
    const collection = type === 'articles' ? 'articles' : type === 'tools' ? 'tools' : null;
    const docId = record.docId;
    const changedAt = record.changedAt;
    const defer = (reason: string): Checked => ({ kind: 'deferred', id: record.id, reason });
    if (!collection || !docId || !changedAt) return defer('unsupported collection or incomplete entry');
    try {
      // Check the ENTIRE queue, not just this 20-row page. Historical duplicate
      // identities can be split across pages and must never be sent/cleared.
      const identityCount = await payload.count({
        collection: 'pending-deploys',
        where: { and: [
          { collectionSlug: { equals: collection } },
          { docId: { equals: docId } },
        ] },
      });
      if (identityCount.totalDocs !== 1) {
        return defer('duplicate pending document identity; manual queue review required');
      }
      const current = await payload.findByID({ collection, id: docId, depth: 0, draft: false }) as {
        _status?: string; enabled?: boolean; seo?: { noIndex?: boolean }; updatedAt?: string;
      };
      const proof = selectPublishedProof(manifest.buildStartedAt!, manifest.records!, record, current);
      if (!proof.ok) return defer(proof.reason);
      const deployedPath = proof.record.path;
      if (!deployedPath) return defer('missing deployed path');
      const page = await fetchPublic(deployedPath);
      if (page.status !== 200) return defer('public page status ' + page.status);
      const html = await readBoundedIndexNowProofText(page, 4 * 1024 * 1024);
      const canonicalUrl = publicOrigin + deployedPath;
      const verification = verifyDeployedHtml(html, canonicalUrl, page.url,
        page.headers.get('content-type'), page.headers.get('x-robots-tag'));
      if (!verification.ok) return defer(verification.reason);
      return { kind: 'ready', id: record.id, path: deployedPath, changedAt };
    } catch (e) {
      return defer('validation failed: ' + String(e).slice(0, 100));
    }
  });
  const ready: Array<{ id: number | string; path: string; changedAt: string }> = [];
  const deferred: Array<{ id: number | string; reason: string }> = [];
  for (const item of checked) {
    if (item.kind === 'ready') ready.push({ id: item.id, path: item.path, changedAt: item.changedAt });
    else deferred.push({ id: item.id, reason: item.reason });
  }
  const readyVersions = ready.map(x => ({ url: publicOrigin + x.path, changedAt: x.changedAt }));
  const report = { dryRun: !explicitlyConfirmed,
    stagingPreviewOnly: Boolean(ISOLATED_STAGING_CMS_ORIGIN),
    ready: ready.map(x => publicOrigin + x.path), readyVersions,
    deferred, queuedTotal: pending.totalDocs, page: requestedPage,
    totalPages: pending.totalPages, hasNextPage: pending.hasNextPage, hasPrevPage: pending.hasPrevPage,
    buildStartedAt: manifest.buildStartedAt };
  if (!explicitlyConfirmed || !ready.length) return NextResponse.json(report);
  // Require the admin to approve precisely the URL list returned by preview.
  if (!matchesApprovedIndexNowSnapshot(body, { ready: report.ready, readyVersions, buildStartedAt: manifest.buildStartedAt! })) {
    return NextResponse.json({ ...report, error: 'Preview URLs changed or not approved. Run a fresh dry-run before confirming.' }, { status: 409 });
  }

  // A dry-run is useful even when IndexNow is not yet configured. Guard only
  // the actual submission; never log/return the configured ownership key.
  if (!isIndexNowLiveSubmissionEnabled(process.env.INDEXNOW_LIVE_ENABLED, process.env.INDEXNOW_DISABLE)) {
    return NextResponse.json({ ...report, error: 'IndexNow live submission is not explicitly enabled; queue preserved' }, { status: 503 });
  }
  // Explicit no-network safety for operator staging, regardless of NODE_ENV.
  // Keep queued items and approval intact for a subsequent real preview.
  if (process.env.INDEXNOW_DRY_RUN === 'true') {
    return NextResponse.json({ ...report, dryRun: true, simulation: true,
      message: 'IndexNow simulation: no provider request and no queue deletion.' });
  }

  const key = (process.env.INDEXNOW_API_KEY || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(key)) {
    return NextResponse.json({ ...report, error: 'IndexNow key is missing or invalid; queue preserved' }, { status: 503 });
  }

  // A .txt proof must come from the exact canonical URL; do not follow
  // redirects (including cross-origin redirects) when checking ownership.
  // Never log or return the key or key-bearing URL.
  const keyProofUrl = publicOrigin + '/' + key + '.txt';
  const proof = await fetch(keyProofUrl, {
    cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(10000),
    headers: { Accept: 'text/plain' },
  }).catch(() => null);
  const proofBody = proof?.status === 200 ? await readBoundedIndexNowProofText(proof, 256).catch(() => '') : '';
  if (!proof || !matchesIndexNowOwnershipProof(
    { status: proof.status, url: proof.url, body: proofBody }, keyProofUrl, key,
  )) {
    return NextResponse.json({ ...report, error: 'IndexNow key proof unavailable or does not match' }, { status: 503 });
  }
  const postgresDb = payload.db as unknown as PostgresAdapter;
  let reservation: Awaited<ReturnType<typeof reserveIndexNowAttempt>>;
  try {
    reservation = await reserveIndexNowAttempt(postgresDb, {
      actorId: String(user.id), buildStartedAt: manifest.buildStartedAt,
      items: ready.map(item => ({ id: item.id, changedAt: item.changedAt, url: publicOrigin + item.path })),
    });
  } catch {
    return NextResponse.json({ ...report, delivery: 'not_sent', error: 'Could not reserve an attempt; no provider request was started.' }, { status: 503 });
  }
  if (reservation.status !== 'reserved') {
    return NextResponse.json({ ...report, delivery: 'not_sent', error: reservation.status === 'stale'
      ? 'Pending revisions changed; run a fresh preview.'
      : 'A previous submission requires administrator review before retrying.' }, { status: 409 });
  }
  const attemptId = reservation.attemptId;
  try {
    if (!await markIndexNowDispatching(postgresDb, attemptId)) throw new Error('Attempt no longer reserved');
  } catch {
    return NextResponse.json({ ...report, attemptId, delivery: 'not_sent',
      error: 'The provider request was not started; the saved attempt requires review.' }, { status: 503 });
  }
  let providerStatus: number | null = null;
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ host: origin.hostname, key, keyLocation: publicOrigin + '/' + key + '.txt',
        urlList: ready.map(x => publicOrigin + x.path) }),
    });
    providerStatus = response.status;
  } catch {
    // Failure may occur after the provider received the request.
  }
  const delivery = classifyIndexNowResponse(providerStatus);
  try {
    const state = await finishIndexNowAttempt(postgresDb, attemptId, delivery, providerStatus);
    if (state === 'acknowledged') return NextResponse.json({ ...report, attemptId, dryRun: false,
      delivery: 'received', httpStatus: providerStatus, acknowledged: ready.map(x => publicOrigin + x.path) });
    return NextResponse.json({ ...report, attemptId, delivery, httpStatus: providerStatus,
      error: state === 'received' ? 'Provider received the old revision, but the queue changed; no entries were acknowledged. Review required.'
        : state === 'pending' ? 'Provider received URLs; key validation is pending. Review required.'
          : state === 'rejected' ? 'Provider rejected the request; queue preserved.'
            : 'Delivery is unknown; the provider may have received this request. Review required.' }, { status: 502 });
  } catch {
    // The committed in_flight record continues blocking overlapping retries.
    return NextResponse.json({ ...report, attemptId, delivery: 'unknown',
      error: 'Provider delivery or database acknowledgement is unknown. Review required.' }, { status: 503 });
  }
}
