import type { DeclaredCmsPageReference } from './gscEditorialReviewQueue';

/**
 * Convert an already-authorized, bounded Payload projection to offline review
 * references. No I/O, database access or live trust assertion.
 */
export function normalizePayloadReviewSnapshot(
  collection: 'articles' | 'tools',
  documents: readonly unknown[],
): DeclaredCmsPageReference[] {
  if (!Array.isArray(documents) || documents.length > 25000) {
    throw new RangeError('A bounded Payload document array is required.');
  }
  return documents.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('Invalid Payload document projection.');
    }
    const doc = value as Record<string, unknown>;
    if (typeof doc.slug !== 'string' ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.slug)) {
      throw new RangeError('Invalid Payload slug projection.');
    }
    const seo = doc.seo;
    if (seo !== undefined && seo !== null &&
        (typeof seo !== 'object' || Array.isArray(seo))) {
      throw new TypeError('Invalid Payload SEO projection.');
    }
    const fields = (seo ?? {}) as Record<string, unknown>;
    if (fields.noIndex !== undefined && fields.noIndex !== null &&
        typeof fields.noIndex !== 'boolean') {
      throw new TypeError('Invalid noIndex projection.');
    }
    if (fields.canonical !== undefined && fields.canonical !== null &&
        typeof fields.canonical !== 'string') {
      throw new TypeError('Invalid canonical projection.');
    }
    if (doc.enabled !== undefined && doc.enabled !== null &&
        typeof doc.enabled !== 'boolean') {
      throw new TypeError('Invalid tool enabled projection.');
    }
    const status = doc._status === 'published' || doc._status === 'draft'
      ? doc._status : 'unknown';
    const recordId = doc.id;
    if (recordId !== undefined && recordId !== null &&
        !(typeof recordId === 'number' && Number.isSafeInteger(recordId) && recordId > 0) &&
        !(typeof recordId === 'string' && recordId.length > 0 &&
          recordId.length <= 128 && recordId.trim() === recordId)) {
      throw new TypeError('Invalid Payload document identifier.');
    }
    const page = 'https://www.healthylifesstyles.com/' +
      (collection === 'articles' ? 'wellness-hub/' : 'tools/') + doc.slug;
    return {
      page,
      collection,
      slug: doc.slug,
      status,
      noIndex: fields.noIndex ?? null,
      enabled: collection === 'tools' ? doc.enabled ?? null : undefined,
      canonicalOverride: fields.canonical ?? null,
      recordId: recordId ?? null,
    } as DeclaredCmsPageReference;
  });
}
