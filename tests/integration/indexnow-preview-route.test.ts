// @vitest-environment node
// Exact Next route contract with ONLY synthetic CMS, queue, and static Vercel
// proof responses. No real DB, staging credentials, IndexNow or Google calls.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('payload', () => ({ getPayload: vi.fn() }));
vi.mock('@payload-config', () => ({ default: {} }));
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      status: options?.status ?? 200,
      json: async () => data,
    }),
  },
}));
vi.mock('@/lib/allowedOrigins', () => ({
  isAllowedIndexNowPreviewOrigin: (origin: string | null) =>
    origin === 'https://cms-qa.healthylifesstyles.com',
  ISOLATED_STAGING_CMS_ORIGIN: 'https://cms-qa.healthylifesstyles.com',
  CMS_ORIGIN: 'https://cms.healthylifesstyles.com',
}));
vi.mock('@/lib/site-config', () => ({
  SITE_BASE_URL: 'https://www.healthylifesstyles.com',
}));
vi.mock('@/lib/indexnow-queue-ack', () => ({
  acknowledgeIndexNowQueueRevision: vi.fn(() => {
    throw new Error('Queue acknowledgement is forbidden in preview');
  }),
}));

import { getPayload } from 'payload';
import { acknowledgeIndexNowQueueRevision } from '../../src/lib/indexnow-queue-ack';
import { POST } from '../../src/app/api/seo/reconcile-indexnow/route';

const CMS = 'https://cms-qa.healthylifesstyles.com';
const PUBLIC = 'https://www.healthylifesstyles.com';
const REVISED_AT = '2026-11-18T11:00:00.000Z';
const CHANGED_AT = '2026-11-18T10:00:00.000Z';
const DEPLOYED_AT = '2026-11-18T12:00:00.000Z';
const BUILD_AT = '2026-11-18T13:00:00.000Z';

const rows = [
  { id: 1001, collectionSlug: 'articles', docId: '101', changedAt: CHANGED_AT },
  { id: 1002, collectionSlug: 'articles', docId: '102', changedAt: CHANGED_AT },
  { id: 1003, collectionSlug: 'articles', docId: '103', changedAt: CHANGED_AT },
  { id: 1004, collectionSlug: 'articles', docId: '104', changedAt: CHANGED_AT },
  { id: 1005, collectionSlug: 'articles', docId: '105', changedAt: CHANGED_AT },
  { id: 1006, collectionSlug: 'articles', docId: '106', changedAt: CHANGED_AT },
];
const slugs = [
  'ready-article', 'draft-article', 'old-slug',
  'noindex-article', 'robots-header', 'robots-meta',
];
const currentRecords: Record<string, object> = {
  '101': { slug: 'ready-article', _status: 'published', updatedAt: REVISED_AT, seo: { noIndex: false } },
  '102': { slug: 'draft-article', _status: 'draft', updatedAt: REVISED_AT, seo: { noIndex: false } },
  '103': { slug: 'new-slug', _status: 'published', updatedAt: REVISED_AT, seo: { noIndex: false } },
  '104': { slug: 'noindex-article', _status: 'published', updatedAt: REVISED_AT, seo: { noIndex: true } },
  '105': { slug: 'robots-header', _status: 'published', updatedAt: REVISED_AT, seo: { noIndex: false } },
  '106': { slug: 'robots-meta', _status: 'published', updatedAt: REVISED_AT, seo: { noIndex: false } },
};

function response(url: string, contents: string, contentType: string, extras: Record<string, string> = {}): Response {
  const result = new Response(contents, {
    status: 200, headers: { 'content-type': contentType, ...extras },
  });
  Object.defineProperty(result, 'url', { value: url, configurable: true });
  return result;
}

function fixture() {
  const manifest = {
    version: 1, source: 'cms', buildKind: 'cms',
    cmsOrigin: 'https://cms.healthylifesstyles.com',
    buildStartedAt: BUILD_AT,
    records: rows.map((row, index) => ({
      collection: 'articles', docId: row.docId,
      path: '/wellness-hub/' + slugs[index],
      updatedAt: DEPLOYED_AT, noIndex: false,
    })),
  };
  const payload = {
    auth: vi.fn().mockResolvedValue({ user: { id: 'synthetic-admin', role: 'admin' } }),
    find: vi.fn().mockResolvedValue({
      docs: rows, totalDocs: rows.length, totalPages: 1,
      hasNextPage: false, hasPrevPage: false,
    }),
    count: vi.fn().mockResolvedValue({ totalDocs: 1 }),
    findByID: vi.fn(async ({ id }: { id: string | number }) => {
      const item = currentRecords[String(id)];
      if (!item) throw new Error('Synthetic document not found');
      return item;
    }),
    db: { execute: vi.fn(() => { throw new Error('DB write forbidden'); }) },
    create: vi.fn(() => { throw new Error('DB create forbidden'); }),
    update: vi.fn(() => { throw new Error('DB update forbidden'); }),
    delete: vi.fn(() => { throw new Error('DB delete forbidden'); }),
  };
  vi.mocked(getPayload).mockResolvedValue(payload as never);
  const fetcher = vi.fn(async (resource: string | URL | Request, options?: RequestInit) => {
    const url = String(resource);
    if (options?.redirect !== 'manual' || options.cache !== 'no-store') {
      throw new Error('Public proof fetch must not follow redirects or cache');
    }
    if (url === PUBLIC + '/content-manifest.json') {
      return response(url, JSON.stringify(manifest), 'application/json');
    }
    for (const name of ['ready-article', 'robots-header', 'robots-meta']) {
      if (url === PUBLIC + '/wellness-hub/' + name) {
        const html = '<html><head><link rel="canonical" href="' + url + '">' +
          (name === 'robots-meta' ? '<meta name="robots" content="noindex">' : '') +
          '</head><body>Static synthetic content</body></html>';
        return response(url, html, 'text/html',
          name === 'robots-header' ? { 'x-robots-tag': 'noindex' } : {});
      }
    }
    throw new Error('Blocked unexpected external request: ' + new URL(url).hostname);
  });
  vi.stubGlobal('fetch', fetcher);
  return { payload, fetcher, manifest };
}

function request(body: unknown = { confirm: false }, origin: string | null = CMS): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (origin !== null) headers.set('origin', origin);
  return new Request(CMS + '/api/seo/reconcile-indexnow', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

function assertNoWrites(payload: ReturnType<typeof fixture>['payload'], fetcher: ReturnType<typeof fixture>['fetcher']) {
  expect(payload.db.execute).not.toHaveBeenCalled();
  expect(payload.create).not.toHaveBeenCalled();
  expect(payload.update).not.toHaveBeenCalled();
  expect(payload.delete).not.toHaveBeenCalled();
  expect(acknowledgeIndexNowQueueRevision).not.toHaveBeenCalled();
  const origins = fetcher.mock.calls.map(([target]) => new URL(String(target)).origin);
  expect(origins.every((origin) => origin === PUBLIC)).toBe(true);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('authenticated synthetic IndexNow staging preview route', () => {
  it('returns only published matching canonical URL and defers drafts, stale slugs and noindex', async () => {
    const { payload, fetcher } = fixture();
    const result = await POST(request());
    expect(result.status).toBe(200);
    const data = await result.json();
    expect(data.dryRun).toBe(true);
    expect(data.stagingPreviewOnly).toBe(true);
    expect(data.ready).toEqual([PUBLIC + '/wellness-hub/ready-article']);
    expect(data.queuedTotal).toBe(6);
    expect(data.deferred).toHaveLength(5);
    expect(data.deferred).toEqual(expect.arrayContaining([
      { id: 1002, reason: 'current CMS content is not published and enabled' },
      { id: 1003, reason: 'deployed path differs from current CMS slug' },
      { id: 1004, reason: 'content is marked noindex' },
      { id: 1005, reason: 'X-Robots-Tag forbids indexing' },
      { id: 1006, reason: 'meta robots forbids indexing' },
    ]));
    expect(payload.find).toHaveBeenCalledWith({
      collection: 'pending-deploys', limit: 20, page: 1, depth: 0, sort: 'changedAt',
    });
    expect(payload.count).toHaveBeenCalledTimes(6);
    expect(payload.findByID).toHaveBeenCalledTimes(6);
    expect(payload.findByID.mock.calls.every(([arg]) => arg.draft === false)).toBe(true);
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([
      PUBLIC + '/content-manifest.json',
      PUBLIC + '/wellness-hub/ready-article',
      PUBLIC + '/wellness-hub/robots-header',
      PUBLIC + '/wellness-hub/robots-meta',
    ]));
    expect(fetcher).toHaveBeenCalledTimes(4);
    assertNoWrites(payload, fetcher);
  });

  it('blocks confirmed submission in isolated staging before any proof fetch or queue access', async () => {
    const { payload, fetcher } = fixture();
    const result = await POST(request({
      confirm: true, approvedUrls: [PUBLIC + '/wellness-hub/ready-article'],
      approvedVersions: [], approvedBuildStartedAt: BUILD_AT,
    }));
    expect(result.status).toBe(403);
    expect((await result.json()).error).toMatch(/preview only/);
    expect(payload.auth).toHaveBeenCalledOnce();
    expect(payload.find).not.toHaveBeenCalled();
    expect(payload.count).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    assertNoWrites(payload, fetcher);
  });

  it('cannot mistake a truthy confirm string for permission to submit', async () => {
    const { payload, fetcher } = fixture();
    const result = await POST(request({ confirm: 'true' }));
    expect(result.status).toBe(200);
    expect((await result.json()).dryRun).toBe(true);
    expect(payload.find).toHaveBeenCalledOnce();
    assertNoWrites(payload, fetcher);
  });

  it('denies foreign or missing Origin before auth or any I/O', async () => {
    for (const origin of [null, 'https://cms.healthylifesstyles.com', 'https://evil.example']) {
      const { payload, fetcher } = fixture();
      const result = await POST(request({ confirm: false }, origin));
      expect(result.status).toBe(403);
      expect(getPayload).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
      assertNoWrites(payload, fetcher);
    }
  });

  it('denies anonymous or editor sessions without proof fetch or queue access', async () => {
    for (const user of [null, { role: 'editor' }]) {
      const { payload, fetcher } = fixture();
      payload.auth.mockResolvedValue({ user });
      const result = await POST(request());
      expect(result.status).toBe(403);
      expect(payload.find).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
      assertNoWrites(payload, fetcher);
    }
  });

  it('rejects manifest signed for wrong CMS origin before reading any queue', async () => {
    const { payload, fetcher, manifest } = fixture();
    manifest.cmsOrigin = CMS;
    const result = await POST(request());
    expect(result.status).toBe(503);
    expect((await result.json()).error).toMatch(/Cannot verify public Vercel build/);
    expect(payload.find).not.toHaveBeenCalled();
    expect(payload.findByID).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
    assertNoWrites(payload, fetcher);
  });
});
