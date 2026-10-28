import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeployButton from '../DeployButton';

const mockUser = vi.hoisted(() => ({ role: 'admin' as string }));
const notices = vi.hoisted(() => ({
  loading: vi.fn(() => 'toast-loading'),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({ user: mockUser }),
  toast: notices,
  Button: (props: {
    children?: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    'aria-label'?: string;
  }) => React.createElement('button', {
    disabled: props.disabled,
    onClick: props.onClick,
    'aria-label': props['aria-label'],
    type: 'button',
  }, props.children),
}));

const URL = 'https://www.healthylifesstyles.com/wellness-hub/test-guide';
const preview = {
  dryRun: true,
  ready: [URL],
  readyVersions: [{ url: URL, changedAt: '2026-10-28T12:01:00Z' }],
  deferred: [{ id: 2, reason: 'Vercel build older than content' }],
  buildStartedAt: '2026-10-28T12:10:00Z',
  queuedTotal: 2,
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mockUser.role = 'admin';
});

describe('DeployButton IndexNow preview-and-approve workflow', () => {
  it('keeps IndexNow action hidden from non-admins', () => {
    mockUser.role = 'editor';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<DeployButton />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only previews URLs and never submits without affirmative consent', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input);
      if (path.includes('/api/deploy/pending')) return json({ count: 2 });
      if (path.includes('/api/seo/reconcile-indexnow')) {
        expect(JSON.parse(String(options?.body))).toEqual({ confirm: false });
        return json(preview);
      }
      throw new Error('Unexpected network call ' + path);
    });
    vi.stubGlobal('fetch', fetchMock);
    const confirmMock = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmMock);

    render(<DeployButton />);
    await waitFor(() => expect(screen.getByText('Deploy site (2 pending)')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Submit approved IndexNow URLs' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Preview IndexNow URLs' }));
    await waitFor(() => expect(screen.getByText(URL)).toBeInTheDocument());
    expect(screen.getByText(/1 verified URL\(s\), 1 deferred/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit approved IndexNow URLs' }));
    expect(confirmMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.filter(([path]) => String(path).includes('reconcile-indexnow'))).toHaveLength(1);
  });

  it('submits only the exact preview revision and build after an explicit confirmation', async () => {
    const submitted: unknown[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input);
      if (path.includes('/api/deploy/pending')) return json({ count: 1 });
      if (path.includes('/api/seo/reconcile-indexnow')) {
        const body = JSON.parse(String(options?.body)) as Record<string, unknown>;
        if (body.confirm === false) return json(preview);
        submitted.push(body);
        return json({ acknowledged: [URL] });
      }
      throw new Error('Unexpected network call ' + path);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<DeployButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview IndexNow URLs' }));
    await waitFor(() => expect(screen.getByText(URL)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Submit approved IndexNow URLs' }));
    await waitFor(() => expect(submitted).toHaveLength(1));
    expect(submitted[0]).toEqual({
      confirm: true,
      approvedUrls: preview.ready,
      approvedVersions: preview.readyVersions,
      approvedBuildStartedAt: preview.buildStartedAt,
    });
    await waitFor(() => expect(notices.success).toHaveBeenCalledWith(
      '1 URL(s) acknowledged by IndexNow. Indexing is not guaranteed.',
    ));
    expect(screen.queryByRole('button', { name: 'Submit approved IndexNow URLs' })).not.toBeInTheDocument();
  });

  it('reports rejection and never retries a real submission automatically', async () => {
    let submitCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input);
      if (path.includes('/api/deploy/pending')) return json({ count: 1 });
      if (path.includes('/api/seo/reconcile-indexnow')) {
        const body = JSON.parse(String(options?.body)) as { confirm: boolean };
        if (!body.confirm) return json(preview);
        submitCount++;
        return json({ error: 'Preview URLs changed or not approved.' }, 409);
      }
      throw new Error('Unexpected network call ' + path);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<DeployButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview IndexNow URLs' }));
    await waitFor(() => expect(screen.getByText(URL)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Submit approved IndexNow URLs' }));
    await waitFor(() => expect(notices.error).toHaveBeenCalledWith('Preview URLs changed or not approved.'));
    expect(submitCount).toBe(1);
    expect(screen.queryByRole('button', { name: 'Submit approved IndexNow URLs' })).not.toBeInTheDocument();
  });

  it('labels dry-run simulation honestly and never claims URL acceptance', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input);
      if (path.includes('/api/deploy/pending')) return json({ count: 1 });
      if (path.includes('/api/seo/reconcile-indexnow')) {
        const body = JSON.parse(String(options?.body)) as {confirm:boolean};
        return body.confirm ? json({ simulation: true, dryRun: true,
          message: 'IndexNow simulation: no provider request and no queue deletion.' }) : json(preview);
      }
      throw new Error('Unexpected request');
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<DeployButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview IndexNow URLs' }));
    await waitFor(() => expect(screen.getByText(URL)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Submit approved IndexNow URLs' }));
    await waitFor(() => expect(notices.success).toHaveBeenCalledWith(
      'IndexNow simulation: no provider request and no queue deletion.',
    ));
    expect(notices.success).not.toHaveBeenCalledWith(expect.stringContaining('acknowledged by IndexNow'));
  });

  it('leaves send disabled when nothing was verified for deployment', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/deploy/pending')) return json({ count: 0 });
      return json({ ...preview, ready: [], readyVersions: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<DeployButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview IndexNow URLs' }));
    await waitFor(() => expect(screen.getByText(/0 verified URL\(s\)/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Submit approved IndexNow URLs' })).not.toBeInTheDocument();
  });
});