/**
 * IndexNow submission queue (Phase 14, P1) — instant Bing/Yandex/Seznam/Naver
 * indexing pings on publish.
 *
 * LAW: fire-and-forget. Nothing here may ever block, delay, or fail a document
 * save — callers only enqueue (synchronous, in-memory); the network happens
 * later on a debounce timer with bounded retry, everything try/caught.
 *
 * Behavior:
 *  - Debounce/batch: publishes within 60s collapse into ONE submission
 *    (deduped; IndexNow caps 10,000 URLs per call — far above our volume).
 *  - Dry-run: INDEXNOW_DRY_RUN=true logs the payload and sends nothing.
 *    Unset, it DEFAULTS to dry-run outside NODE_ENV=production.
 *  - Kill switch: INDEXNOW_DISABLE=true → queue is a no-op (for scripts/seeds).
 *  - Missing INDEXNOW_API_KEY → quiet no-op (logged once per process).
 *  - SECRETS: the key is part of the wire payload by design (that is the
 *    standard's ownership proof) but NEVER appears in logs — redacted.
 *  - Test hooks: INDEXNOW_ENDPOINT + INDEXNOW_RETRY_DELAY_MS overrides.
 */
import { SITE_BASE_URL } from './site-config';

const DEBOUNCE_MS = 60_000;
const MAX_URLS = 10_000;

const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let warnedNoKey = false;

const endpoint = () => process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';
const retryDelayMs = () => Number(process.env.INDEXNOW_RETRY_DELAY_MS || 10_000);

const isDryRun = (): boolean => {
  if (process.env.INDEXNOW_DRY_RUN === 'true') return true;
  if (process.env.INDEXNOW_DRY_RUN === 'false') return false;
  return process.env.NODE_ENV !== 'production';
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Enqueue paths/URLs for the next batched ping. Synchronous — never blocks a save. */
export function queueIndexNowPing(paths: string[]): void {
  if (process.env.INDEXNOW_DISABLE === 'true') return;
  if (!process.env.INDEXNOW_API_KEY) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.log('[indexnow] INDEXNOW_API_KEY not set — pings are skipped.');
    }
    return;
  }
  for (const p of paths) {
    if (!p) continue;
    pending.add(p.startsWith('http') ? p : `${SITE_BASE_URL}${p.startsWith('/') ? '' : '/'}${p}`);
  }
  if (pending.size > 0 && !timer) {
    timer = setTimeout(() => {
      void flushIndexNowQueue();
    }, DEBOUNCE_MS);
    // Never hold the process open just for a pending ping.
    (timer as { unref?: () => void }).unref?.();
  }
}

/** Send the queued batch now. Never throws. Exported for tests + shutdown paths. */
export async function flushIndexNowQueue(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const urls = [...pending].slice(0, MAX_URLS);
  pending.clear();
  if (urls.length === 0) return;

  const key = process.env.INDEXNOW_API_KEY;
  if (!key) return;

  const body = {
    host: new URL(SITE_BASE_URL).hostname,
    key,
    keyLocation: `${SITE_BASE_URL}/${key}.txt`,
    urlList: urls,
  };

  if (isDryRun()) {
    console.log('[indexnow]', JSON.stringify({ dryRun: true, status: 'not-sent', payload: { ...body, key: '[redacted]', keyLocation: `${SITE_BASE_URL}/[redacted].txt` } }));
    return;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      });
      console.log('[indexnow]', JSON.stringify({ dryRun: false, urls: urls.length, status: res.status }));
      if (res.status < 500) return; // 200/202 accepted; 4xx won't improve on retry
    } catch (err) {
      console.error('[indexnow]', JSON.stringify({ dryRun: false, urls: urls.length, status: 'network-error', message: (err as Error).message.slice(0, 80) }));
    }
    if (attempt === 0) await sleep(retryDelayMs());
  }
}

/** Test-only: clear module state between cases. */
export function __resetIndexNowForTests(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pending.clear();
  warnedNoKey = false;
}
