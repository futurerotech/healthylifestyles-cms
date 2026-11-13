import { describe, expect, it } from 'vitest';
import { Tools } from './Tools';

const hook = Tools.hooks?.beforeValidate?.[0];
if (!hook) throw new Error('Original Tools beforeValidate hook is absent');

const published = {
  id: 21, toolType: 'coded', enabled: true, _status: 'published',
  riskLevel: 'high', medicalReviewRequired: true, medicallyReviewed: false,
};
async function invoke(data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | null = null, draft?: boolean | string) {
  return hook({
    data, originalDoc,
    operation: 'update',
    req: { query: draft === undefined ? {} : { draft } },
  } as unknown as Parameters<typeof hook>[0]);
}

describe('Tools original medical review gate - draft and partial publish', () => {
  it.each([true, 'true'] as const)('draft=%s can edit published unreviewed parent without authorizing release', async draft => {
    const data: Record<string, unknown> = { name: 'Unpublished revision', _status: 'published' };
    await expect(invoke(data, published, draft)).resolves.toBe(data);
    expect(data.medicalReviewRequired).toBe(true);
    expect(data.medicallyReviewed).toBeUndefined();
  });
  it('partial live updates inherit original risk and unreviewed status', async () => {
    await expect(invoke({ enabled: true, _status: 'published' }, published)).rejects.toThrow(/requires medical review/);
    await expect(invoke({ name: 'Partial edit' }, published)).rejects.toThrow(/requires medical review/);
  });
  it('draft=false is not a way around a real publish check', async () => {
    const data = { enabled: true, riskLevel: 'high', medicallyReviewed: false, _status: 'published' };
    await expect(invoke(data, null, 'false')).rejects.toThrow(/requires medical review/);
    await expect(invoke(data, null, false)).rejects.toThrow(/requires medical review/);
  });
  it('no published high-risk tool is self-approved by the gate', async () => {
    const data: Record<string, unknown> = { enabled: true, riskLevel: 'high', medicallyReviewed: false, _status: 'published' };
    await expect(invoke(data)).rejects.toThrow(/requires medical review/);
    expect(data.medicalReviewRequired).toBe(true);
    expect(data.medicallyReviewed).toBe(false);
  });
  it('previous allowed genuinely reviewed publish still succeeds', async () => {
    const data = { enabled: true, riskLevel: 'high', medicallyReviewed: true, _status: 'published' };
    await expect(invoke(data)).resolves.toBe(data);
  });
  it('disabled tools and explicit draft records remain editable', async () => {
    await expect(invoke({ enabled: false, _status: 'published' }, published)).resolves.toBeDefined();
    await expect(invoke({ enabled: true, _status: 'draft' }, published)).resolves.toBeDefined();
  });
  it('cannot clear inherited medical review by downgrading an unreviewed live high-risk tool', async () => {
    const data: Record<string, unknown> = {
      enabled: true, _status: 'published', riskLevel: 'low', medicalReviewRequired: false,
    };
    await expect(invoke(data, published)).rejects.toThrow(/requires medical review/);
    expect(data.medicalReviewRequired).toBe(true);
  });
  it('can save a proposed high-to-low reclassification as a draft, without releasing it', async () => {
    const data: Record<string, unknown> = {
      enabled: true, _status: 'published', riskLevel: 'low', medicalReviewRequired: false,
    };
    await expect(invoke(data, published, true)).resolves.toBe(data);
    expect(data.medicalReviewRequired).toBe(true);
    expect(data.medicallyReviewed).toBeUndefined();
  });
  it('draft=true does not disable unsafe expression validation', async () => {
    const data = { enabled: true, _status: 'published', toolType: 'formula',
      outputs: [{ key: 'x', expression: 'process.exit(1)' }] };
    await expect(invoke(data, published, true)).rejects.toThrow(/Output "x":/);
  });
});
