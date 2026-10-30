import { describe, expect, it, vi } from 'vitest';
import { trackPendingChange } from './trackPendingChange';
import { recordPublishedPendingChange } from '../lib/indexnow-pending-queue';

vi.mock('../lib/indexnow-pending-queue', () => ({
  recordPublishedPendingChange: vi.fn(),
}));

const doc = { id: 42, _status: 'published' };
const args = (slug: string, status = 'published') => ({
  req: { payload: { db: {}, logger: { error: vi.fn() } }, transactionID: 123 },
  doc: { ...doc, _status: status },
  collection: { slug },
}) as unknown as Parameters<typeof trackPendingChange>[0];

describe('trackPendingChange fail-closed publishing', () => {
  it('does not queue drafts or unrelated collections', async () => {
    vi.mocked(recordPublishedPendingChange).mockReset();
    await trackPendingChange(args('articles', 'draft'));
    await trackPendingChange(args('categories'));
    expect(recordPublishedPendingChange).not.toHaveBeenCalled();
  });
  it('propagates queue write failure instead of silently publishing', async () => {
    vi.mocked(recordPublishedPendingChange).mockRejectedValueOnce(new Error('mock queue unavailable'));
    const input = args('articles');
    await expect(trackPendingChange(input)).rejects.toThrow('mock queue unavailable');
    expect(input.req.payload.logger.error).toHaveBeenCalledOnce();
  });
  it('returns the document when the queue transaction succeeds', async () => {
    vi.mocked(recordPublishedPendingChange).mockResolvedValueOnce('inserted');
    const input = args('tools');
    await expect(trackPendingChange(input)).resolves.toEqual(input.doc);
    expect(recordPublishedPendingChange).toHaveBeenCalledWith({}, {
      collectionSlug: 'tools', docId: '42', changedAt: expect.any(String),
    }, 123);
  });
});
