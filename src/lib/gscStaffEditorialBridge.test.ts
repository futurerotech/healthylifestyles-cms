import { describe, expect, it, vi } from 'vitest';
import type { Payload, PayloadRequest } from 'payload';
import { collectStaffEditorialReviewQueueWithTransport, type GscReadOnlyTransport } from './gscAuthorizedReadOnlyAnalytics';

const origin = 'https://www.healthylifesstyles.com';
const property = 'sc-domain:healthylifesstyles.com';
const req = { user: { id: 1, role: 'editor' } } as PayloadRequest;
const windows = { previous: { startDate: '2026-08-01', endDate: '2026-08-28' }, current: { startDate: '2026-08-29', endDate: '2026-09-25' } };
const row = { keys: ['sleep science', origin+'/tools/sleep-score'], clicks: 5, impressions: 100, ctr: 0.05, position: 10 };
const response = (collection: string) => ({ docs: collection === 'tools'
  ? [{id:2,slug:'sleep-score',_status:'published',enabled:true,seo:{noIndex:false}}]
  : [{id:1,slug:'sleep-guide',_status:'published',seo:{noIndex:false}}],
  totalDocs:1,page:1,limit:100,totalPages:1,hasNextPage:false,nextPage:null });
const make = () => {
 const payload = { find: vi.fn(async ({collection}: {collection:string})=>response(collection)),
   create:vi.fn(), update:vi.fn(), delete:vi.fn() };
 const transport = {getSite:vi.fn(async (_siteUrl:string)=>({siteUrl:property,permissionLevel:'siteFullUser'})),
   query:vi.fn(async ()=>({rows:[row],responseAggregationType:'byPage'}))};
 return {payload,transport};
};

describe('staff CMS + GSC readonly editorial bridge',()=>{
 it('returns only redacted human review totals without CMS mutations',async()=>{
  const {payload,transport}=make();
  const result=await collectStaffEditorialReviewQueueWithTransport(req,windows,
   payload as unknown as Pick<Payload,'find'>,transport);
  expect(result.totals.candidatePages).toBe(1);
  expect(result.cmsSnapshotCounts).toEqual({articles:1,tools:1});
  expect(result.publicationAuthorized).toBe(false);
  expect(result.providerAuthentication).toBe('caller-transport-not-verified');
  expect('tasks' in result).toBe(false);
  expect(JSON.stringify(result)).not.toContain('sleep science');
  expect(JSON.stringify(result)).not.toContain('/tools/sleep-score');
  expect(payload.find).toHaveBeenCalledTimes(2);
  for(const [args] of payload.find.mock.calls){expect(args).toMatchObject({req,overrideAccess:false,draft:false,depth:0});}
  expect(payload.create).not.toHaveBeenCalled();
  expect(payload.update).not.toHaveBeenCalled();
  expect(payload.delete).not.toHaveBeenCalled();
  expect(transport.getSite).toHaveBeenCalledWith(property);
  expect(transport.query).toHaveBeenCalledTimes(2);
 });
 it('requires explicit detail opt-in and never recommends a CMS mutation',async()=>{
  const {payload,transport}=make();
  const result=await collectStaffEditorialReviewQueueWithTransport(req,windows,
   payload as unknown as Pick<Payload,'find'>,transport,{includeDetails:true});
  expect(result.tasks?.[0].page).toContain('/tools/sleep-score');
  expect(result.tasks?.[0].recommendedCmsMutation).toBeNull();
 });
 it('blocks unauthenticated and invalid windows before database or Google IO',async()=>{
  const {payload,transport}=make();
  await expect(collectStaffEditorialReviewQueueWithTransport({user:null} as PayloadRequest,
    windows,payload as unknown as Pick<Payload,'find'>,transport)).rejects.toThrow(/administrator or editor/);
  await expect(collectStaffEditorialReviewQueueWithTransport(req,{...windows,current:{startDate:'2026-09-01',endDate:'2026-09-28'}},
    payload as unknown as Pick<Payload,'find'>,transport)).rejects.toThrow();
  expect(payload.find).not.toHaveBeenCalled();
  expect(transport.getSite).not.toHaveBeenCalled();
 });
 it('blocks a CMS read failure before fetching private GSC queries',async()=>{
  const {payload,transport}=make();
  payload.find.mockRejectedValueOnce(new Error('SQL private data'));
  await expect(collectStaffEditorialReviewQueueWithTransport(req,windows,
    payload as unknown as Pick<Payload,'find'>,transport)).rejects.toThrow('Access-controlled CMS snapshot failed; no review queue was produced.');
  expect(transport.getSite).not.toHaveBeenCalled();
  expect(transport.query).not.toHaveBeenCalled();
 });
 it('rejects malformed options before touching either backend',async()=>{
  const {payload,transport}=make();
  await expect(collectStaffEditorialReviewQueueWithTransport(req,windows,
    payload as unknown as Pick<Payload,'find'>,transport,{top:101})).rejects.toThrow(/options/);
  expect(payload.find).not.toHaveBeenCalled();
  expect(transport.getSite).not.toHaveBeenCalled();
 });
});