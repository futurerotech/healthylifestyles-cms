import { describe, expect, it } from 'vitest';
import { selectPublishedProof, verifyDeployedHtml, matchesApprovedIndexNowPreview, matchesApprovedIndexNowSnapshot, isExplicitIndexNowSubmitRequest, mapWithBoundedConcurrency } from './indexnow-postdeploy';

const records = [{ collection:'articles', docId:'69', path:'/wellness-hub/example-guide',
 updatedAt:'2026-10-28T12:00:00Z', noIndex:false }];
const queue = { collectionSlug:'articles', docId:'69', changedAt:'2026-10-28T11:00:00Z' };
const current = { _status:'published', updatedAt:'2026-10-28T11:00:00Z', seo:{ noIndex:false } };
const build = '2026-10-28T11:30:00Z';
const expected='https://www.healthylifesstyles.com/wellness-hub/example-guide';

describe('post-deploy IndexNow safety gates', () => {
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
