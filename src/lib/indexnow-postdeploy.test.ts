import { describe, expect, it } from 'vitest';
import { acknowledgeIndexNowQueueRevision } from './indexnow-queue-ack';
import { selectPublishedProof, verifyDeployedHtml, matchesApprovedIndexNowPreview, matchesApprovedIndexNowSnapshot, isExplicitIndexNowSubmitRequest, mapWithBoundedConcurrency, matchesIndexNowOwnershipProof, isTrustedIndexNowManifest, isIndexNowLiveSubmissionEnabled, fetchDirectIndexNowPublicResource, readBoundedIndexNowProofText } from './indexnow-postdeploy';

const records = [{ collection:'articles', docId:'69', path:'/wellness-hub/example-guide',
 updatedAt:'2026-10-28T12:00:00Z', noIndex:false }];
const queue = { collectionSlug:'articles', docId:'69', changedAt:'2026-10-28T11:00:00Z' };
const current = { _status:'published', updatedAt:'2026-10-28T11:00:00Z', seo:{ noIndex:false } };
const build = '2026-10-28T11:30:00Z';
const expected='https://www.healthylifesstyles.com/wellness-hub/example-guide';

describe('post-deploy IndexNow safety gates', () => {
 it('requires explicit live enablement and honors emergency disable', () => {
  expect(isIndexNowLiveSubmissionEnabled('true', undefined)).toBe(true);
  expect(isIndexNowLiveSubmissionEnabled('true', 'true')).toBe(false);
  for (const enabled of [undefined, false, true, 'false', '1', '']) {
   expect(isIndexNowLiveSubmissionEnabled(enabled, undefined)).toBe(false);
  }
 });
 it('accepts only a canonical production CMS manifest', () => {
  const data = { version:1, source:'cms', buildKind:'cms',
   cmsOrigin:'https://cms.healthylifesstyles.com', buildStartedAt:build, records };
  const origin='https://cms.healthylifesstyles.com';
  expect(isTrustedIndexNowManifest(data,origin)).toBe(true);
  expect(isTrustedIndexNowManifest({...data,source:'local'},origin)).toBe(false);
  expect(isTrustedIndexNowManifest({...data,buildKind:'fixture'},origin)).toBe(false);
  expect(isTrustedIndexNowManifest({...data,cmsOrigin:'https://wrong.example'},origin)).toBe(false);
  expect(isTrustedIndexNowManifest({...data,version:2},origin)).toBe(false);
  expect(isTrustedIndexNowManifest({...data,buildStartedAt:'invalid'},origin)).toBe(false);
  expect(isTrustedIndexNowManifest({...data,records:null},origin)).toBe(false);
 });
 it('fetches public build proofs without following redirects or foreign URLs', async () => {
  const origin = 'https://www.healthylifesstyles.com';
  const url = origin + '/content-manifest.json';
  const calls: Array<{url: string; init?: RequestInit}> = [];
  const fake = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({url: String(input), init});
    return new Response('{}', {status: 200});
  }) as typeof fetch;
  // A fetch mock with an empty response.url is rejected: the proof must be
  // tied to its exact direct URL, not merely to a successful status.
  await expect(fetchDirectIndexNowPublicResource(origin, '/content-manifest.json', fake)).rejects.toThrow(/redirected/);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe(url);
  expect(calls[0].init?.redirect).toBe('manual');
  const direct = (async (_input: RequestInfo | URL) => {
    const response = new Response('{}', {status: 200});
    Object.defineProperty(response, 'url', {value: url});
    return response;
  }) as typeof fetch;
  const accepted = await fetchDirectIndexNowPublicResource(origin, '/content-manifest.json', direct);
  expect(accepted.status).toBe(200);
  const redirected = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({url: String(input), init});
    return new Response(null, {status: 302, headers: {Location: 'http://127.0.0.1/private'}});
  }) as typeof fetch;
  await expect(fetchDirectIndexNowPublicResource(origin, '/content-manifest.json', redirected)).rejects.toThrow(/redirected/);
  expect(calls[1].init?.redirect).toBe('manual');
  await expect(fetchDirectIndexNowPublicResource(origin, '//evil.example/path', fake)).rejects.toThrow(/canonical origin/);
  await expect(fetchDirectIndexNowPublicResource(origin, '/a?next=evil', fake)).rejects.toThrow(/direct HTTPS path/);
  expect(calls).toHaveLength(2);
 });
 it('enforces proof byte limits even without Content-Length or with chunked transfer', async () => {
  const body = (chunks: string[], headers: Record<string,string> = {}) =>
    new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of chunks) controller.enqueue(new TextEncoder().encode(part));
        controller.close();
      },
    }), { headers });
  expect(await readBoundedIndexNowProofText(body(['hello',' world']), 11)).toBe('hello world');
  await expect(readBoundedIndexNowProofText(body(['hello',' world']), 10)).rejects.toThrow(/byte limit/);
  await expect(readBoundedIndexNowProofText(body(['ok'], {'content-length': '1000'}), 10)).rejects.toThrow(/length/);
  await expect(readBoundedIndexNowProofText(body(['ok'], {'content-length': 'invalid'}), 10)).rejects.toThrow(/length/);
  expect(await readBoundedIndexNowProofText(body(['😀']), 4)).toBe('😀');
  await expect(readBoundedIndexNowProofText(body(['😀']), 3)).rejects.toThrow(/byte limit/);
  await expect(readBoundedIndexNowProofText(new Response(new Uint8Array([255, 254])), 10)).rejects.toThrow();
  await expect(readBoundedIndexNowProofText(body(['hi']), 0)).rejects.toThrow(/size limit/);
 });
 it('rejects redirect, wrong-host and mismatched IndexNow ownership files', () => {
  const url='https://www.healthylifesstyles.com/proof.txt';
  const key='abcdef0123456789abcdef0123456789';
  expect(matchesIndexNowOwnershipProof({status:200,url,body:key+'\n'},url,key)).toBe(true);
  expect(matchesIndexNowOwnershipProof({status:302,url,body:key},url,key)).toBe(false);
  expect(matchesIndexNowOwnershipProof({status:200,url:'https://another.example/proof.txt',body:key},url,key)).toBe(false);
  expect(matchesIndexNowOwnershipProof({status:200,url,body:'wrong'},url,key)).toBe(false);
 });
 it('never acknowledges a newer queue revision or a missing row', async () => {
  const calls: unknown[] = [];
  const original = { id: 7, changedAt: '2026-10-28T12:00:00Z' };
  const superseded = async (statement: unknown) => {
   calls.push(statement);
   return { rows: [] };
  };
  expect(await acknowledgeIndexNowQueueRevision(superseded, original)).toBe(false);
  expect(calls).toHaveLength(1);
  expect(await acknowledgeIndexNowQueueRevision(async () => ({ rows: [{ id: 7 }] }), original)).toBe(true);
  expect(await acknowledgeIndexNowQueueRevision(async () => ({ rows: [{ id: 8 }] }), original)).toBe(false);
  expect(await acknowledgeIndexNowQueueRevision(superseded, { id: 0, changedAt: original.changedAt })).toBe(false);
  expect(await acknowledgeIndexNowQueueRevision(superseded, { id: 7, changedAt: 'invalid' })).toBe(false);
  expect(calls).toHaveLength(1);
 });
 it('bounds concurrent checks while preserving queue order', async () => {
  const items = [0, 1, 2, 3, 4, 5, 6, 7];
  let active = 0;
  let peak = 0;
  const results = await mapWithBoundedConcurrency(items, 3, async (item) => {
   active += 1;
   peak = Math.max(peak, active);
   await new Promise<void>(resolve => setTimeout(resolve, item % 3));
   active -= 1;
   return item * 10;
  });
  expect(peak).toBe(3);
  expect(results).toEqual(items.map(item => item * 10));
  await expect(mapWithBoundedConcurrency(items, 0, async item => item)).rejects.toThrow(/maxConcurrent/);
  expect(await mapWithBoundedConcurrency([], 4, async item => item)).toEqual([]);
 });
 it('requires an actual boolean true before any provider submission', () => {
  expect(isExplicitIndexNowSubmitRequest({confirm:true})).toBe(true);
  for (const confirm of [false, 'true', 'false', 1, 0, null, undefined]) {
   expect(isExplicitIndexNowSubmitRequest({confirm})).toBe(false);
  }
  for (const invalid of [null, [], 'true', true, 1]) {
   expect(isExplicitIndexNowSubmitRequest(invalid)).toBe(false);
  }
 });
 it('accepts one published canonical record in a newer build', () => {
  expect(selectPublishedProof(build,records,queue,current).ok).toBe(true);
 });
 it('rejects older Vercel builds and newer CMS revisions', () => {
  expect(selectPublishedProof('2026-10-28T10:00:00Z',records,queue,current).ok).toBe(false);
  expect(selectPublishedProof(build,records,queue,{...current,updatedAt:'2026-10-28T12:30:00Z'}).ok).toBe(false);
 });
 it('rejects draft, disabled, noindex, duplicates and traversal', () => {
  expect(selectPublishedProof(build,records,queue,{...current,_status:'draft'}).ok).toBe(false);
  expect(selectPublishedProof(build,records,queue,{...current,enabled:false}).ok).toBe(false);
  expect(selectPublishedProof(build,records.map(x=>({...x,noIndex:true})),queue,current).ok).toBe(false);
  expect(selectPublishedProof(build,[...records,...records],queue,current).ok).toBe(false);
  expect(selectPublishedProof(build,records.map(x=>({...x,path:'/tools/../bad'})),queue,current).ok).toBe(false);
 });
 it('rejects invalid timestamps and unsupported collections', () => {
  expect(selectPublishedProof(build,records,{...queue,changedAt:'invalid'},current).ok).toBe(false);
  expect(selectPublishedProof(build,records,{...queue,collectionSlug:'authors'},current).ok).toBe(false);
 });
 it('accepts different attribute order and quoted valid canonical', () => {
  const html='<html><head><link href="'+expected+'" rel="canonical"><meta name="robots" content="index,follow"></head></html>';
  expect(verifyDeployedHtml(html,expected,expected,'text/html; charset=utf-8',null).ok).toBe(true);
 });
 it('rejects noindex, duplicates, redirects and non-html responses', () => {
  const html='<link rel="canonical" href="'+expected+'">';
  expect(verifyDeployedHtml(html,expected,expected,'text/html','noindex').ok).toBe(false);
  expect(verifyDeployedHtml(html+'<meta content="noindex" name="robots">',expected,expected,'text/html',null).ok).toBe(false);
  expect(verifyDeployedHtml(html+html,expected,expected,'text/html',null).ok).toBe(false);
  expect(verifyDeployedHtml(html,expected,expected+'/redirect','text/html',null).ok).toBe(false);
  expect(verifyDeployedHtml(html,expected,expected,'application/json',null).ok).toBe(false);
 });
 it('accepts only document-head canonical evidence, not body or embedded markup', () => {
  const canonical='<link rel="canonical" href="'+expected+'">';
  const good='<html><head>'+canonical+'<meta name="robots" content="index,follow"></head><body>content</body></html>';
  expect(verifyDeployedHtml(good,expected,expected,'text/html',null).ok).toBe(true);
  for (const html of [
    '<html><body>'+canonical+'</body></html>',
    '<html><head></head><body>'+canonical+'</body></html>',
    '<html><head><!-- '+canonical+' --></head><body></body></html>',
    '<html><head><script type="application/json">'+canonical+'</script></head><body></body></html>',
    '<html><head>'+canonical+'</head><head>'+canonical+'</head></html>',
    '<html><body></body><head>'+canonical+'</head></html>',
  ]) expect(verifyDeployedHtml(html,expected,expected,'text/html',null).ok).toBe(false);
  const noindex='<html><head>'+canonical+'<meta name="robots" content="noindex"></head></html>';
  expect(verifyDeployedHtml(noindex,expected,expected,'text/html',null).ok).toBe(false);
 });
 it('rejects robots none and body noindex while ignoring inert markup', () => {
  const canonical='<link rel="canonical" href="'+expected+'">';
  const base=(extra:string)=>'<html><head>'+canonical+'</head><body>'+extra+'</body></html>';
  expect(verifyDeployedHtml(base(''),expected,expected,'text/html','none').ok).toBe(false);
  expect(verifyDeployedHtml(base(''),expected,expected,'text/html','googlebot: none').ok).toBe(false);
  expect(verifyDeployedHtml(base('<meta name="robots" content="none">'),expected,expected,'text/html',null).ok).toBe(false);
  expect(verifyDeployedHtml(base('<meta name="bingbot" content="noindex,follow">'),expected,expected,'text/html',null).ok).toBe(false);
  expect(verifyDeployedHtml(base('<meta name="robots" content="noimageindex">'),expected,expected,'text/html',null).ok).toBe(true);
  expect(verifyDeployedHtml(base('<!-- <meta name="robots" content="none"> -->'),expected,expected,'text/html',null).ok).toBe(true);
  expect(verifyDeployedHtml(base('<script><meta name="robots" content="none"></script>'),expected,expected,'text/html',null).ok).toBe(true);
 });
 it('recognizes unquoted robots attributes and numeric HTML references', () => {
  const canonical='<link rel=canonical href="'+expected+'">';
  const html=(meta:string)=>'<html><head>'+canonical+meta+'</head><body></body></html>';
  expect(verifyDeployedHtml(html(''),expected,expected,'text/html',null).ok).toBe(true);
  expect(verifyDeployedHtml(html('<meta name=robots content=noindex>'),expected,expected,'text/html',null).ok).toBe(false);
  expect(verifyDeployedHtml(html('<meta name=robots content=none>'),expected,expected,'text/html',null).ok).toBe(false);
  expect(verifyDeployedHtml(html('<meta name="robots" content="n&#111;index">'),expected,expected,'text/html',null).ok).toBe(false);
  expect(verifyDeployedHtml(html('<meta name="robots" content="n&#x6f;ne">'),expected,expected,'text/html',null).ok).toBe(false);
  expect(verifyDeployedHtml(html('<meta name="rob&#111;ts" content="none">'),expected,expected,'text/html',null).ok).toBe(false);
  expect(verifyDeployedHtml(html('<meta name=robots content=noimageindex>'),expected,expected,'text/html',null).ok).toBe(true);
 });
 it('requires exact current URL preview approval before submission', () => {
  const urls=['https://www.healthylifesstyles.com/tools/one','https://www.healthylifesstyles.com/tools/two'];
  expect(matchesApprovedIndexNowPreview(urls,urls)).toBe(true);
  expect(matchesApprovedIndexNowPreview([...urls].reverse(),urls)).toBe(true);
  expect(matchesApprovedIndexNowPreview([urls[0]],urls)).toBe(false);
  expect(matchesApprovedIndexNowPreview([urls[0],urls[0]],urls)).toBe(false);
  expect(matchesApprovedIndexNowPreview([...urls,'https://www.healthylifesstyles.com/tools/three'],urls)).toBe(false);
  expect(matchesApprovedIndexNowPreview(null,urls)).toBe(false);
 });

 it('rejects approval when the build or queued revision changed', () => {
  const versions = [{url:expected,changedAt:'2026-10-28T11:00:00Z'}];
  const input={approvedUrls:[expected],approvedVersions:versions,approvedBuildStartedAt:build};
  const snapshot={ready:[expected],readyVersions:versions,buildStartedAt:build};
  expect(matchesApprovedIndexNowSnapshot(input,snapshot)).toBe(true);
  expect(matchesApprovedIndexNowSnapshot(input,{...snapshot,buildStartedAt:'2026-10-28T12:00:00Z'})).toBe(false);
  expect(matchesApprovedIndexNowSnapshot(input,{...snapshot,readyVersions:[{url:expected,changedAt:'2026-10-28T11:01:00Z'}]})).toBe(false);
  expect(matchesApprovedIndexNowSnapshot({...input,approvedVersions:[]},snapshot)).toBe(false);
  expect(matchesApprovedIndexNowSnapshot({...input,approvedUrls:[]},snapshot)).toBe(false);
 });

});
