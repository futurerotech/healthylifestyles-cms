'use client';

import React, { useState } from 'react';
import { useField, useFormFields } from '@payloadcms/ui';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type SeoTask = 'title' | 'description' | 'keywords';

interface OptionItem {
  label: string;
  value: string;
}

/* -------------------------------------------------------------------------- */
/*  Hook: calls DeepSeek SEO endpoint                                         */
/* -------------------------------------------------------------------------- */

async function generateOptions(task: SeoTask, context: Record<string, unknown>): Promise<{ options: OptionItem[]; recommended: number }> {
  const res = await fetch('/api/ai-seo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, context }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  const body = await res.json();
  const raw = typeof body.result === 'string' ? JSON.parse(body.result) : body.result;

  if (task === 'title') {
    return {
      options: (raw.options || []).map((o: Record<string, string>, i: number) => ({
        label: o.title || o.label || '',
        value: o.title || o.label || '',
      })),
      recommended: raw.recommended ?? 0,
    };
  }

  if (task === 'description') {
    return {
      options: (raw.options || []).map((o: Record<string, string>, i: number) => ({
        label: o.description || o.label || '',
        value: o.description || o.label || '',
      })),
      recommended: raw.recommended ?? 0,
    };
  }

  if (task === 'keywords') {
    const kws: string[] = raw.recommended || [];
    return {
      options: kws.map((kw: string) => ({ label: kw, value: kw })),
      recommended: 0,
    };
  }

  return { options: [], recommended: 0 };
}

/* -------------------------------------------------------------------------- */
/*  AI SEO button + option picker                                             */
/* -------------------------------------------------------------------------- */

interface AiSeoButtonProps {
  path: string;
  task: SeoTask;
  label: string;
}

export const AiSeoButton: React.FC<{ path: string; task: SeoTask; label: string }> = ({ path, task, label }) => {
  const { value, setValue } = useField<string | string[]>({ path });
  const fields = useFormFields(([f]) => f);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [recommended, setRecommended] = useState<number>(0);
  const [error, setError] = useState('');

  const buildContext = (): Record<string, unknown> => ({
    title: fields?.title?.value || fields?.name?.value || '',
    name: fields?.name?.value || '',
    excerpt: fields?.excerpt?.value || '',
    content: fields?.content?.value || '',
    keywords: fields?.['seo.keywords']?.value || '',
    metaTitle: fields?.['seo.metaTitle']?.value || '',
    metaDescription: fields?.['seo.metaDescription']?.value || '',
  });

  const handleGenerate = async () => {
    setStatus('loading');
    setOptions([]);
    setError('');

    try {
      const result = await generateOptions(task, buildContext());
      setOptions(result.options);
      setRecommended(result.recommended);
      setStatus('success');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  };

  const handlePick = (val: string) => {
    if (task === 'keywords') {
      const existing = Array.isArray(value) ? [...value] : [];
      if (!existing.includes(val)) {
        setValue([...existing, val]);
      }
    } else {
      setValue(val);
    }
    setOptions([]);
    setStatus('idle');
  };

  const handlePickAndClose = (val: string) => {
    handlePick(val);
  };

  return (
    <div className="hls-seo-ai">
      <button
        type="button"
        className="hls-seo-ai__btn"
        onClick={handleGenerate}
        disabled={status === 'loading'}
        title={`Generate ${label} with AI`}
      >
        {status === 'loading' ? (
          <span className="hls-seo-ai__spinner" />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.813 15.904L9 18l-1.5-4.5L3 12l4.5-1.5L9 6l.813 2.096" />
            <path d="M16.5 10.5l1.5 4.5L21 15l-4.5 1.5L15 21l-.813-2.096" />
          </svg>
        )}
        <span>AI</span>
      </button>

      {status === 'error' && (
        <div className="hls-seo-ai__error">{error}</div>
      )}

      {status === 'success' && options.length > 0 && (
        <div className="hls-seo-ai__panel">
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`hls-seo-ai__opt${i === recommended ? ' hls-seo-ai__opt--rec' : ''}`}
              onClick={() => handlePickAndClose(opt.value)}
            >
              <span className="hls-seo-ai__opt-text">{opt.label}</span>
              {i === recommended && <span className="hls-seo-ai__opt-badge">Best</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Custom field component wrappers for Payload                               */
/* -------------------------------------------------------------------------- */

interface TextFieldClientProps {
  path?: string;
  fieldConfig?: Record<string, unknown>;
  readOnly?: boolean;
  value?: string | string[];
  setValue?: (val: any) => void;
  placeholder?: string;
  autoComplete?: string;
  style?: React.CSSProperties;
  label?: string;
  required?: boolean;
  [key: string]: unknown;
}

export const AiTitleField: React.FC<TextFieldClientProps> = (props) => {
  const { value, setValue, label, required, readOnly, placeholder, path } = props;

  return (
    <div className="hls-seo-ai__field">
      <label className="field-label">
        {label}
        {required && <span className="required">*</span>}
      </label>
      <div className="hls-seo-ai__input-row">
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => setValue?.(e.target.value)}
          placeholder={placeholder || 'Meta title — ≤ 60 chars'}
          readOnly={readOnly}
          className="hls-seo-ai__input"
        />
        <AiSeoButton path="seo.metaTitle" task="title" label="Meta Title" />
      </div>
    </div>
  );
};

export const AiDescriptionField: React.FC<TextFieldClientProps> = (props) => {
  const { value, setValue, label, required, readOnly, placeholder, path } = props;

  return (
    <div className="hls-seo-ai__field">
      <label className="field-label">
        {label}
        {required && <span className="required">*</span>}
      </label>
      <div className="hls-seo-ai__input-row hls-seo-ai__input-row--textarea">
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => setValue?.(e.target.value)}
          placeholder={placeholder || 'Meta description — 150–155 chars'}
          readOnly={readOnly}
          className="hls-seo-ai__textarea"
          rows={3}
        />
        <AiSeoButton path="seo.metaDescription" task="description" label="Meta Description" />
      </div>
    </div>
  );
};

export const AiKeywordsField: React.FC<TextFieldClientProps> = (props) => {
  const { value, setValue, label, required, readOnly, path } = props;
  const vals = Array.isArray(value) ? value : [];

  const [inputVal, setInputVal] = useState('');

  const handleAdd = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !vals.includes(trimmed)) {
      setValue?.([...vals, trimmed]);
      setInputVal('');
    }
  };

  const handleRemove = (kw: string) => {
    setValue?.(vals.filter((v) => v !== kw));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Backspace' && inputVal === '' && vals.length > 0) {
      handleRemove(vals[vals.length - 1]);
    }
  };

  return (
    <div className="hls-seo-ai__field">
      <label className="field-label">
        {label}
        {required && <span className="required">*</span>}
      </label>
      <div className="hls-seo-ai__kw-wrap">
        <div className="hls-seo-ai__kw-chips">
          {vals.map((kw) => (
            <span key={kw} className="hls-seo-ai__chip">
              {kw}
              <button type="button" className="hls-seo-ai__chip-x" onClick={() => handleRemove(kw)}>×</button>
            </span>
          ))}
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={vals.length === 0 ? 'Type and press Enter to add keywords...' : 'Add another...'}
            readOnly={readOnly}
            className="hls-seo-ai__kw-input"
          />
        </div>
        <AiSeoButton path="seo.keywords" task="keywords" label="Keywords" />
      </div>
    </div>
  );
};
