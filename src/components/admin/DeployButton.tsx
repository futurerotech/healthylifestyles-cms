'use client';
import React, { useState, useEffect, useCallback } from 'react';

/**
 * §7.3 — Admin "Deploy" button.
 *
 * Shows the count of pending content changes and lets an admin
 * trigger a manual Vercel deploy via the secure server-side endpoint.
 * Calls /api/deploy (POST) — never calls Vercel directly from the browser.
 */
export const DeployButton: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState<{ type: 'info' | 'success' | 'error'; msg: string } | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/deploy/pending', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPending(data.count || 0);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchPending]);

  const deploy = async () => {
    setBusy(true);
    setToast({ type: 'info', msg: 'Triggering deployment…' });
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', msg: 'Deployment started on Vercel ✓' });
        setPending(0);
      } else {
        setToast({ type: 'error', msg: data.error || 'Deploy failed.' });
      }
    } catch {
      setToast({ type: 'error', msg: 'Network error — deploy not triggered.' });
    } finally {
      setBusy(false);
      // Auto-clear toast after 5 seconds
      setTimeout(() => setToast(null), 5000);
    }
  };

  return (
    <div style={{ padding: '0 1rem 1rem', position: 'relative' }}>
      <button
        onClick={deploy}
        disabled={busy || pending === 0}
        style={{
          width: '100%',
          padding: '0.65rem 1rem',
          border: 'none',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: busy || pending === 0 ? 'not-allowed' : 'pointer',
          opacity: busy || pending === 0 ? 0.6 : 1,
          background: pending > 0 ? '#16a34a' : '#e2e8f0',
          color: pending > 0 ? '#fff' : '#64748b',
          transition: 'all 0.15s',
        }}
      >
        {busy
          ? 'Deploying…'
          : pending > 0
            ? `🚀 Deploy site (${pending} pending change${pending === 1 ? '' : 's'})`
            : '✓ Up to date — no pending changes'}
      </button>
      {toast && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 500,
            background:
              toast.type === 'success'
                ? '#dcfce7'
                : toast.type === 'error'
                  ? '#fee2e2'
                  : '#dbeafe',
            color:
              toast.type === 'success'
                ? '#166534'
                : toast.type === 'error'
                  ? '#991b1b'
                  : '#1e40af',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default DeployButton;
