'use client';

import React, { useState } from 'react';
import { useFormFields } from '@payloadcms/ui';

export const PseoGenerateButton: React.FC = () => {
  const id = useFormFields(([f]) => f?.id?.value) as number | string | undefined;
  const status = useFormFields(([f]) => f?.status?.value) as string | undefined;
  const templateId = useFormFields(([f]) => {
    const v = f?.template?.value;
    return typeof v === 'object' && v !== null ? (v as any).id : v;
  }) as number | string | undefined;

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; count: number; message: string } | null>(null);

  const handleGenerate = async () => {
    if (!id || !templateId) return;
    setRunning(true);
    setResult(null);

    try {
      const res = await fetch('/api/pseo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId: id, templateId }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ ok: false, count: 0, message: (err as Error).message });
    } finally {
      setRunning(false);
    }
  };

  if (status === 'generated') {
    return (
      <div className="hls-pseo-generate">
        <div className="hls-pseo-generate__done">Pages already generated for this dataset.</div>
      </div>
    );
  }

  if (!templateId) {
    return (
      <div className="hls-pseo-generate">
        <p className="hls-pseo-generate__note">Select a Template first, then generate pages.</p>
      </div>
    );
  }

  return (
    <div className="hls-pseo-generate">
      <button
        type="button"
        className="hls-pseo-generate__btn"
        onClick={handleGenerate}
        disabled={running}
      >
        {running ? 'Generating pages…' : 'Generate Pages'}
      </button>

      {result && (
        <div className={`hls-pseo-generate__result hls-pseo-generate__result--${result.ok ? 'ok' : 'err'}`}>
          {result.ok
            ? `✓ Generated ${result.count} page${result.count !== 1 ? 's' : ''}.`
            : `✗ ${result.message}`}
        </div>
      )}
    </div>
  );
};

export default PseoGenerateButton;
