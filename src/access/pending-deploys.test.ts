// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AccessArgs } from 'payload';
import { PendingDeploys } from '../collections/PendingDeploys';

const args = (role?: string) => ({
  req: { user: role ? { role } : null },
}) as unknown as AccessArgs;

describe('machine-owned pending deploy queue access', () => {
  it.each([undefined, 'editor', 'unknown'])('denies queue read to %s', async role => {
    expect(await PendingDeploys.access!.read!(args(role))).toBe(false);
  });
  it('permits admin read-only inspection', async () => {
    expect(await PendingDeploys.access!.read!(args('admin'))).toBe(true);
  });
  it.each([undefined, 'editor', 'admin', 'unknown'])('blocks API mutations for %s', async role => {
    for (const action of ['create', 'update', 'delete'] as const) {
      expect(await PendingDeploys.access![action]!(args(role))).toBe(false);
    }
  });
});
