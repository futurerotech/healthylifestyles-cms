/**
 * Bounded, server-side, read-only Payload projection for offline GSC review.
 *
 * Invoke only with a real authenticated PayloadRequest from a trusted server
 * context. This module does not expose an endpoint, read secrets, fetch GSC,
 * write to CMS, or bypass access control. A successful read is not evidence
 * that published pages are live, canonical or Google-indexed.
 */
import type { Payload, PayloadRequest } from 'payload';
import { normalizePayloadReviewSnapshot } from './gscPayloadSnapshotAdapter';
import type { DeclaredCmsPageReference } from './gscEditorialReviewQueue';

const PAGE_SIZE = 100;
const MAX_DOCUMENTS = 25_000;
const MAX_PAGES_PER_COLLECTION = Math.ceil(MAX_DOCUMENTS / PAGE_SIZE);

export interface AuthorizedPayloadReviewSnapshot {
  kind: 'access-controlled-local-payload-snapshot';
  includesDraftVersions: false;
  catalog: DeclaredCmsPageReference[];
  counts: { articles: number; tools: number };
  caveats: string[];
}

function isSafeCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function checkPage(
  result: unknown,
  requestedPage: number,
  expectedTotal: number | null,
) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new TypeError('Payload returned an invalid paginated result.');
  }
  const value = result as Record<string, unknown>;
  if (!Array.isArray(value.docs) || !isSafeCount(value.totalDocs) ||
      !Number.isSafeInteger(value.page) || value.page !== requestedPage ||
      value.limit !== PAGE_SIZE || !isSafeCount(value.totalPages) ||
      typeof value.hasNextPage !== 'boolean' ||
      (expectedTotal !== null && value.totalDocs !== expectedTotal)) {
    throw new TypeError('Payload pagination was malformed or changed during the read.');
  }
  const total = value.totalDocs;
  if (total > MAX_DOCUMENTS) {
    throw new RangeError('Payload snapshot exceeds 25,000 documents.');
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (value.totalPages !== totalPages ||
      requestedPage > totalPages ||
      value.hasNextPage !== (requestedPage < totalPages) ||
      ('nextPage' in value &&
       value.nextPage !== (requestedPage < totalPages ? requestedPage + 1 : null))) {
    throw new TypeError('Payload pagination is incomplete or contradictory.');
  }
  const expectedItems = Math.max(0, Math.min(PAGE_SIZE, total - (requestedPage - 1) * PAGE_SIZE));
  if (value.docs.length !== expectedItems) {
    throw new TypeError('Payload page omitted or repeated document slots.');
  }
  return { docs: value.docs, total, hasNextPage: value.hasNextPage };
}

/**
 * Payload v3 Local API bypasses access checks by default. The explicit
 * overrideAccess:false and authenticated req are security-critical.
 * Reads current base documents only (draft:false), not autosaved versions.
 */
export async function collectAuthorizedPayloadReviewSnapshot(
  payload: Pick<Payload, 'find'>,
  req: PayloadRequest,
): Promise<AuthorizedPayloadReviewSnapshot> {
  if (!payload || typeof payload.find !== 'function' ||
      !req?.user || !['admin', 'editor'].includes(req.user.role ?? '')) {
    throw new Error('A logged-in Payload administrator or editor is required.');
  }

  const all: DeclaredCmsPageReference[] = [];
  const counts = { articles: 0, tools: 0 };
  const collections = ['articles', 'tools'] as const;

  for (const collection of collections) {
    let page = 1;
    let total: number | null = null;
    const seenIds = new Set<string>();

    while (true) {
      if (page > MAX_PAGES_PER_COLLECTION) {
        throw new RangeError('Exceeded bounded Payload pagination.');
      }
      // Only the minimal fields needed for triage may leave the data layer.
      const select = collection === 'tools'
        ? { slug: true, _status: true, enabled: true, seo: { noIndex: true, canonical: true } } as const
        : { slug: true, _status: true, seo: { noIndex: true, canonical: true } } as const;
      const response = await payload.find({
        collection,
        req,
        overrideAccess: false,
        draft: false,
        depth: 0,
        page,
        limit: PAGE_SIZE,
        pagination: true,
        sort: 'id',
        select,
      });
      const checked = checkPage(response, page, total);
      total = checked.total;
      if (all.length + checked.docs.length > MAX_DOCUMENTS) {
        throw new RangeError('Combined Payload snapshot exceeds safe document limit.');
      }
      const converted = normalizePayloadReviewSnapshot(collection, checked.docs);
      for (const item of converted) {
        if (item.recordId === null || item.recordId === undefined) {
          throw new TypeError('Payload read did not include a stable document ID.');
        }
        const key = String(item.recordId);
        if (seenIds.has(key)) {
          throw new TypeError('Payload ID repeated across paginated reads.');
        }
        seenIds.add(key);
      }
      all.push(...converted);
      counts[collection] += converted.length;
      if (!checked.hasNextPage) break;
      page++;
    }
  }

  return {
    kind: 'access-controlled-local-payload-snapshot',
    includesDraftVersions: false,
    catalog: all,
    counts,
    caveats: [
      'A request-scoped server-side Payload Local API read with overrideAccess:false; no elevated access or writes.',
      'Selected base records can change during pagination; a snapshot is not a transactionally frozen view.',
      'Publication, canonical response, and indexability must still be checked on the live frontend.',
      'No Search Console property authentication or actual Google indexing state is established.',
    ],
  };
}
