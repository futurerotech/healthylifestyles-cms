'use client';
import React, { useState } from 'react';
import { useFormFields } from '@payloadcms/ui';

export const SendPushButton: React.FC = () => {
  const [title, body] = useFormFields(([t, b]) => [
    t?.title?.value as string | undefined,
    t?.excerpt?.value as string | undefined,
  ]) as (string | undefined)[];

  const id = useFormFields(([f]) => f?.id?.value) as string | number | undefined;
  const slug = useFormFields(([f]) => f?.slug?.value) as string | undefined;

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    ok?: boolean; sent?: number; failed?: number; message?: string;
  } | null>(null);
  const [overrideTitle, setOverrideTitle] = useState('');
  const [overrideBody, setOverrideBody] = useState('');

  const handleSend = async () => {
    if (!id) return;
    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: overrideTitle || title || 'New article',
          body: overrideBody || body || 'Check out our latest content.',
          articleId: id,
          url: slug ? `/wellness-hub/${slug}` : '/',
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--theme-elevation-100)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
      <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: '0 0 0.5rem', color: 'var(--theme-text)' }}>
        Send Push Notification
      </p>

      <div style={{ marginBottom: '0.4rem' }}>
        <label style={{ fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem', color: 'var(--theme-elevation-500)' }}>
          Title (leave empty to use article title)
        </label>
        <input
          type="text"
          value={overrideTitle}
          onInput={(e) => setOverrideTitle((e.target as HTMLInputElement).value)}
          placeholder={title || 'Notification title'}
          style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem' }}
        />
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label style={{ fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem', color: 'var(--theme-elevation-500)' }}>
          Body
        </label>
        <textarea
          value={overrideBody}
          onInput={(e) => setOverrideBody((e.target as HTMLTextAreaElement).value)}
          placeholder={body || 'Notification body'}
          rows={2}
          style={{ width: '100%', padding: '0.4rem', fontSize: '0.82rem', resize: 'vertical' }}
        />
      </div>

      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        className="btn btn--style-primary"
        style={{ width: '100%', padding: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
      >
        {sending ? 'Sending...' : 'Send Push to All Subscribers'}
      </button>

      {result && (
        <div style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: '4px', fontSize: '0.82rem', background: result.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}` }}>
          {result.ok !== undefined ? (
            result.ok ? (
              <span style={{ color: '#16a34a' }}>Sent: {result.sent}, Failed: {result.failed}</span>
            ) : (
              <span style={{ color: '#dc2626' }}>{result.message || 'Send failed'}</span>
            )
          ) : null}
        </div>
      )}
    </div>
  );
};
