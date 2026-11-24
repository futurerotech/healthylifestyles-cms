import { it } from 'vitest';
import assert from 'node:assert/strict';
import { enforceMedicalReview } from './medicalReviewGate';

type Doc = Record<string, unknown>;
const low: Doc = {
  id: 90001, slug: 'synthetic-only', riskLevel: 'low', medicalReviewRequired: false,
  medicallyReviewed: false, reviewedBy: null, enabled: true, _status: 'published',
};
const reviewed: Doc = {
  ...low, riskLevel: 'high', medicalReviewRequired: true, medicallyReviewed: true,
  reviewedBy: 'Synthetic test fixture only',
};
const waiting: Doc = { ...reviewed, enabled: false, medicallyReviewed: false, reviewedBy: null };
const draft: Doc = { ...waiting, enabled: true, _status: 'draft' };
const update = (originalDoc: Doc, data: Doc) => enforceMedicalReview({ operation: 'update', originalDoc, data });
const create = (data: Doc) => enforceMedicalReview({ operation: 'create', data });
const blocked = /requires medical review before/;

for (const [name, original, delta] of [
  ['enable an unreviewed disabled tool', waiting, { enabled: true }],
  ['publish an enabled unreviewed draft', draft, { _status: 'published' }],
  ['reclassify a live low-risk tool', low, { riskLevel: 'high' }],
  ['remove a live attestation', reviewed, { medicallyReviewed: false }],
  ['null out a live attestation', reviewed, { medicallyReviewed: null }],
  ['clear a live reviewer', reviewed, { reviewedBy: null }],
  ['blank out a live reviewer', reviewed, { reviewedBy: '  \t\n' }],
  ['replace a reviewer with an object', reviewed, { reviewedBy: { name: 'fixture' } }],
  ['replace a review checkbox with a string', reviewed, { medicallyReviewed: 'true' }],
  ['publish a required medium-risk draft', { ...draft, riskLevel: 'medium' }, { _status: 'published' }],
  ['clear high-risk requirement while enabling', waiting, { enabled: true, medicalReviewRequired: false }],
  ['publish and supply an incomplete attestation', draft, { _status: 'published', medicallyReviewed: true }],
  ['edit unrelated fields on a live unreviewed high-risk tool', { ...waiting, enabled: true }, { featured: true }],
  ['publish despite an undefined review flag', draft, { _status: 'published', medicallyReviewed: undefined }],
] as [string, Doc, Doc][]) {
  it(`blocks: ${name}`, () => assert.throws(() => update(original, delta), blocked));
}

for (const [name, data] of [
  ['explicit high-risk publication without review', { riskLevel: 'high', enabled: true, _status: 'published' }],
  ['omitted enabled defaults to true', { riskLevel: 'high', _status: 'published' }],
  ['omitted status cannot establish a draft', { riskLevel: 'high' }],
  ['explicit review checkbox without reviewer', { riskLevel: 'high', _status: 'published', medicallyReviewed: true }],
  ['medium-risk tool requiring review', { riskLevel: 'medium', medicalReviewRequired: true, _status: 'published' }],
] as [string, Doc][]) {
  it(`blocks create: ${name}`, () => assert.throws(() => create(data), blocked));
}

it('rejects an update without its original record', () => {
  assert.throws(() => enforceMedicalReview({ operation: 'update', data: { enabled: true } }), /original tool record/);
});
it('rejects malformed risk values before live publication', () => {
  for (const riskLevel of [null, '', 'unknown', ['high'], { value: 'high' }]) {
    assert.throws(() => update(low, { riskLevel }), /valid medical risk level/);
  }
});
it('rejects a non-boolean review requirement before live publication', () => {
  assert.throws(() => update(low, { medicalReviewRequired: 'false' }), /Invalid medical review requirement/);
});
it('forces review-required on a high-risk draft without granting an attestation', () => {
  const delta = { riskLevel: 'high', _status: 'draft', medicalReviewRequired: false };
  assert.deepEqual(create(delta), { ...delta, medicalReviewRequired: true });
});
it('allows a disabled high-risk save and repairs its required flag', () => {
  assert.deepEqual(update(waiting, { medicalReviewRequired: false }), { medicalReviewRequired: true });
});
it('allows disabling an unreviewed published tool', () => {
  assert.deepEqual(update({ ...waiting, enabled: true }, { enabled: false }), { enabled: false, medicalReviewRequired: true });
});
it('allows an explicit draft save without review', () => {
  assert.deepEqual(update({ ...waiting, enabled: true }, { _status: 'draft' }), { _status: 'draft', medicalReviewRequired: true });
});
it('allows a reviewed required record to be enabled', () => {
  assert.deepEqual(update({ ...reviewed, enabled: false }, { enabled: true }), { enabled: true, medicalReviewRequired: true });
});
it('allows publication of a reviewed draft', () => {
  assert.deepEqual(update({ ...reviewed, _status: 'draft' }, { _status: 'published' }), { _status: 'published', medicalReviewRequired: true });
});
it('preserves valid review fields omitted from a partial update', () => {
  assert.deepEqual(update(reviewed, { featured: true }), { featured: true, medicalReviewRequired: true });
});
it('undefined does not erase retained review or safety fields', () => {
  assert.deepEqual(update(reviewed, { riskLevel: undefined, medicallyReviewed: undefined, reviewedBy: undefined, featured: true }), { featured: true, medicalReviewRequired: true });
});
it('accepts an explicitly supplied synthetic attestation, never inventing one', () => {
  const data = { medicallyReviewed: true, reviewedBy: 'Synthetic test fixture only', _status: 'published' };
  assert.deepEqual(update(draft, data), { ...data, medicalReviewRequired: true });
});
it('leaves ordinary low-risk creates and updates unchanged', () => {
  assert.deepEqual(create({ name: 'Synthetic low risk' }), { name: 'Synthetic low risk' });
  assert.deepEqual(update(low, { featured: true }), { featured: true });
});
it('does not mutate the original record or the supplied delta', () => {
  const original = Object.freeze({ ...waiting });
  const delta = Object.freeze({ medicalReviewRequired: false });
  assert.deepEqual(update(original, delta), { medicalReviewRequired: true });
  assert.equal(original.medicalReviewRequired, true);
  assert.equal(delta.medicalReviewRequired, false);
});
