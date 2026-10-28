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
  const re = new RegExp('(?:^|\s)' + name + '\s*=\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27)', 'i');
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
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const canonicals = links.filter((tag) => /(?:^|\s)rel\s*=/.test(tag.toLowerCase()) &&
    (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('canonical'));
  if (canonicals.length !== 1 || attribute(canonicals[0], 'href') !== expectedUrl) {
    return { ok: false, reason: 'missing, duplicate, or mismatched canonical link' };
  }
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  if (metas.some((tag) => ['robots', 'googlebot', 'bingbot'].includes((attribute(tag, 'name') ?? '').toLowerCase()) &&
    /\bnoindex\b/i.test(attribute(tag, 'content') ?? ''))) {
    return { ok: false, reason: 'meta robots noindex' };
  }
  return { ok: true, reason: 'verified' };
}
