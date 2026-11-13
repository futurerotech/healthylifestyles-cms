// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakeKey = '11111111111111111111111111111111';

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('INDEXNOW_KEY', fakeKey);
  vi.stubEnv('GOOGLE_INDEXING_KEY', JSON.stringify({ client_email: 'unit-test@example.invalid', private_key: 'not-a-real-key' }));
  vi.stubEnv('INDEXNOW_DISABLE', 'false');
  vi.stubEnv('HLS_ISOLATED_STAGING', 'false');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

type Change = {
  status?: string;
  operation?: 'create' | 'update' | 'delete';
  previousStatus?: string;
  queryDraft?: boolean | string;
  context?: Record<string, unknown>;
  slug?: string;
};

async function runChange(change: Change = {}) {
  const send = vi.fn(async () => { throw new Error('Unexpected external network request'); });
  vi.stubGlobal('fetch', send);
  const record = vi.fn(async (_input: { collection: string; data: unknown }) => ({ id: 'synthetic-only' }));
  const request = {
    context: change.context ?? {},
    query: change.queryDraft === undefined ? {} : { draft: change.queryDraft },
    payload: { create: record },
  };
  const doc = { slug: change.slug ?? 'test-article', _status: change.status ?? 'draft' };
  const { afterChangeIndexingHook } = await import('./indexing');
  const result = await afterChangeIndexingHook({
    doc,
    previousDoc: { _status: change.previousStatus ?? 'draft' },
    operation: change.operation ?? 'update',
    collection: { slug: 'articles' },
    req: request,
  } as never);
  return { send, record, result, doc };
}

describe('general afterChange indexing hook: draft-safe fail-closed gate', () => {
  it.each([
    ['new draft create', { status: 'draft', operation: 'create' }],
    ['draft edit', { status: 'draft', operation: 'update' }],
    ['autosave of a previously published article', { status: 'draft', previousStatus: 'published', operation: 'update' }],
    ['explicit REST draft=true while an original published doc remains active', { status: 'published', previousStatus: 'published', queryDraft: 'true' }],
    ['boolean REST draft=true for a published original', { status: 'published', queryDraft: true }],
    ['unpublish of an existing published article', { status: 'draft', previousStatus: 'published' }],
    ['maintenance reseed of published content', { status: 'published', context: { reseedVersions: true } }],
    ['non-write operation', { status: 'published', operation: 'delete' }],
  ])('%s never sends or writes indexing status', async (_name, change) => {
    const { send, record, result, doc } = await runChange(change as Change);
    expect(result).toBe(doc);
    expect(send).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('ignores missing document status (fail closed)', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    const record = vi.fn();
    const { afterChangeIndexingHook } = await import('./indexing');
    const doc = { slug: 'missing-status' };
    expect(await afterChangeIndexingHook({
      doc, operation: 'update', collection: { slug: 'articles' }, req: { payload: { create: record }, query: {} },
    } as never)).toBe(doc);
    expect(send).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('blocks a published update in a specifically isolated Hostinger staging runtime', async () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'true');
    const { send, record } = await runChange({ status: 'published' });
    expect(send).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('blocks all legacy indexing provider submissions and status rows with INDEXNOW_DISABLE', async () => {
    vi.stubEnv('INDEXNOW_DISABLE', 'true');
    const { send, record } = await runChange({ status: 'published' });
    expect(send).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('blocks published updates outside production NODE_ENV even with configured keys', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { send, record } = await runChange({ status: 'published' });
    expect(send).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('keeps intended production published updates indexable with isolated mock network', async () => {
    // A deliberate published edit remains on the existing IndexNow/Google
    // record path; NO external request is actually sent from this test.
    // Keep a configured (synthetic) Google key: the hook must still never use it.
    const send = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', send);
    const record = vi.fn(async (_input: { collection: string; data: unknown }) => ({ id: 'synthetic-only' }));
    const { afterChangeIndexingHook } = await import('./indexing');
    const doc = { slug: 'test-published', _status: 'published' };
    const result = await afterChangeIndexingHook({
      doc,
      previousDoc: { _status: 'published' },
      operation: 'update',
      collection: { slug: 'articles' },
      req: { context: {}, query: {}, payload: { create: record } },
    } as never);
    expect(result).toBe(doc);
    expect(send).toHaveBeenCalledTimes(3);
    expect(record).toHaveBeenCalledTimes(3);
    expect(record.mock.calls.every(([args]) => args.collection === 'indexing-status')).toBe(true);
    expect(record.mock.calls.every(([args]) => (args.data as { engine: string }).engine !== 'google')).toBe(true);
    expect(send.mock.calls.every(([endpoint]) => String(endpoint).startsWith('https://') && !String(endpoint).includes('googleapis.com'))).toBe(true);
  });

  it('keeps intentional first publish on the existing published-only path with mock network', async () => {
    // Keep a configured (synthetic) Google key: the hook must still never use it.
    const send = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', send);
    const record = vi.fn(async (_input: { collection: string; data: unknown }) => ({ id: 'synthetic-only' }));
    const { afterChangeIndexingHook } = await import('./indexing');
    await afterChangeIndexingHook({
      doc: { slug: 'first-publish', _status: 'published' },
      previousDoc: { _status: 'draft' },
      operation: 'update',
      collection: { slug: 'articles' },
      req: { context: {}, query: {}, payload: { create: record } },
    } as never);
    expect(send).toHaveBeenCalledTimes(3);
    expect(record).toHaveBeenCalledTimes(3);
  });

  it('never submits an ordinary published tool to Google Indexing API, even with a configured key', async () => {
    const send = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', send);
    const record = vi.fn(async (_input: { collection: string; data: unknown }) => ({ id: 'synthetic-only' }));
    const { afterChangeIndexingHook } = await import('./indexing');
    const doc = { slug: 'ordinary-tool', _status: 'published' };
    await afterChangeIndexingHook({
      doc,
      previousDoc: { _status: 'draft' },
      operation: 'update',
      collection: { slug: 'tools' },
      req: { context: {}, query: {}, payload: { create: record } },
    } as never);
    expect(send).toHaveBeenCalledTimes(3);
    expect(record).toHaveBeenCalledTimes(3);
    const statuses = record.mock.calls.map(([input]) => input.data as { engine: string; url: string });
    expect(statuses.every(s => s.url.endsWith('/tools/ordinary-tool') && s.engine !== 'google')).toBe(true);
    expect(send.mock.calls.some(([endpoint]) => String(endpoint).includes('googleapis.com'))).toBe(false);
  });
});
