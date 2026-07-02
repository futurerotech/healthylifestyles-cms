'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Site Audit panel on the admin dashboard. Shows the latest scan (health score,
 * severity counts, sortable/filterable issues table) and a "Re-scan site"
 * button that POSTs /api/audit/run and polls the audit doc until it completes.
 * Strictly read-only: issues deep-link to the CMS record ("Fix →") or the live
 * page — nothing is ever auto-edited.
 */

type Severity = 'high' | 'medium' | 'low';
interface Issue {
  severity: Severity;
  category: 'technical' | 'eeat' | 'content' | 'admin';
  page: string;
  message: string;
  fix: string;
  adminPath?: string;
}
interface Audit {
  id: number | string;
  status: 'running' | 'complete' | 'failed';
  healthScore?: number;
  pagesScanned?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  finishedAt?: string;
  error?: string;
  issues?: Issue[];
}

const SEV_COLOR: Record<Severity, string> = { high: '#f43f5e', medium: '#f59e0b', low: '#3b82f6' };
const SEV_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const CAT_LABEL: Record<Issue['category'], string> = { technical: 'Technical', eeat: 'E-E-A-T', content: 'Content', admin: 'Admin UX' };
const scoreColor = (s: number) => (s >= 85 ? '#22c55e' : s >= 60 ? '#f59e0b' : '#f43f5e');

function ScoreRing({ score }: { score: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={`Health score ${score} of 100`}>
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--theme-elevation-100)" strokeWidth="9" />
      <circle
        cx="46" cy="46" r={r} fill="none"
        stroke={scoreColor(score)} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform="rotate(-90 46 46)"
      />
      <text x="46" y="52" textAnchor="middle" style={{ font: '800 22px system-ui', fill: 'currentColor' }}>{score}</text>
    </svg>
  );
}

export function SiteAuditPanel() {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | Issue['category']>('all');
  const [sevFilter, setSevFilter] = useState<'all' | Severity>('all');
  const [sortKey, setSortKey] = useState<'severity' | 'category' | 'page'>('severity');
  const [showAll, setShowAll] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLatest = useCallback(async (): Promise<Audit | null> => {
    try {
      const res = await fetch('/api/site-audits?limit=1&sort=-createdAt&depth=0', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.docs && data.docs[0]) || null;
    } catch {
      return null;
    }
  }, []);

  const startPolling = useCallback((id: number | string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/site-audits/${id}?depth=0`, { credentials: 'include' });
        if (!res.ok) return;
        const doc: Audit = await res.json();
        if (doc.status !== 'running') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setScanning(false);
          setAudit(doc);
          if (doc.status === 'failed') setError(doc.error || 'Scan failed.');
        }
      } catch {}
    }, 5000);
  }, []);

  useEffect(() => {
    void (async () => {
      const latest = await fetchLatest();
      setAudit(latest);
      setLoading(false);
      if (latest?.status === 'running') {
        setScanning(true);
        startPolling(latest.id);
      }
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchLatest, startPolling]);

  const rescan = async () => {
    setError('');
    setScanning(true);
    try {
      const res = await fetch('/api/audit/run', { method: 'post', credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { id } = await res.json();
      startPolling(id);
    } catch (e) {
      setScanning(false);
      setError('Could not start the scan: ' + ((e as Error)?.message || 'unknown'));
    }
  };

  const issues = useMemo(() => {
    const all: Issue[] = Array.isArray(audit?.issues) ? (audit!.issues as Issue[]) : [];
    const filtered = all.filter(
      (i) => (catFilter === 'all' || i.category === catFilter) && (sevFilter === 'all' || i.severity === sevFilter),
    );
    return [...filtered].sort((a, b) =>
      sortKey === 'severity'
        ? SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.page.localeCompare(b.page)
        : sortKey === 'category'
          ? a.category.localeCompare(b.category) || SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
          : a.page.localeCompare(b.page),
    );
  }, [audit, catFilter, sevFilter, sortKey]);

  const shown = showAll ? issues : issues.slice(0, 50);
  const complete = audit?.status === 'complete';

  const chip = (active: boolean, color?: string): React.CSSProperties => ({
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    border: `1px solid ${active ? color || 'var(--theme-elevation-400)' : 'var(--theme-elevation-150)'}`,
    background: active ? `${color || 'var(--theme-elevation-400)'}22` : 'transparent',
    color: 'inherit',
  });
  const tdEllipsis: React.CSSProperties = { maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  return (
    <div className="hls-bi__card hls-bi__card--span2" style={{ marginTop: '1rem' }}>
      <div className="hls-bi__card-head">
        <h2>Site Audit</h2>
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {complete && audit?.finishedAt && (
            <span className="hls-bi__badge">last scan {new Date(audit.finishedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <button type="button" onClick={rescan} disabled={scanning} className="btn btn--style-primary btn--size-small" style={{ margin: 0 }}>
            {scanning ? 'Scanning… (1–3 min)' : 'Re-scan site'}
          </button>
        </span>
      </div>

      {error && <p className="hls-audit__error">{error}</p>}
      {loading ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>Loading…</p>
      ) : !audit ? (
        <p style={{ fontSize: 13, opacity: 0.7 }}>No audit yet — run the first scan to get a health score and a prioritized fix list.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {complete && typeof audit.healthScore === 'number' && <ScoreRing score={audit.healthScore} />}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(['high', 'medium', 'low'] as Severity[]).map((s) => {
                const n = s === 'high' ? audit.highCount : s === 'medium' ? audit.mediumCount : audit.lowCount;
                return (
                  <button key={s} type="button" style={chip(sevFilter === s, SEV_COLOR[s])} onClick={() => setSevFilter(sevFilter === s ? 'all' : s)}>
                    <span style={{ color: SEV_COLOR[s] }}>●</span> {s} · {n ?? 0}
                  </button>
                );
              })}
              {(['technical', 'eeat', 'content', 'admin'] as Issue['category'][]).map((c) => (
                <button key={c} type="button" style={chip(catFilter === c)} onClick={() => setCatFilter(catFilter === c ? 'all' : c)}>
                  {CAT_LABEL[c]}
                </button>
              ))}
              <span style={{ fontSize: 12, opacity: 0.6, alignSelf: 'center' }}>
                {audit.pagesScanned ?? 0} pages scanned{scanning ? ' · scan in progress…' : ''}
              </span>
            </div>
          </div>

          {issues.length === 0 && complete ? (
            <p style={{ fontSize: 13, opacity: 0.7 }}>No issues match the current filter — nice.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="hls-audit-table">
                <thead>
                  <tr>
                    <th onClick={() => setSortKey('severity')}>Severity {sortKey === 'severity' ? '▾' : ''}</th>
                    <th onClick={() => setSortKey('category')}>Category {sortKey === 'category' ? '▾' : ''}</th>
                    <th onClick={() => setSortKey('page')}>Page {sortKey === 'page' ? '▾' : ''}</th>
                    <th style={{ cursor: 'default' }}>Issue → Fix</th>
                    <th style={{ cursor: 'default' }} />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((i, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`hls-sev hls-sev--${i.severity}`}>{i.severity}</span>
                      </td>
                      <td>{CAT_LABEL[i.category]}</td>
                      <td style={tdEllipsis}>
                        {i.page.startsWith('/') && !i.page.includes(',') && !i.page.includes('↔') ? (
                          <a href={i.page} target="_blank" rel="noopener noreferrer" title={i.page}>{i.page}</a>
                        ) : (
                          <span title={i.page}>{i.page}</span>
                        )}
                      </td>
                      <td>
                        <div>{i.message}</div>
                        <div className="hls-audit__fix">{i.fix}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {i.adminPath && <a href={i.adminPath} className="hls-audit__jump">Fix →</a>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {issues.length > 50 && (
                <button type="button" onClick={() => setShowAll(!showAll)} style={{ ...chip(false), marginTop: 8 }}>
                  {showAll ? 'Show top 50' : `Show all ${issues.length} issues`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
