'use client';
import React, { useState } from 'react';

export const ImportCsvButton: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean; imported?: number; duplicates?: number; failed?: number; message?: string;
  } | null>(null);

  const handleImport = async () => {
    setRunning(true);
    setResult(null);

    try {
      const res = await fetch('/api/audience/csv-import', { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <button
        type="button"
        onClick={handleImport}
        disabled={running}
        className="btn btn--style-primary"
        style={{ padding: '0.6rem 1.2rem', cursor: 'pointer' }}
      >
        {running ? 'Importing...' : 'Run CSV Import'}
      </button>

      {result && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '6px', background: result.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}` }}>
          {result.ok ? (
            <>
              <p style={{ fontWeight: 600, color: '#16a34a', margin: 0 }}>Import complete</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                {result.imported} imported &middot; {result.duplicates} duplicates &middot; {result.failed} failed
              </p>
            </>
          ) : (
            <p style={{ color: '#dc2626', margin: 0 }}>Error: {result.message || 'Import failed'}</p>
          )}
        </div>
      )}
    </div>
  );
};
