import { describe, expect, it, vi } from 'vitest';
import { collectAuthorizedPayloadReviewSnapshot } from './gscPayloadReadOnlyCollector';
import type { Payload, PayloadRequest } from 'payload';

const req = { user: { id: 1, role: 'editor' } } as unknown as PayloadRequest;
const mock = (handler: (args: any) => unknown) => ({ find: vi.fn(async (args: any) => handler(args)) }) as unknown as Pick<Payload, 'find'>;
const response = (docs: unknown[], totalDocs = docs.length, page = 1) => ({
  docs, totalDocs, page, limit: 100, totalPages: Math.max(1,Math.ceil(totalDocs/100)),
  hasNextPage: page < Math.max(1,Math.ceil(totalDocs/100)),
  nextPage: page < Math.max(1,Math.ceil(totalDocs/100)) ? page+1 : null,
});

describe('authorized Payload read-only snapshot', () => {
  it('uses explicit access checks, minimal fields and never writes', async () => {
    const payload=mock(({collection})=>response(collection==='tools'
      ? [{id:2,slug:'sleep-score',_status:'published',enabled:true,seo:{noIndex:false}}]
      : [{id:1,slug:'sleep-guide',_status:'published',seo:{noIndex:false}}]));
    const result=await collectAuthorizedPayloadReviewSnapshot(payload,req);
    expect(result.counts).toEqual({articles:1,tools:1});
    expect(result.catalog).toHaveLength(2);
    expect(result.includesDraftVersions).toBe(false);
    for(const [args] of vi.mocked(payload.find).mock.calls){
      expect(args.overrideAccess).toBe(false);
      expect(args.req).toBe(req);
      expect(args.draft).toBe(false);
      expect(args.depth).toBe(0);
      expect(args.limit).toBe(100);
      expect(args.select).toBeDefined();
    }
    expect(vi.mocked(payload.find)).toHaveBeenCalledTimes(2);
  });
  it('refuses unauthenticated or unprivileged reads before calling CMS', async () => {
    const payload=mock(()=>{throw new Error('should not read');});
    await expect(collectAuthorizedPayloadReviewSnapshot(payload,{user:null} as unknown as PayloadRequest)).rejects.toThrow(/administrator or editor/);
    await expect(collectAuthorizedPayloadReviewSnapshot(payload,{user:{role:'subscriber'}} as unknown as PayloadRequest)).rejects.toThrow(/administrator or editor/);
    expect(vi.mocked(payload.find)).not.toHaveBeenCalled();
  });
  it('fails closed on missing slots, duplicate IDs and changing totals', async () => {
    const incomplete=mock(()=>response([],1));
    await expect(collectAuthorizedPayloadReviewSnapshot(incomplete,req)).rejects.toThrow(/omitted/);
    const duplicates=mock(({page,collection})=> collection==='articles'
      ? response(Array.from({length:100},(_,i)=>({id:i===99?1:i+1,slug:'guide-'+i})),101,page)
      : response([]));
    await expect(collectAuthorizedPayloadReviewSnapshot(duplicates,req)).rejects.toThrow(/repeated/);
    const unauthorizedResult=mock(()=>({docs:[],totalDocs:0,page:1,limit:100,totalPages:1,hasNextPage:false,nextPage:null}));
    await expect(collectAuthorizedPayloadReviewSnapshot(unauthorizedResult,req)).resolves.toMatchObject({counts:{articles:0,tools:0}});
  });
});
describe('bounded GSC Payload pagination and access regression', () => {
  it('reads a real second logical page in ascending ID order with access checks on every call', async () => {
    const articles = Array.from({length: 101}, (_, i) => ({
      id: i + 1, slug: 'published-guide-' + (i + 1),
      _status: 'published', seo: { noIndex: false },
    }));
    const payload = mock(({collection, page}) => {
      if (collection === 'articles') {
        const start = (page - 1) * 100;
        return response(articles.slice(start, start + 100), articles.length, page);
      }
      return response([
        { id: 900, slug: 'sleep-score', _status: 'published', enabled: true },
      ], 1, page);
    });
    const snapshot = await collectAuthorizedPayloadReviewSnapshot(payload, req);
    expect(snapshot.counts).toEqual({ articles: 101, tools: 1 });
    expect(snapshot.catalog).toHaveLength(102);
    expect(snapshot.catalog.filter(x => x.collection === 'articles').map(x => x.recordId))
      .toEqual(Array.from({length: 101}, (_, i) => i + 1));
    expect(vi.mocked(payload.find)).toHaveBeenCalledTimes(3);
    expect(vi.mocked(payload.find).mock.calls.map(([args]) => [args.collection, args.page]))
      .toEqual([['articles', 1], ['articles', 2], ['tools', 1]]);
    for (const [args] of vi.mocked(payload.find).mock.calls) {
      expect(args).toMatchObject({
        req, overrideAccess: false, draft: false, depth: 0,
        sort: 'id', limit: 100, pagination: true,
      });
      expect(Object.keys(args.select ?? {}).sort())
        .toEqual((args.collection === 'tools'
          ? ['_status', 'enabled', 'seo', 'slug'] : ['_status', 'seo', 'slug']).sort());
      expect(args.select.seo).toEqual({ noIndex: true, canonical: true });
    }
  });

  it('rejects a duplicate identifier that appears only on the second page', async () => {
    const pageOne = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1, slug: 'a-' + (i + 1),
    }));
    const payload = mock(({collection, page}) => collection === 'articles'
      ? response(page === 1 ? pageOne : [{ id: 42, slug: 'second-page-repeat' }], 101, page)
      : response([]));
    await expect(collectAuthorizedPayloadReviewSnapshot(payload, req)).rejects.toThrow(/repeated across paginated reads/);
    expect(vi.mocked(payload.find)).toHaveBeenCalledTimes(2);
  });

  it('refuses changing counts, truncated pages and contradictory page metadata', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, slug: 'a-' + (i + 1) }));
    const changedCount = mock(({collection, page}) => collection === 'articles'
      ? response(page === 1 ? firstPage : [
        { id: 101, slug: 'a-101' }, { id: 102, slug: 'a-102' },
      ], page === 1 ? 101 : 102, page) : response([]));
    await expect(collectAuthorizedPayloadReviewSnapshot(changedCount, req)).rejects.toThrow(/changed during the read/);

    const truncated = mock(() => response(firstPage.slice(0, 99), 101, 1));
    await expect(collectAuthorizedPayloadReviewSnapshot(truncated, req)).rejects.toThrow(/omitted or repeated document slots/);

    const contradictory = mock(() => ({
      ...response(firstPage, 101, 1),
      hasNextPage: false,
    }));
    await expect(collectAuthorizedPayloadReviewSnapshot(contradictory, req)).rejects.toThrow(/incomplete or contradictory/);
  });

  it('rejects over-budget collections and malformed IDs before returning a snapshot', async () => {
    const overBudget = mock(() => response([], 25_001));
    await expect(collectAuthorizedPayloadReviewSnapshot(overBudget, req)).rejects.toThrow(/exceeds 25,000 documents/);
    expect(vi.mocked(overBudget.find)).toHaveBeenCalledTimes(1);
    const missingId = mock(() => response([{ slug: 'missing-id' }]));
    await expect(collectAuthorizedPayloadReviewSnapshot(missingId, req)).rejects.toThrow(/stable document ID/);
  });

  it('refuses unauthorized roles without any database request while permitting administrator access', async () => {
    const payload = mock(() => response([]));
    for (const user of [null, { role: 'subscriber' }, { role: 'viewer' }, { role: '' }]) {
      await expect(collectAuthorizedPayloadReviewSnapshot(payload,
        { user } as unknown as PayloadRequest)).rejects.toThrow(/administrator or editor/);
    }
    expect(vi.mocked(payload.find)).not.toHaveBeenCalled();
    const admin = { user: { id: 6, role: 'admin' } } as unknown as PayloadRequest;
    await expect(collectAuthorizedPayloadReviewSnapshot(payload, admin))
      .resolves.toMatchObject({ counts: { articles: 0, tools: 0 } });
    expect(vi.mocked(payload.find)).toHaveBeenCalledTimes(2);
    for (const [args] of vi.mocked(payload.find).mock.calls) {
      expect(args.req).toBe(admin);
      expect(args.overrideAccess).toBe(false);
    }
  });
});
