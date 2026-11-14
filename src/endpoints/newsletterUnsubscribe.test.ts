/** Unsubscribe and pre-send check: idempotent, non-revealing, suppression enforced. */
import { describe, it, expect } from 'vitest';
import { applyUnsubscribe, sendCheck, type SubscriberStore } from './newsletterUnsubscribe';
import { createUnsubscribeToken, verifyUnsubscribeToken } from '../lib/newsletter-suppression';

const SECRET = 'test-only-secret-0123456789abcdef-0123'; // not a real secret
const SYNC = 'test-only-sync-secret';
const NOW = Date.UTC(2026, 10, 15);
const env = { UNSUBSCRIBE_TOKEN_SECRET: SECRET, SYNC_SHARED_SECRET: SYNC, SITE_BASE_URL: 'https://www.example.com', SERVER_URL: 'https://cms.example.com' } as NodeJS.ProcessEnv;

function memoryStore() {
  const rows = new Map<string, { id: string; email: string; unsubscribedAt?: string | null }>([
    ['1', { id: '1', email: 'a@example.com' }],
    ['2', { id: '2', email: 'b@example.com', unsubscribedAt: '2026-01-01T00:00:00.000Z' }],
  ]);
  const writes: string[] = [];
  const store: SubscriberStore = {
    async findById(id) { return rows.get(id) ?? null; },
    async findByEmail(email) { return [...rows.values()].find((r) => r.email === email) ?? null; },
    async markUnsubscribed(id, at) { writes.push(String(id)); rows.get(String(id))!.unsubscribedAt = at; },
  };
  return { rows, writes, store };
}

describe('applyUnsubscribe', () => {
  it('suppresses the subscriber once and is idempotent', async () => {
    const m = memoryStore();
    const t = createUnsubscribeToken('1', SECRET, { now: NOW });
    const first = await applyUnsubscribe(t, m.store, SECRET, NOW);
    const again = await applyUnsubscribe(t, m.store, SECRET, NOW);
    expect(first).toEqual(again);
    expect(first.status).toBe(200);
    expect(m.rows.get('1')!.unsubscribedAt).toBe(new Date(NOW).toISOString());
    expect(m.writes).toEqual(['1']);
  });

  it('gives an already-unsubscribed or deleted subscriber the same answer, without writing', async () => {
    const m = memoryStore();
    const fresh = await applyUnsubscribe(createUnsubscribeToken('1', SECRET, { now: NOW }), memoryStore().store, SECRET, NOW);
    const already = await applyUnsubscribe(createUnsubscribeToken('2', SECRET, { now: NOW }), m.store, SECRET, NOW);
    const deleted = await applyUnsubscribe(createUnsubscribeToken('999', SECRET, { now: NOW }), m.store, SECRET, NOW);
    expect(already).toEqual(fresh);
    expect(deleted).toEqual(fresh);
    expect(m.writes).toEqual([]);
    expect(m.rows.get('2')!.unsubscribedAt).toBe('2026-01-01T00:00:00.000Z'); // original opt-out date preserved
  });

  it('rejects invalid or expired tokens and an unconfigured secret without touching data', async () => {
    const m = memoryStore();
    const expired = createUnsubscribeToken('1', SECRET, { now: NOW - 91 * 86_400_000 });
    for (const t of [expired, 'v1.x.y', undefined]) expect((await applyUnsubscribe(t, m.store, SECRET, NOW)).status).toBe(400);
    expect((await applyUnsubscribe(createUnsubscribeToken('1', SECRET, { now: NOW }), m.store, null, NOW)).status).toBe(400);
    expect(m.writes).toEqual([]);
  });

  it('responses never contain an email address', async () => {
    const m = memoryStore();
    const r = await applyUnsubscribe(createUnsubscribeToken('1', SECRET, { now: NOW }), m.store, SECRET, NOW);
    expect(JSON.stringify(r)).not.toMatch(/@/);
  });
});

describe('sendCheck (pre-send suppression for any provider)', () => {
  it('requires both secrets to be configured and the caller to present the sync secret', async () => {
    const m = memoryStore();
    expect((await sendCheck('a@example.com', SYNC, m.store, { ...env, UNSUBSCRIBE_TOKEN_SECRET: '' }, NOW)).status).toBe(503);
    expect((await sendCheck('a@example.com', SYNC, m.store, { ...env, SYNC_SHARED_SECRET: '' }, NOW)).status).toBe(503);
    expect((await sendCheck('a@example.com', null, m.store, env, NOW)).status).toBe(401);
    expect((await sendCheck('a@example.com', 'wrong', m.store, env, NOW)).status).toBe(401);
    expect((await sendCheck('not-an-email', SYNC, m.store, env, NOW)).status).toBe(400);
  });

  it('blocks suppressed and unknown addresses with the same answer', async () => {
    const m = memoryStore();
    const suppressed = await sendCheck('b@example.com', SYNC, m.store, env, NOW);
    const unknown = await sendCheck('nobody@example.com', SYNC, m.store, env, NOW);
    expect(suppressed).toEqual({ status: 200, body: { ok: true, sendable: false } });
    expect(unknown).toEqual(suppressed);
  });

  it('returns working links for a sendable address; using one suppresses later sends', async () => {
    const m = memoryStore();
    const r = await sendCheck(' A@Example.com ', SYNC, m.store, env, NOW);
    expect(r.body).toMatchObject({ ok: true, sendable: true });
    const page = new URL((r.body as any).unsubscribeUrl);
    const oneClick = new URL((r.body as any).oneClickUrl);
    expect(page.origin + page.pathname).toBe('https://www.example.com/unsubscribe');
    expect(oneClick.origin + oneClick.pathname).toBe('https://cms.example.com/api/subscriber-unsubscribe');
    const t = page.searchParams.get('t')!;
    expect(t).toBe(oneClick.searchParams.get('t'));
    expect(verifyUnsubscribeToken(t, SECRET, { now: NOW })).toEqual({ ok: true, subscriberId: '1' });
    expect(r.body).not.toHaveProperty('email');
    await applyUnsubscribe(t, m.store, SECRET, NOW + 1000);
    expect((await sendCheck('a@example.com', SYNC, m.store, env, NOW + 2000)).body).toEqual({ ok: true, sendable: false });
  });
});
