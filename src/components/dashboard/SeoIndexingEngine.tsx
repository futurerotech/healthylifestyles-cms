'use client';
import React from 'react';

/**
 * SEO Indexing Engine dashboard panel.
 *
 * Self-contained: on mount it loads the content-URL catalogue; "Scan All" then
 * batches indexing-status checks (groups of 10, 300ms apart) against the GSC
 * URL Inspection API; rows can be submitted to the Indexing API individually or
 * in bulk (with a confirm dialog). A live quota bar reflects the daily publish
 * quota returned by the API. Drives a small state machine via useReducer.
 */

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 300;
const QUOTA_LIMIT = 200; // daily Indexing API publish quota (free tier)

type Status = 'idle' | 'loading' | 'scanning' | 'scan_complete' | 'submitting' | 'done' | 'scan_error';
type ContentType = 'article' | 'page' | 'tool';
type IndexState = 'unknown' | 'indexed' | 'not-indexed';
type Filter = 'all' | IndexState;
type SortCol = 'title' | 'status' | 'lastCrawled' | 'type';

interface Row {
  id: string;
  title: string;
  url: string;
  type: ContentType;
  state: IndexState;
  lastCrawled: string | null;
  coverageState: string;
  error: string | null;
  submitting: boolean;
  submitMessage: string | null;
}
interface Quota {
  used: number;
  remaining: number;
  limit: number;
}
interface State {
  status: Status;
  rows: Row[];
  quota: Quota;
  filter: Filter;
  sortCol: SortCol;
  sortDir: 'asc' | 'desc';
  error: string | null;
}

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_DONE'; rows: Row[] }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'SCAN_START' }
  | { type: 'CHECK_RESULT'; results: { url: string; isIndexed: boolean; lastCrawled: string | null; coverageState: string; error: string | null }[] }
  | { type: 'SCAN_DONE' }
  | { type: 'SCAN_ERROR'; error: string }
  | { type: 'QUOTA'; quota: Partial<Quota> }
  | { type: 'SET_FILTER'; filter: Filter }
  | { type: 'SET_SORT'; col: SortCol }
  | { type: 'ROW_SUBMIT_START'; url: string }
  | { type: 'ROW_SUBMIT_DONE'; url: string; message: string }
  | { type: 'ROW_SUBMIT_ERROR'; url: string; message: string }
  | { type: 'BATCH_SUBMIT_START' }
  | { type: 'BATCH_SUBMIT_DONE'; submitted: string[]; failed: { url: string; reason: string }[] };

const initialState: State = {
  status: 'idle',
  rows: [],
  quota: { used: 0, remaining: QUOTA_LIMIT, limit: QUOTA_LIMIT },
  filter: 'all',
  sortCol: 'type',
  sortDir: 'asc',
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, status: 'loading', error: null };
    case 'LOAD_DONE':
      return { ...state, status: 'idle', rows: action.rows };
    case 'LOAD_ERROR':
      return { ...state, status: 'scan_error', error: action.error };
    case 'SCAN_START':
      return { ...state, status: 'scanning', error: null };
    case 'CHECK_RESULT': {
      const byUrl = new Map(action.results.map((r) => [r.url, r]));
      return {
        ...state,
        rows: state.rows.map((row) => {
          const r = byUrl.get(row.url);
          if (!r) return row;
          return {
            ...row,
            state: r.error ? 'unknown' : r.isIndexed ? 'indexed' : 'not-indexed',
            lastCrawled: r.lastCrawled,
            coverageState: r.coverageState,
            error: r.error,
          };
        }),
      };
    }
    case 'SCAN_DONE':
      return { ...state, status: 'scan_complete' };
    case 'SCAN_ERROR':
      return { ...state, status: 'scan_error', error: action.error };
    case 'QUOTA': {
      const remaining = action.quota.remaining ?? state.quota.remaining;
      const limit = action.quota.limit ?? state.quota.limit;
      const used = action.quota.used ?? Math.max(0, limit - remaining);
      return { ...state, quota: { used, remaining, limit } };
    }
    case 'SET_FILTER':
      return { ...state, filter: action.filter };
    case 'SET_SORT':
      return {
        ...state,
        sortCol: action.col,
        sortDir: state.sortCol === action.col && state.sortDir === 'asc' ? 'desc' : 'asc',
      };
    case 'ROW_SUBMIT_START':
      return { ...state, rows: state.rows.map((r) => (r.url === action.url ? { ...r, submitting: true, submitMessage: null } : r)) };
    case 'ROW_SUBMIT_DONE':
      return { ...state, rows: state.rows.map((r) => (r.url === action.url ? { ...r, submitting: false, submitMessage: action.message } : r)) };
    case 'ROW_SUBMIT_ERROR':
      return { ...state, rows: state.rows.map((r) => (r.url === action.url ? { ...r, submitting: false, submitMessage: action.message } : r)) };
    case 'BATCH_SUBMIT_START':
      return { ...state, status: 'submitting' };
    case 'BATCH_SUBMIT_DONE': {
      const ok = new Set(action.submitted);
      const failMap = new Map(action.failed.map((f) => [f.url, f.reason]));
      return {
        ...state,
        status: 'done',
        rows: state.rows.map((r) =>
          ok.has(r.url) ? { ...r, submitMessage: 'Submitted ✓' } : failMap.has(r.url) ? { ...r, submitMessage: failMap.get(r.url) || 'Failed' } : r,
        ),
      };
    }
    default:
      return state;
  }
}

const TYPE_LABEL: Record<ContentType, string> = { article: 'Articles', page: 'Pages', tool: 'Tools' };
const STATE_LABEL: Record<IndexState, string> = { indexed: 'Indexed', 'not-indexed': 'Not Indexed', unknown: 'Unknown' };

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const SeoIndexingEngine: React.FC = () => {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const [isPending, startTransition] = React.useTransition();

  // Load the URL catalogue on mount (no GSC quota cost).
  React.useEffect(() => {
    let alive = true;
    dispatch({ type: 'LOAD_START' });
    (async () => {
      try {
        const res = await fetch('/api/seo/content-urls', { credentials: 'include' });
        if (!res.ok) throw new Error(`Failed to load content (${res.status}).`);
        const data = await res.json();
        const toRows = (arr: { id: string; title: string; url: string; updatedAt: string }[], type: ContentType): Row[] =>
          (arr || []).map((d) => ({
            id: d.id,
            title: d.title || d.url,
            url: d.url,
            type,
            state: 'unknown' as IndexState,
            lastCrawled: null,
            coverageState: '',
            error: null,
            submitting: false,
            submitMessage: null,
          }));
        const rows = [...toRows(data.articles, 'article'), ...toRows(data.pages, 'page'), ...toRows(data.tools, 'tool')];
        if (alive) dispatch({ type: 'LOAD_DONE', rows });
      } catch (e) {
        if (alive) dispatch({ type: 'LOAD_ERROR', error: e instanceof Error ? e.message : 'Failed to load content.' });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const applyQuotaHeader = React.useCallback((res: Response) => {
    const remaining = res.headers.get('X-GSC-Quota-Remaining');
    if (remaining != null && remaining !== '') {
      dispatch({ type: 'QUOTA', quota: { remaining: Number(remaining), limit: QUOTA_LIMIT } });
    }
  }, []);

  async function scanAll() {
    if (state.status === 'scanning' || state.rows.length === 0) return;
    dispatch({ type: 'SCAN_START' });
    try {
      const urls = state.rows.map((r) => r.url);
      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const res = await fetch('/api/seo/check-indexing', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: batch }),
        });
        applyQuotaHeader(res);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Scan failed (${res.status}).`);
        }
        const data = await res.json();
        dispatch({ type: 'CHECK_RESULT', results: data.results || [] });
        if (i + BATCH_SIZE < urls.length) await delay(BATCH_DELAY_MS);
      }
      dispatch({ type: 'SCAN_DONE' });
    } catch (e) {
      dispatch({ type: 'SCAN_ERROR', error: e instanceof Error ? e.message : 'Scan failed.' });
    }
  }

  async function submitOne(url: string) {
    if (state.quota.remaining <= 0) return;
    dispatch({ type: 'ROW_SUBMIT_START', url });
    try {
      const res = await fetch('/api/seo/submit-indexing', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url], type: 'URL_UPDATED' }),
      });
      applyQuotaHeader(res);
      const data = await res.json().catch(() => ({}));
      if (data?.quota) dispatch({ type: 'QUOTA', quota: { used: data.quota.used, remaining: data.quota.remaining, limit: QUOTA_LIMIT } });
      if (!res.ok) {
        dispatch({ type: 'ROW_SUBMIT_ERROR', url, message: data?.error || `Failed (${res.status}).` });
        return;
      }
      const ok = Array.isArray(data.submitted) && data.submitted.includes(url);
      dispatch(ok ? { type: 'ROW_SUBMIT_DONE', url, message: 'Submitted ✓' } : { type: 'ROW_SUBMIT_ERROR', url, message: data?.failed?.[0]?.reason || 'Failed.' });
    } catch (e) {
      dispatch({ type: 'ROW_SUBMIT_ERROR', url, message: e instanceof Error ? e.message : 'Failed.' });
    }
  }

  async function submitAllNotIndexed() {
    const targets = state.rows.filter((r) => r.state === 'not-indexed').map((r) => r.url);
    if (targets.length === 0) return;
    const ok = window.confirm(`Submit ${targets.length} URL${targets.length === 1 ? '' : 's'} for indexing? (${state.quota.remaining} quota remaining)`);
    if (!ok) return;
    dispatch({ type: 'BATCH_SUBMIT_START' });
    try {
      const res = await fetch('/api/seo/submit-indexing', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: targets.slice(0, 100), type: 'URL_UPDATED' }),
      });
      applyQuotaHeader(res);
      const data = await res.json().catch(() => ({}));
      if (data?.quota) dispatch({ type: 'QUOTA', quota: { used: data.quota.used, remaining: data.quota.remaining, limit: QUOTA_LIMIT } });
      dispatch({ type: 'BATCH_SUBMIT_DONE', submitted: data.submitted || [], failed: data.failed || [] });
    } catch (e) {
      dispatch({ type: 'SCAN_ERROR', error: e instanceof Error ? e.message : 'Submit failed.' });
    }
  }

  // ---- derived view ----
  const counts = {
    indexed: state.rows.filter((r) => r.state === 'indexed').length,
    'not-indexed': state.rows.filter((r) => r.state === 'not-indexed').length,
    unknown: state.rows.filter((r) => r.state === 'unknown').length,
  };
  const notIndexedCount = counts['not-indexed'];

  const visible = state.rows
    .filter((r) => state.filter === 'all' || r.state === state.filter)
    .sort((a, b) => {
      const dir = state.sortDir === 'asc' ? 1 : -1;
      const get = (r: Row): string =>
        state.sortCol === 'title' ? r.title : state.sortCol === 'status' ? r.state : state.sortCol === 'lastCrawled' ? r.lastCrawled || '' : r.type;
      return get(a).localeCompare(get(b)) * dir;
    });

  const grouped: Record<ContentType, Row[]> = { article: [], page: [], tool: [] };
  for (const r of visible) grouped[r.type].push(r);

  const quotaPct = Math.min(100, Math.round((state.quota.used / state.quota.limit) * 100));
  const quotaTone = quotaPct >= 90 ? 'danger' : quotaPct >= 75 ? 'warn' : 'ok';
  const scanning = state.status === 'scanning';
  const loading = state.status === 'loading';
  const submitting = state.status === 'submitting';
  const quotaEmpty = state.quota.remaining <= 0;

  return (
    <section className="seo-engine" aria-label="SEO Indexing Engine">
      <header className="seo-engine__head">
        <div>
          <h2 className="seo-engine__title">SEO Indexing Engine</h2>
          <p className="seo-engine__sub">{state.rows.length} URLs · {counts.indexed} indexed · {notIndexedCount} not indexed</p>
        </div>
        <div className="seo-engine__head-actions">
          <button type="button" className="seo-btn seo-btn--primary" onClick={() => startTransition(() => { void scanAll(); })} disabled={scanning || loading || state.rows.length === 0}>
            {scanning ? 'Scanning…' : 'Scan All ▶'}
          </button>
          <button type="button" className="seo-btn seo-btn--primary" onClick={() => void submitAllNotIndexed()} disabled={submitting || quotaEmpty || notIndexedCount === 0}>
            Scan &amp; Submit All Not-Indexed
          </button>
        </div>
      </header>

      {/* Quota bar */}
      <div className="seo-quota" aria-label="Daily indexing quota">
        <div className="seo-quota__track">
          <div className={`seo-quota__fill seo-quota__fill--${quotaTone}`} style={{ width: `${quotaPct}%` }} />
        </div>
        <span className="seo-quota__label">Quota: {state.quota.used} / {state.quota.limit} used today</span>
      </div>

      {/* Filters */}
      <div className="seo-filters" role="group" aria-label="Filter by status">
        {(['all', 'indexed', 'not-indexed', 'unknown'] as Filter[]).map((f) => (
          <button key={f} type="button" className={`seo-chip${state.filter === f ? ' seo-chip--active' : ''}`} onClick={() => dispatch({ type: 'SET_FILTER', filter: f })}>
            {f === 'all' ? 'All' : `${f === 'indexed' ? '🟢' : f === 'not-indexed' ? '🔴' : '⚪'} ${STATE_LABEL[f as IndexState]}`}
            {f !== 'all' && <span className="seo-chip__count"> {counts[f as IndexState]}</span>}
          </button>
        ))}
      </div>

      {state.error && <p className="seo-engine__error" role="alert">{state.error}</p>}

      {/* Sort header */}
      <div className="seo-sorthead">
        {(['title', 'status', 'lastCrawled', 'type'] as SortCol[]).map((c) => (
          <button key={c} type="button" className="seo-sorthead__btn" onClick={() => dispatch({ type: 'SET_SORT', col: c })}>
            {c === 'title' ? 'Title' : c === 'status' ? 'Status' : c === 'lastCrawled' ? 'Last Crawled' : 'Type'}
            {state.sortCol === c ? (state.sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="seo-skeleton" aria-label="Loading content" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="seo-skeleton__row" />
          ))}
        </div>
      )}

      {/* Grouped rows */}
      {!loading &&
        (Object.keys(grouped) as ContentType[]).map((type) =>
          grouped[type].length === 0 ? null : (
            <div key={type} className="seo-group">
              <h3 className="seo-group__title">
                {TYPE_LABEL[type]} ({grouped[type].length})
              </h3>
              <ul className="seo-rows">
                {grouped[type].map((row) => (
                  <li key={row.id} className="seo-row">
                    <div className="seo-row__main">
                      <a className="seo-row__url" href={row.url} target="_blank" rel="noopener noreferrer">
                        {row.title}
                      </a>
                      <span className={`seo-badge seo-badge--${row.state}`}>{STATE_LABEL[row.state]}</span>
                      <button
                        type="button"
                        className="seo-btn seo-btn--sm seo-btn--primary"
                        onClick={() => void submitOne(row.url)}
                        disabled={row.submitting || submitting || quotaEmpty}
                      >
                        {row.submitting ? 'Submitting…' : 'Submit'}
                      </button>
                    </div>
                    <div className="seo-row__meta">
                      <span>Last crawled: {fmtDate(row.lastCrawled)}</span>
                      {row.coverageState && row.state !== 'unknown' && <span> · {row.coverageState}</span>}
                      {row.error && <span className="seo-row__err"> · {row.error}</span>}
                      {row.submitMessage && <span className="seo-row__msg"> · {row.submitMessage}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}

      {!loading && state.rows.length === 0 && !state.error && <p className="seo-engine__empty">No content URLs found.</p>}
    </section>
  );
};

export default SeoIndexingEngine;
