'use client';
import React from 'react';
import { useFormFields } from '@payloadcms/ui';

/**
 * Phase 10 — sidebar hint showing which structured-data (JSON-LD) schemas the
 * article will emit on the public site. Reads LIVE form state, so it updates
 * the moment an editor ticks/unticks `isHowTo` / `isHealthTopic` (before
 * saving). Bridges the DB flags → editor experience gap: the booleans are the
 * single source of truth for schema emission (Phase 9), and this makes their
 * effect visible where the decision is made.
 */
export const SchemaEmissionHint: React.FC = () => {
  const [isHowTo, isHealthTopic, faqCount] = useFormFields(([fields]) => [
    Boolean(fields?.isHowTo?.value),
    Boolean(fields?.isHealthTopic?.value),
    Object.keys(fields || {}).filter((k) => /^faq\.\d+\.question$/.test(k)).length,
  ]) as [boolean, boolean, number];

  const rows: { label: string; on: boolean; note: string }[] = [
    { label: 'MedicalWebPage + Article', on: true, note: 'always (YMYL base)' },
    { label: 'BreadcrumbList', on: true, note: 'always' },
    { label: 'FAQPage', on: faqCount > 0, note: faqCount > 0 ? `${faqCount} FAQ${faqCount === 1 ? '' : 's'}` : 'add FAQs to emit' },
    { label: 'HowTo', on: isHowTo, note: isHowTo ? 'via “Is HowTo” flag' : 'tick “Is HowTo” to emit' },
    { label: 'HealthTopicContent', on: isHealthTopic, note: isHealthTopic ? 'via “Is Health Topic” flag' : 'tick “Is Health Topic” to emit' },
  ];

  return (
    <div className="hls-schemahint" role="note" aria-label="Structured data this article will emit">
      <div className="hls-schemahint__title">Structured data on publish</div>
      <ul className="hls-schemahint__list">
        {rows.map((r) => (
          <li key={r.label} className="hls-schemahint__row">
            <span className={`hls-schemahint__dot ${r.on ? 'is-on' : ''}`} aria-hidden="true" />
            <span className={`hls-schemahint__name ${r.on ? '' : 'is-off'}`}>{r.label}</span>
            <span className="hls-schemahint__note">{r.note}</span>
          </li>
        ))}
      </ul>
      <p className="hls-schemahint__foot">
        AI drafts set the two flags automatically; your manual changes here win and are never overwritten.
      </p>
    </div>
  );
};

export default SchemaEmissionHint;
