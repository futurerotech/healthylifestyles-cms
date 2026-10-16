// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Payload } from 'payload';
import { seedDefaultOutreachTemplates } from './seed-outreach-templates';

const database = (totalDocs = 0) => ({ count: vi.fn().mockResolvedValue({ totalDocs }), create: vi.fn().mockResolvedValue({}), logger: { info: vi.fn(), warn: vi.fn() } });
describe('initialization preserves database content', () => {
  it.each([
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', ALLOW_DEFAULT_TEMPLATE_SEED: 'true' },
    { NODE_ENV: 'development' },
    { NODE_ENV: 'test' },
    {},
  ])('never queries or writes without explicit nonproduction opt-in: %j', async (env) => {
    const db = database();
    await seedDefaultOutreachTemplates(db as unknown as Payload, env);
    expect(db.count).not.toHaveBeenCalled();
    expect(db.create).not.toHaveBeenCalled();
  });
  it('retains existing templates when development seeding is explicitly requested', async () => {
    const db = database(1);
    await seedDefaultOutreachTemplates(db as unknown as Payload, { NODE_ENV: 'development', ALLOW_DEFAULT_TEMPLATE_SEED: 'true' });
    expect(db.create).not.toHaveBeenCalled();
  });
  it('can initialize an empty explicitly opted-in development database', async () => {
    const db = database();
    await seedDefaultOutreachTemplates(db as unknown as Payload, { NODE_ENV: 'development', ALLOW_DEFAULT_TEMPLATE_SEED: 'true' });
    expect(db.create).toHaveBeenCalledTimes(4);
    for (const [request] of db.create.mock.calls) expect(request.collection).toBe('outreach-templates');
  });
});
