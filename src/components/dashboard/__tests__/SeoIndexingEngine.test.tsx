import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { SeoIndexingEngine } from '../SeoIndexingEngine';

/** Build a Response with optional quota header. */
function jsonRes(body: unknown, quotaRemaining?: string): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (quotaRemaining != null) headers['X-GSC-Quota-Remaining'] = quotaRemaining;
  return new Response(JSON.stringify(body), { status: 200, headers });
}

const ARTICLES = [
  { id: '1', title: 'Macro Calculator Guide', url: 'https://site/wellness-hub/macro', updatedAt: '2026-06-01T00:00:00Z' },
  { id: '2', title: 'BMI Explained', url: 'https://site/wellness-hub/bmi', updatedAt: '2026-06-02T00:00:00Z' },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('SeoIndexingEngine', () => {
  it('renders a loading skeleton while the URL list is loading', () => {
    // content-urls never resolves → component stays in the loading state.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    render(<SeoIndexingEngine />);
    expect(screen.getByLabelText('Loading content')).toBeInTheDocument();
  });

  it('renders indexed and not-indexed rows after a scan', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/seo/content-urls')) {
        return jsonRes({ articles: ARTICLES, pages: [], tools: [], total: 2 });
      }
      if (url.includes('/api/seo/check-indexing')) {
        return jsonRes(
          {
            results: [
              { url: ARTICLES[0].url, isIndexed: true, lastCrawled: '2026-06-01T00:00:00Z', coverageState: 'Submitted and indexed', error: null },
              { url: ARTICLES[1].url, isIndexed: false, lastCrawled: null, coverageState: 'Crawled - currently not indexed', error: null },
            ],
          },
          '200',
        );
      }
      return jsonRes({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SeoIndexingEngine />);

    // Rows load from the catalogue first.
    await waitFor(() => expect(screen.getByText('Macro Calculator Guide')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Scan All/i }));

    await waitFor(() => expect(screen.getByText('Indexed')).toBeInTheDocument());
    expect(screen.getByText('Not Indexed')).toBeInTheDocument();
  });

  it('renders LOCAL_VALIDATION as a neutral badge and GOOGLE_API as error style, with checkedAt visible', async () => {
    // Phase 14 P3 — scan-failure taxonomy: locally-skipped URLs must NOT wear
    // the error style (they never reached Google); genuine Google failures must.
    const CHECKED_AT = '2026-07-10T12:00:00Z';
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/seo/content-urls')) {
        return jsonRes({ articles: ARTICLES, pages: [], tools: [], total: 2 });
      }
      if (url.includes('/api/seo/check-indexing')) {
        return jsonRes(
          {
            results: [
              { url: ARTICLES[0].url, isIndexed: false, lastCrawled: null, coverageState: 'Skipped', error: 'Skipped locally: URL is not under the configured GSC property (https://www.healthylifesstyles.com).', source: 'LOCAL_VALIDATION', checkedAt: CHECKED_AT },
              { url: ARTICLES[1].url, isIndexed: false, lastCrawled: null, coverageState: 'Error', error: 'Google API: Inspection failed.', source: 'GOOGLE_API', checkedAt: CHECKED_AT },
            ],
          },
          '198',
        );
      }
      return jsonRes({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SeoIndexingEngine />);
    await waitFor(() => expect(screen.getByText('Macro Calculator Guide')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Scan All/i }));

    // Neutral badge for the locally-skipped row — badge class, NOT the error class.
    const localBadge = await screen.findByText(/Skipped locally: URL is not under/);
    expect(localBadge.className).toContain('seo-badge--unknown');
    expect(localBadge.className).not.toContain('seo-row__err');

    // Distinct error style for the genuine Google failure.
    const googleErr = screen.getByText(/Google API: Inspection failed/);
    expect(googleErr.className).toContain('seo-row__err');
    expect(googleErr.className).not.toContain('seo-badge');

    // Freshness stamp is visible on both rows.
    expect(screen.getAllByText(/· checked /).length).toBe(2);
  });

  it('disables Submit buttons when quota is 0', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/seo/content-urls')) {
        return jsonRes({ articles: [ARTICLES[1]], pages: [], tools: [], total: 1 });
      }
      if (url.includes('/api/seo/check-indexing')) {
        return jsonRes(
          { results: [{ url: ARTICLES[1].url, isIndexed: false, lastCrawled: null, coverageState: 'Crawled - currently not indexed', error: null }] },
          '0', // quota exhausted
        );
      }
      return jsonRes({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SeoIndexingEngine />);
    await waitFor(() => expect(screen.getByText('BMI Explained')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Scan All/i }));

    await waitFor(() => {
      const submit = screen.getByRole('button', { name: /^Submit$/i });
      expect(submit).toBeDisabled();
    });
  });
});
