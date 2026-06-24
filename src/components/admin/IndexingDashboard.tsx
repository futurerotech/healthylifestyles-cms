'use client';

import React, { useEffect, useState } from 'react';

interface StatusRecord {
  id: string;
  engine: string;
  docType: string;
  docSlug: string;
  url: string;
  status: 'success' | 'failed' | 'pending';
  httpStatus?: number;
  error?: string | null;
  submittedAt: string;
}

interface AggStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  byEngine: Record<string, { total: number; success: number }>;
}

function agg(records: StatusRecord[]): AggStats {
  const stats: AggStats = { total: 0, success: 0, failed: 0, pending: 0, byEngine: {} };
  for (const r of records) {
    stats.total++;
    if (r.status === 'success') stats.success++;
    else if (r.status === 'failed') stats.failed++;
    else stats.pending++;

    if (!stats.byEngine[r.engine]) stats.byEngine[r.engine] = { total: 0, success: 0 };
    stats.byEngine[r.engine].total++;
    if (r.status === 'success') stats.byEngine[r.engine].success++;
  }
  return stats;
}

const ENGINE_LABELS: Record<string, string> = {
  'https://api.indexnow.org/indexnow': 'IndexNow (auto)',
  'https://www.bing.com/indexnow': 'Bing',
  'https://search.yandex.com/indexnow': 'Yandex',
  'google': 'Google',
};

export const IndexingDashboard: React.FC = () => {
  const [records, setRecords] = useState<StatusRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/indexing-status?limit=100&sort=-submittedAt&depth=0')
      .then((r) => r.json())
      .then((data) => setRecords(data?.docs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = agg(records);
  const latest = records.slice(0, 50);

  const pct = (n: number) => (stats.total > 0 ? Math.round((n / stats.total) * 100) : 0);

  if (loading) {
    return <div className="hls-idx__loading">Loading indexing health…</div>;
  }

  return (
    <div className="hls-idx">
      <div className="hls-idx__header">
        <span className="hls-idx__title">Indexing Health</span>
        <span className="hls-idx__count">{stats.total} pings</span>
      </div>

      <div className="hls-idx__stats">
        <div className="hls-idx__stat hls-idx__stat--ok">
          <span className="hls-idx__stat-num">{stats.success}</span>
          <span className="hls-idx__stat-label">Success ({pct(stats.success)}%)</span>
        </div>
        <div className="hls-idx__stat hls-idx__stat--fail">
          <span className="hls-idx__stat-num">{stats.failed}</span>
          <span className="hls-idx__stat-label">Failed ({pct(stats.failed)}%)</span>
        </div>
        <div className="hls-idx__stat hls-idx__stat--pending">
          <span className="hls-idx__stat-num">{stats.pending}</span>
          <span className="hls-idx__stat-label">Pending</span>
        </div>
      </div>

      <div className="hls-idx__engines">
        {Object.entries(stats.byEngine).map(([engine, s]) => (
          <div key={engine} className="hls-idx__engine">
            <span className="hls-idx__engine-name">{ENGINE_LABELS[engine] || engine}</span>
            <span className="hls-idx__engine-bar">
              <span className="hls-idx__engine-fill" style={{ width: `${pct(s.success)}%` }} />
            </span>
            <span className="hls-idx__engine-pct">{s.success}/{s.total}</span>
          </div>
        ))}
      </div>

      <table className="hls-idx__table">
        <thead>
          <tr>
            <th>Doc</th>
            <th>Engine</th>
            <th>Status</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {latest.map((r) => (
            <tr key={r.id}>
              <td><code>{r.docType}/{r.docSlug}</code></td>
              <td>{ENGINE_LABELS[r.engine] || r.engine}</td>
              <td>
                <span className={`hls-idx__badge hls-idx__badge--${r.status}`}>
                  {r.status}{r.httpStatus ? ` (${r.httpStatus})` : ''}
                </span>
              </td>
              <td className="hls-idx__time">{new Date(r.submittedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default IndexingDashboard;
