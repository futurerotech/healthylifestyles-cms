import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: null as null | { id: number; role: string },
  execute: vi.fn(), authorize: vi.fn(), cancel: vi.fn(),
}));
vi.mock('payload', () => ({ getPayload: async () => ({
  auth: async () => ({ user: state.user }),
  db: { drizzle: {}, execute: state.execute },
}) }));
vi.mock('@payload-config', () => ({ default: {} }));
vi.mock('@/lib/allowedOrigins', () => ({
  isAllowedIndexNowPreviewOrigin: (origin: string | null) => origin === 'https://cms.example.test',
  ISOLATED_STAGING_CMS_ORIGIN: null,
}));
vi.mock('@/lib/indexnow-attempts', () => ({
  authorizeIndexNowRetry: state.authorize, cancelReservedIndexNowAttempt: state.cancel,
}));

import { POST } from '../../src/app/api/seo/indexnow-attempts/route';

function request(body: unknown, origin = 'https://cms.example.test') {
  return new Request('https://cms.example.test/api/seo/indexnow-attempts', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
beforeEach(() => { state.user = null; vi.clearAllMocks(); });

describe('IndexNow attempt review authorization (mocked Payload)', () => {
  it('rejects foreign origins, anonymous users and editors before any DB operation', async () => {
    expect((await POST(request({ action: 'list' }, 'https://attacker.example'))).status).toBe(403);
    expect((await POST(request({ action: 'list' }))).status).toBe(403);
    state.user = { id: 1, role: 'editor' };
    expect((await POST(request({ action: 'list' }))).status).toBe(403);
    expect(state.execute).not.toHaveBeenCalled();
    expect(state.authorize).not.toHaveBeenCalled();
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it('lists attempts for an administrator without a review mutation', async () => {
    state.user = { id: 5, role: 'admin' };
    state.execute.mockResolvedValueOnce({ rows: [{ id: 'synthetic', state: 'unknown', items: [] }] });
    const response = await POST(request({ action: 'list' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ attempts: [{ id: 'synthetic', state: 'unknown' }] });
    expect(state.authorize).not.toHaveBeenCalled();
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it('requires explicit risk acknowledgement and a complete reviewed snapshot', async () => {
    state.user = { id: 5, role: 'admin' };
    const item = { id: 7, changedAt: '2026-11-11T10:00:00Z', url: 'https://www.healthylifesstyles.com/tools/bmr-calculator' };
    expect((await POST(request({ action: 'authorize_retry', attemptId: 'x', items: [item] }))).status).toBe(400);
    expect(state.authorize).not.toHaveBeenCalled();
    state.authorize.mockResolvedValueOnce('not_reviewable');
    expect((await POST(request({ action: 'authorize_retry', attemptId: 'x', confirmRisk: true, items: [item] }))).status).toBe(409);
    expect(state.authorize).toHaveBeenCalledOnce();
  });

  it('does not invoke a provider request while reviewing or cancelling', async () => {
    state.user = { id: 5, role: 'admin' };
    const remote = vi.spyOn(globalThis, 'fetch');
    state.cancel.mockResolvedValueOnce(true);
    const result = await POST(request({ action: 'cancel_reserved', attemptId: 'synthetic', confirm: true }));
    expect(result.status).toBe(200);
    expect(state.cancel).toHaveBeenCalledOnce();
    expect(remote).not.toHaveBeenCalled();
    remote.mockRestore();
  });
});
