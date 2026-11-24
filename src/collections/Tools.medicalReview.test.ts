import { it, vi } from 'vitest';
import assert from 'node:assert/strict';

// Invoke the actual registered collection hook, without importing any external
// integrations or connecting to Payload, storage, or a database. Formula
// tests here verify delegation only; the math engine has its own test suite.
vi.mock('../access/roles', () => ({ isAdminOrEditor: () => true, publishedPublicRead: () => true }));
vi.mock('../fields/slug', () => ({ slugField: () => ({ name: 'slug', type: 'text' }) }));
vi.mock('../fields/seo', () => ({ seoField: { name: 'seo', type: 'group', fields: [] } }));
vi.mock('../lib/formula', () => ({ validateFormula: (expression: string) =>
  expression === 'invalid-fixture' ? { ok: false, error: 'Synthetic formula rejection' } : { ok: true } }));
vi.mock('../hooks/trackPendingChange', () => ({ trackPendingChange: () => { throw new Error('Unexpected side effect'); } }));

import { Tools } from './Tools';
const hook = Tools.hooks?.beforeValidate?.[0];
if (!hook) throw new Error('Tools beforeValidate hook missing');
const originalDoc = {
  id: 90001, enabled: true, _status: 'draft', riskLevel: 'high',
  medicalReviewRequired: true, medicallyReviewed: false, reviewedBy: null,
};
const run = (data: Record<string, unknown>, original: Record<string, unknown> | undefined = originalDoc, operation = 'update') =>
  hook({ data, originalDoc: original, operation } as Parameters<typeof hook>[0]);

it('registered collection hook blocks a partial publish of an unreviewed draft', async () => {
  await assert.rejects(async () => run({ _status: 'published' }), /requires medical review before/);
});
it('registered hook does not grant a review on draft autosave', async () => {
  assert.deepEqual(await run({ featured: true }), { featured: true, medicalReviewRequired: true });
});
it('registered hook blocks enabling an existing unreviewed required record', async () => {
  await assert.rejects(async () => run({ enabled: true }, { ...originalDoc, enabled: false, _status: 'published' }), /requires medical review before/);
});
it('registered hook retains the formula validator rejection on draft saves', async () => {
  await assert.rejects(async () => run({ _status: 'draft', toolType: 'formula', outputs: [{ key: 'sample', expression: 'invalid-fixture' }] }), /Output "sample": Synthetic formula rejection/);
});
it('registered hook keeps the coded-tool formula exception', async () => {
  const data = { _status: 'draft', toolType: 'coded', outputs: [{ key: 'sample', expression: 'invalid-fixture' }] };
  assert.deepEqual(await run(data), { ...data, medicalReviewRequired: true });
});
it('a valid formula is still subject to the medical gate', async () => {
  await assert.rejects(async () => run({ _status: 'published', toolType: 'formula', outputs: [{ key: 'sample', expression: 'x+1' }] }), /requires medical review before/);
});
it('registered hook blocks a new high-risk enabled publication without review', async () => {
  await assert.rejects(async () => hook({ data: { riskLevel: 'high', _status: 'published' }, operation: 'create' } as Parameters<typeof hook>[0]), /requires medical review before/);
});
