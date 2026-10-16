// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { AccessArgs, CollectionAfterChangeHook } from 'payload';
import { PendingDeploys } from '../collections/PendingDeploys';
import { trackPendingChange } from '../hooks/trackPendingChange';
import { LeadGen } from '../globals/LeadGen';
import { AdManagement } from '../globals/AdManagement';
import type { Field, FieldAccess } from 'payload';

const accessArgs = (role?: string) => ({ req: { user: role ? { role } : null } }) as AccessArgs;

describe('ad script configuration', () => {
  it.each([undefined, 'editor', 'unknown', 'admin'])('allows only admins to update (%s)', async (role) => {
    expect(await AdManagement.access!.update!(accessArgs(role))).toBe(role === 'admin');
  });
  it('keeps rendered ad configuration public', async () => {
    expect(await AdManagement.access!.read!(accessArgs())).toBe(true);
  });
});

function findField(fields: Field[], name: string): Field | undefined {
  for (const field of fields) {
    if ('name' in field && field.name === name) return field;
    const nested = 'tabs' in field ? field.tabs.flatMap((tab) => tab.fields)
      : 'fields' in field ? field.fields : [];
    const result = findField(nested, name);
    if (result) return result;
  }
}

describe('public lead offers with private integration credentials', () => {
  it('keeps public offers readable', async () => {
    expect(await LeadGen.access!.read!(accessArgs())).toBe(true);
    for (const name of ['enabled', 'successMessage', 'offers']) {
      const field = findField(LeadGen.fields, name);
      expect(field).toBeDefined();
      expect(field && 'access' in field ? field.access?.read : undefined).toBeUndefined();
    }
  });

  it.each(['n8nWebhookUrl', 'n8nApiKey'])('restricts %s reads to admins', async (name) => {
    const field = findField(LeadGen.fields, name);
    const read = field && 'access' in field ? field.access?.read : undefined;
    expect(read).toBeTypeOf('function');
    for (const role of [undefined, 'editor', 'unknown', 'admin']) {
      expect(await read!(accessArgs(role) as Parameters<FieldAccess>[0])).toBe(role === 'admin');
    }
  });
});

describe('machine-managed deployment queue', () => {
  it.each([undefined, 'editor', 'admin'])('denies direct creation for %s', async (role) => {
    expect(await PendingDeploys.access!.create!(accessArgs(role))).toBe(false);
  });

  it('explicitly authorizes the trusted publish hook to create a queue entry', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ totalDocs: 0, docs: [] }),
      create: vi.fn().mockResolvedValue({ id: 1 }),
    };
    const doc = { id: 7, _status: 'published' };
    const args = { req: { payload }, doc, collection: { slug: 'articles' }, operation: 'update' };
    expect(await trackPendingChange(args as unknown as Parameters<CollectionAfterChangeHook>[0])).toBe(doc);
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'pending-deploys', overrideAccess: true,
      data: expect.objectContaining({ docId: '7', collectionSlug: 'articles' }),
    }));
  });

  it('records a second immutable event without overwriting a concurrent queue entry', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ totalDocs: 1, docs: [{ id: 11 }] }),
      update: vi.fn().mockResolvedValue({ id: 11 }),
      create: vi.fn().mockResolvedValue({ id: 12 }),
    };
    const doc = { id: 7, _status: 'published' };
    const args = { req: { payload }, doc, collection: { slug: 'articles' }, operation: 'update' };
    expect(await trackPendingChange(args as unknown as Parameters<CollectionAfterChangeHook>[0])).toBe(doc);
    expect(payload.update).not.toHaveBeenCalled();
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'pending-deploys', overrideAccess: true,
      data: expect.objectContaining({ changedAt: expect.any(String) }),
    }));
  });
});
