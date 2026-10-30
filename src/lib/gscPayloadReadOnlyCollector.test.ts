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