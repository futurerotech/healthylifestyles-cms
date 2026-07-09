'use client';

import React, { useCallback, useEffect, useState } from 'react';

/**
 * Phase 11 P1 — Schema-flag drift panel on the admin dashboard.
 *
 * Surfaces the read-only reconciliation report (stored isHowTo/isHealthTopic
 * vs the current heuristics) from GET /api/audit/schema-flags/report. Strictly
 * informational: drift is a signal for a human (missed flag vs deliberate
 * editor override), so every row deep-links to the article's edit view and
 * NOTHING is ever auto-fixed. Admin-only — the route 403s editors, and the
 * panel renders nothing for them.
 */

interface DriftRow {
  slug: string;
  id: number | string;
  title: string;
  field: 'isHowTo' | 'isHealthTopic';
  stored: boolean;
  heuristic: boolean;
  reading: string;
}
interface Report {
  scanned: number;
  driftCount: number;
  drift: DriftRow[];
}

const FIELD_LABEL: Record<DriftRow['field'], string> = {
  isHowTo: 'Is HowTo',
  isHealthTopic: 'Is Health Topic',
};

const onOff = (v: boolean) => (v ? 'ON' : 'off');

export const SchemaDriftPanel: React.FC = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false); // 401/403 → not an admin → render nothing
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/audit/schema-flags/report', { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        setHidden(true);
        return;
      }
      if (!res.ok) {
        setError(`Report unavailable (HTTP ${res.status}).`);
        return;
      }
      setReport((await res.json()) as Report);
    } catch {
      setError('Report unavailable (network error).');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (hidden) return null;

  return (
    <div className="hls-bi__card hls-bi__card--span2" style={{ marginTop: '1rem' }}>
      <div className="hls-bi__card-head">
        <h2>Schema-Flag Drift</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {report && <span className="hls-bi__badge">{report.scanned} published scanned</span>}
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="hls-audit__jump"
            style={{ background: 'none', border: 'none', cursor: busy ? 'wait' : 'pointer', padding: 0 }}
          >
            {busy ? 'Checking…' : 'Re-check ↻'}
          </button>
        </div>
      </div>

      {error && <p className="hls-audit__error">{error}</p>}
      {!error && !report && <p style={{ color: 'var(--theme-elevation-500)', fontSize: '0.82rem' }}>Computing drift report…</p>}

      {report && report.driftCount === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--theme-success-500, #16a34a)', fontWeight: 600 }}>
          ✓ No drift — stored isHowTo / isHealthTopic flags match the heuristics on all {report.scanned} published articles.
        </p>
      )}

      {report && report.driftCount > 0 && (
        <>
          <p style={{ fontSize: '0.82rem', color: 'var(--theme-elevation-500)', margin: '0 0 0.5rem' }}>
            {report.driftCount} flag(s) differ from what the current heuristics would set. Drift is a
            signal, not an error — review each article and set the flag deliberately (nothing is auto-fixed).
          </p>
          <table className="hls-audit-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Flag</th>
                <th>Stored</th>
                <th>Heuristic</th>
                <th>Reading</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {report.drift.map((d) => (
                <tr key={`${d.id}-${d.field}`}>
                  <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.slug}>
                    {d.title}
                  </td>
                  <td>{FIELD_LABEL[d.field]}</td>
                  <td>{onOff(d.stored)}</td>
                  <td>{onOff(d.heuristic)}</td>
                  <td className="hls-audit__fix">{d.reading}</td>
                  <td>
                    <a href={`/admin/collections/articles/${d.id}`} className="hls-audit__jump">
                      Review →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};
