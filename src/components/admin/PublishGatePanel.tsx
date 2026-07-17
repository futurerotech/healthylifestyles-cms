'use client';

/**
 * SEO Quality Gate Phase 2 — editor sidebar panel.
 *
 * Shows the FULL gate result for this article: blockers (would stop publish),
 * warnings (editor's call), or all-clear. Enforcement itself lives in
 * publishGateHook (blocks only) — this panel is the transparency layer so
 * nothing about a blocked publish is ever a surprise.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useDocumentInfo } from '@payloadcms/ui';

interface GateIssue { code: string; message: string }
interface GateResponse { blocks?: GateIssue[]; warns?: GateIssue[]; checkedAt?: string; error?: string }

export const PublishGatePanel: React.FC = () => {
  const { id } = useDocumentInfo();
  const [state, setState] = useState<GateResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/publish-gate?id=${id}`, { credentials: 'include' });
      setState((await res.json()) as GateResponse);
    } catch {
      setState({ error: 'Check failed — try again.' });
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => { void check(); }, [check]);

  if (!id) return null; // unsaved doc — nothing to check yet

  const blocks = state?.blocks ?? [];
  const warns = state?.warns ?? [];

  const row = (color: string, icon: string, text: string, key: string) => (
    <div key={key} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color, marginTop: 4 }}>
      <span aria-hidden>{icon}</span>
      <span>{text}</span>
    </div>
  );

  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 4, padding: '10px 12px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>SEO publish gate</strong>
        <button type="button" onClick={() => void check()} disabled={busy}
          style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--theme-elevation-250)', borderRadius: 3 }}>
          {busy ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      {state?.error && row('#b45309', '⚠', state.error, 'err')}

      {!state?.error && state && (
        <>
          {blocks.map((b, i) => row('#dc2626', '⛔', `${b.message} (blocks publish)`, `b${i}`))}
          {warns.map((w, i) => row('#b45309', '⚠', w.message, `w${i}`))}
          {blocks.length === 0 && warns.length === 0 &&
            row('#16a34a', '✓', 'All checks pass — publish freely.', 'ok')}
          {blocks.length === 0 && warns.length > 0 &&
            row('#6b7280', 'ℹ', 'Warnings never block publish — your call.', 'note')}
        </>
      )}
    </div>
  );
};
