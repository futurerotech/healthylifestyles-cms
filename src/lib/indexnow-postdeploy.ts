/**
 * Pure verification of the public Vercel content manifest and page response.
 * No network access, secrets, Payload database, or indexing side effects.
 */
export interface DeployedRecord {
  collection: string;
  docId: string;
  updatedAt?: string;
  path?: string | null;
  noIndex?: boolean;
}
export interface ChangeRecord {
  collectionSlug?: string;
  docId?: string;
  changedAt?: string;
}
export interface CurrentRecord {
  _status?: string;
  enabled?: boolean;
  updatedAt?: string;
  seo?: { noIndex?: boolean };
}
export type Proof = { ok: true; record: DeployedRecord } | { ok: false; reason: string };

function validMillis(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Resolve only the exact canonical article/tool URL rendered in this build. */
export function selectPublishedProof(
  buildStartedAt: string,
  records: DeployedRecord[],
  pending: ChangeRecord,
  current: CurrentRecord,
): Proof {
  const started = validMillis(buildStartedAt);
  const changed = validMillis(pending.changedAt);
  const updated = validMillis(current.updatedAt);
  if (started === null || changed === null || updated === null) {
    return { ok: false, reason: 'invalid build, queue, or CMS timestamp' };
  }
  if (started < changed) return { ok: false, reason: 'deployment predates queued change' };

  const collection = pending.collectionSlug;
  if (collection !== 'articles' && collection !== 'tools') return { ok: false, reason: 'unsupported collection' };
  if (pending.docId === undefined || !String(pending.docId).trim()) return { ok: false, reason: 'missing document ID' };
  const matches = records.filter((r) => r.collection === collection && String(r.docId) === String(pending.docId));
  if (matches.length !== 1) return { ok: false, reason: 'deployed manifest missing or duplicated record' };
  const record = matches[0];
  const prefix = collection === 'articles' ? '/wellness-hub/' : '/tools/';
  const slug = record.path?.startsWith(prefix) ? record.path.slice(prefix.length) : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, reason: 'unsafe or absent canonical content path' };
  }
  if (record.noIndex === true || current.seo?.noIndex === true) {
    return { ok: false, reason: 'content is marked noindex' };
  }
  if (current._status !== 'published' || current.enabled === false) {
    return { ok: false, reason: 'current CMS content is not published and enabled' };
  }
  const deployed = validMillis(record.updatedAt);
  if (deployed === null || deployed < updated) {
    return { ok: false, reason: 'deployment does not contain current CMS revision' };
  }
  return { ok: true, record };
}

function attribute(tag: string, name: string): string | null {
  // HTML attributes can be in either order. Reject missing or ambiguous URLs.
  const re = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27)', 'i');
  const m = tag.match(re);
  return m ? (m[1] ?? m[2]) : null;
}

/** Canonical + robots verification is independent of browser/rendering engines. */
export function verifyDeployedHtml(
  html: string,
  expectedUrl: string,
  responseUrl: string,
  contentType: string | null,
  xRobotsTag: string | null,
): { ok: boolean; reason: string } {
  if (responseUrl !== expectedUrl) return { ok: false, reason: 'redirect or final URL mismatch' };
  if (!contentType?.toLowerCase().startsWith('text/html')) {
    return { ok: false, reason: 'non-HTML response' };
  }
  if (/\bnoindex\b/i.test(xRobotsTag ?? '')) return { ok: false, reason: 'X-Robots-Tag noindex' };
  // Only real document-head directives are proof of canonical/indexability.
  // Do not accept a canonical tag injected into body content, HTML comments,
  // inline scripts, templates, or styles as if it were a head directive.
  const uncommented = html.replace(/<!--[\s\S]*?-->/g, '');
  const heads = [...uncommented.matchAll(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/gi)];
  if (heads.length !== 1) {
    return { ok: false, reason: 'missing or ambiguous document head' };
  }
  const bodyTag = /<body\b/i.exec(uncommented);
  if (bodyTag && bodyTag.index < heads[0].index!) {
    return { ok: false, reason: 'document head follows body' };
  }
  const headHtml = heads[0][1]
    .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const links = headHtml.match(/<link\b[^>]*>/gi) ?? [];
  const canonicals = links.filter((tag) => /(?:^|\s)rel\s*=/.test(tag.toLowerCase()) &&
    (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('canonical'));
  if (canonicals.length !== 1 || attribute(canonicals[0], 'href') !== expectedUrl) {
    return { ok: false, reason: 'missing, duplicate, or mismatched canonical link' };
  }
  const metas = headHtml.match(/<meta\b[^>]*>/gi) ?? [];
  if (metas.some((tag) => ['robots', 'googlebot', 'bingbot'].includes((attribute(tag, 'name') ?? '').toLowerCase()) &&
    /\bnoindex\b/i.test(attribute(tag, 'content') ?? ''))) {
    return { ok: false, reason: 'meta robots noindex' };
  }
  return { ok: true, reason: 'verified' };
}

/**
 * A submission requires an explicit admin preview of the exact URL batch.
 * Prevents a concurrent CMS publish from adding unseen URLs between preview
 * and the subsequent confirmation request.
 */
export function matchesApprovedIndexNowPreview(expected: unknown, ready: readonly string[]): boolean {
  if (!Array.isArray(expected) || expected.length === 0 || expected.length !== ready.length) return false;
  if (!expected.every((u): u is string => typeof u === 'string' && u.length > 0)) return false;
  if (new Set(expected).size !== expected.length || new Set(ready).size !== ready.length) return false;
  const approved = new Set<string>(expected);
  return ready.every((url) => approved.has(url));
}

/** URL + queued revision as seen in one admin preview. */
export interface IndexNowReadyVersion {
  url: string;
  changedAt: string;
}

/**
 * Require the exact build and queued revisions that the admin reviewed.
 * Checking only URL strings would allow a new edit of the SAME page to be
 * submitted under an old approval.
 */
export function matchesApprovedIndexNowSnapshot(
  input: {
    approvedUrls?: unknown;
    approvedVersions?: unknown;
    approvedBuildStartedAt?: unknown;
  },
  current: {
    ready: readonly string[];
    readyVersions: readonly IndexNowReadyVersion[];
    buildStartedAt: string;
  },
): boolean {
  if (!matchesApprovedIndexNowPreview(input.approvedUrls, current.ready)) return false;
  if (input.approvedBuildStartedAt !== current.buildStartedAt) return false;
  if (!Array.isArray(input.approvedVersions) ||
      input.approvedVersions.length !== current.readyVersions.length ||
      current.readyVersions.length !== current.ready.length) return false;
  const approved = new Map<string, string>();
  for (const item of input.approvedVersions) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const value = item as Record<string, unknown>;
    if (typeof value.url !== 'string' || typeof value.changedAt !== 'string' ||
        !Number.isFinite(Date.parse(value.changedAt)) || approved.has(value.url)) return false;
    approved.set(value.url, value.changedAt);
  }
  return current.readyVersions.every(({ url, changedAt }) =>
    typeof changedAt === 'string' && Number.isFinite(Date.parse(changedAt)) &&
    approved.get(url) === changedAt);
}

/** A real provider submission requires the literal JSON boolean true, never a truthy string/number. */
export function isExplicitIndexNowSubmitRequest(input: unknown): boolean {
  return input !== null && typeof input === 'object' && !Array.isArray(input) &&
    (input as Record<string, unknown>).confirm === true;
}

/**
 * Fetch a deployed public proof directly, without following HTTP redirects.
 * The CMS must not fetch redirected destinations (including private hosts)
 * just to discover that the final URL did not match the public proof URL.
 * Tests inject a fake fetcher; production always uses native fetch.
 */
export async function fetchDirectIndexNowPublicResource(
  publicOrigin: string,
  pathname: string,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (typeof publicOrigin !== 'string' || typeof pathname !== 'string' ||
      !pathname.startsWith('/')) {
    throw new RangeError('Invalid public proof URL');
  }
  const origin = new URL(publicOrigin);
  const target = new URL(pathname, origin);
  if (origin.protocol !== 'https:' || origin.origin !== publicOrigin ||
      target.origin !== publicOrigin || target.pathname !== pathname ||
      target.search !== '' || target.hash !== '') {
    throw new RangeError('Public proof must use a direct HTTPS path on the canonical origin');
  }
  const response = await fetcher(target.href, {
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: pathname.endsWith('.json') ? 'application/json' : 'text/html' },
  });
  if (response.redirected || response.url !== target.href ||
      (response.status >= 300 && response.status < 400)) {
    throw new Error('Public proof redirected or final URL differed');
  }
  return response;
}

/**
 * Limit the UNCOMPRESSED bytes consumed from a remote public proof. A valid
 * Content-Length is checked early, but the actual streamed bytes are always
 * counted: HTTP compression, chunked transfer and missing length must never
 * bypass the cap. Oversized/malformed proofs fail closed before parsing.
 */
export async function readBoundedIndexNowProofText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 ||
      maxBytes > 16 * 1024 * 1024) {
    throw new RangeError('Invalid public proof size limit');
  }
  const length = response.headers.get('content-length');
  if (length !== null &&
      (!/^[0-9]+$/.test(length) || Number(length) > maxBytes)) {
    throw new Error('Public proof length invalid or exceeds limit');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  let completed = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error('Public proof exceeds byte limit');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    completed = true;
    return text;
  } finally {
    if (!completed) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/**
 * Bound remote HTML checks so one slow page does not serialize an entire queue
 * preview. Results preserve the original queue order used for admin approval.
 */
export async function mapWithBoundedConcurrency<T, R>(
  items: readonly T[],
  maxConcurrent: number,
  check: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 20) {
    throw new Error('maxConcurrent must be an integer from 1 to 20');
  }
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await check(items[index]!, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(maxConcurrent, items.length) }, () => worker()));
  return results;
}

/** The owner must opt into live submission; missing env configuration fails closed. */
export function isIndexNowLiveSubmissionEnabled(
  enabled: unknown,
  disabled: unknown,
): boolean {
  return enabled === 'true' && disabled !== 'true';
}

/** Verify public key ownership without accepting a redirect to another URL/host. */
export function matchesIndexNowOwnershipProof(
  response: { status: number; url: string; body: string },
  requestedUrl: string,
  key: string,
): boolean {
  return response.status === 200 && response.url === requestedUrl &&
    response.body.trim() === key;
}

/** Reject offline, fixture, or foreign-CMS frontend build manifests. */
export interface TrustedIndexNowManifest {
  version: 1;
  source: 'cms';
  buildKind: 'cms';
  cmsOrigin: string;
  buildStartedAt: string;
  records: DeployedRecord[];
}
export function isTrustedIndexNowManifest(
  input: unknown,
  expectedCmsOrigin: string,
): input is TrustedIndexNowManifest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const m = input as Record<string, unknown>;
  return m.version === 1 && m.source === 'cms' && m.buildKind === 'cms' &&
    m.cmsOrigin === expectedCmsOrigin &&
    typeof m.buildStartedAt === 'string' && Number.isFinite(Date.parse(m.buildStartedAt)) &&
    Array.isArray(m.records) && m.records.every((r) =>
      !!r && typeof r === 'object' && !Array.isArray(r));
}
