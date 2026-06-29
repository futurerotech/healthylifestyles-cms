import { NextResponse } from 'next/server';
import { getGoogleAuth } from '../../../../lib/google-auth';
import { authorizeSeoRequest } from '../../../../lib/seo-guard';
import { canConsume, consumeQuota, getQuota } from '../../../../lib/indexing-quota';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type NotificationType = 'URL_UPDATED' | 'URL_DELETED';
const VALID_TYPES: NotificationType[] = ['URL_UPDATED', 'URL_DELETED'];

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await authorizeSeoRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const rawUrls = (body as { urls?: unknown })?.urls;
  const type = (body as { type?: unknown })?.type as NotificationType;
  if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
    return NextResponse.json({ error: 'Provide a non-empty `urls` array.' }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'type must be "URL_UPDATED" or "URL_DELETED".' }, { status: 400 });
  }
  const urls = rawUrls.filter((u): u is string => typeof u === 'string' && u.length > 0).slice(0, 100);

  // Quota guard — refuse the whole batch rather than silently dropping URLs.
  if (!canConsume('publish', urls.length)) {
    const q = getQuota('publish');
    return NextResponse.json(
      { error: `Daily indexing quota would be exceeded — ${q.remaining} of ${q.limit} requests left today. Try again tomorrow or reduce the batch.`, quota: { used: q.used, remaining: q.remaining } },
      { status: 429, headers: { 'X-GSC-Quota-Remaining': String(q.remaining) } },
    );
  }

  let indexing: import('googleapis').indexing_v3.Indexing;
  try {
    const { google } = await import('googleapis');
    const auth = await getGoogleAuth();
    indexing = google.indexing({ version: 'v3', auth });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Google authentication failed.' }, { status: 502 });
  }

  const settled = await Promise.allSettled(
    urls.map((url) => indexing.urlNotifications.publish({ requestBody: { url, type } }).then((r) => ({ url, status: r.status }))),
  );

  // Each attempted publish consumed one request of the daily quota.
  consumeQuota('publish', urls.length);

  const submitted: string[] = [];
  const failed: { url: string; reason: string }[] = [];
  settled.forEach((s, i) => {
    const url = urls[i];
    if (s.status === 'fulfilled') {
      submitted.push(url);
      console.log(JSON.stringify({ event: 'indexing-submit', url, type, timestamp: new Date().toISOString(), statusCode: s.value.status }));
    } else {
      const reason = s.reason instanceof Error ? s.reason.message : 'Publish failed.';
      failed.push({ url, reason });
      console.log(JSON.stringify({ event: 'indexing-submit', url, type, timestamp: new Date().toISOString(), statusCode: 0, error: reason }));
    }
  });

  const q = getQuota('publish');
  return NextResponse.json(
    { submitted, failed, quota: { used: q.used, remaining: q.remaining } },
    { headers: { 'X-GSC-Quota-Remaining': String(q.remaining) } },
  );
}
