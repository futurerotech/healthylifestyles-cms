// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { AccessArgs, FieldAccess, PayloadRequest } from 'payload';
import { PseoPages } from '../collections/PseoPages';
import { PseoTemplates } from '../collections/PseoTemplates';
import { PseoDatasets } from '../collections/PseoDatasets';
import { pseoGenerate } from '../endpoints/pseoGenerate';

const args = (role?: string) => ({ req: { user: role ? { role } : null, query: { where: { status: { equals: 'draft' } }, depth: 10 } } }) as unknown as AccessArgs;

describe('public published pSEO with private generation inputs', () => {
  it.each([undefined, 'editor', 'unknown'])('constrains %s to published, even when the query requests drafts', async (role) => {
    expect(await PseoPages.access!.read!(args(role))).toEqual({ status: { equals: 'published' } });
    for (const operation of ['create', 'update', 'delete'] as const) expect(await PseoPages.access![operation]!(args(role))).toBe(false);
  });
  it('preserves administrator draft and write access', async () => {
    for (const operation of ['read', 'create', 'update', 'delete'] as const) expect(await PseoPages.access![operation]!(args('admin'))).toBe(true);
  });
  it.each(['template', 'dataset', 'keyword', 'variables'])('never exposes private %s through public field selection or relation depth', async (name) => {
    const field = PseoPages.fields.find((field) => 'name' in field && field.name === name);
    const read = field && 'access' in field ? field.access?.read : undefined;
    expect(read).toBeTypeOf('function');
    for (const role of [undefined, 'editor', 'unknown', 'admin']) expect(await read!(args(role) as Parameters<FieldAccess>[0])).toBe(role === 'admin');
  });
  it('keeps templates and datasets private and public rendered fields readable', async () => {
    for (const config of [PseoTemplates, PseoDatasets]) expect(await config.access!.read!(args())).toBe(false);
    for (const name of ['slug', 'status', 'headline', 'subheadline', 'bodyHtml', 'ctaText', 'ctaUrl', 'seo']) {
      const field = PseoPages.fields.find((f) => 'name' in f && f.name === name);
      expect(field).toBeDefined();
      expect(field && 'access' in field ? field.access?.read : undefined).toBeUndefined();
    }
  });
});

describe('pSEO generation endpoint least privilege', () => {
  it.each([undefined, 'editor', 'unknown'])('rejects %s before reading a dataset or publishing anything', async (role) => {
    const findByID = vi.fn(); const json = vi.fn();
    const req = { user: role ? { role } : null, payload: { findByID }, json } as unknown as PayloadRequest;
    const response = await pseoGenerate.handler(req);
    expect(response.status).toBe(role ? 403 : 401);
    expect(findByID).not.toHaveBeenCalled(); expect(json).not.toHaveBeenCalled();
  });
});
