'use client';
import React from 'react';
import { useFormFields } from '@payloadcms/ui';

/* Live character counters + a Google-style SERP preview for the SEO group.
 * Reads sibling fields from form state; renders a fallback if any are blank. */
const clamp = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export const SerpPreview: React.FC = () => {
  const [metaTitle, metaDesc, title, name, slug] = useFormFields(([fields]) => [
    fields?.['seo.metaTitle']?.value,
    fields?.['seo.metaDescription']?.value,
    fields?.title?.value,
    fields?.name?.value,
    fields?.slug?.value,
  ]) as (string | undefined)[];

  const displayTitle = String(metaTitle || title || name || 'Untitled page');
  const displayDesc = String(metaDesc || 'Add a meta description to control how this page looks in search results.');
  const url = `healthylifestyles.com › ${String(slug || '')}`;
  const titleLen = String(metaTitle || '').length;
  const descLen = String(metaDesc || '').length;
  const tone = (len: number, max: number) => (len === 0 ? 'muted' : len > max ? 'over' : 'ok');

  return (
    <div className="hls-serp">
      <div className="hls-serp__counts">
        <span className={`hls-serp__count hls-serp__count--${tone(titleLen, 60)}`}>Title {titleLen}/60</span>
        <span className={`hls-serp__count hls-serp__count--${tone(descLen, 155)}`}>Description {descLen}/155</span>
      </div>
      <div className="hls-serp__preview" aria-label="Google search result preview">
        <div className="hls-serp__url">{url}</div>
        <div className="hls-serp__title">{clamp(displayTitle, 60)}</div>
        <div className="hls-serp__desc">{clamp(displayDesc, 158)}</div>
      </div>
    </div>
  );
};

export default SerpPreview;
