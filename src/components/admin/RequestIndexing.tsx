'use client';
import React from 'react';
import { useFormFields } from '@payloadcms/ui';

/* "Request indexing" helper. On a published article it surfaces the live URL,
 * a copy button, and a deep link to Google Search Console's URL Inspection so
 * an editor can ask Google to re-crawl right after publishing. Hidden affordance
 * (muted note) while the article is still a draft. */

const ORIGIN = 'https://www.healthylifestyles.com';

export const RequestIndexing: React.FC = () => {
  const [slug, status] = useFormFields(([fields]) => [
    fields?.slug?.value,
    fields?._status?.value,
  ]) as (string | undefined)[];

  const [copied, setCopied] = React.useState(false);

  if (status !== 'published' || !slug) {
    return (
      <div className="hls-index hls-index--muted">
        <p className="hls-index__note">Publish this article to unlock indexing tools.</p>
      </div>
    );
  }

  const url = `${ORIGIN}/wellness-hub/${slug}`;
  const gsc = `https://search.google.com/search-console/inspect?id=${encodeURIComponent(url)}`;

  const copy = () => {
    try {
      navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — link is still selectable */
    }
  };

  return (
    <div className="hls-index">
      <div className="hls-index__row">
        <code className="hls-index__url">{url}</code>
        <button type="button" className={`hls-index__copy${copied ? ' is-copied' : ''}`} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <a className="hls-index__btn" href={gsc} target="_blank" rel="noopener noreferrer">
        Request indexing in Search Console →
      </a>
      <p className="hls-index__note">Opens Google’s URL Inspection tool for this page. Re-crawls usually land within a day or two.</p>
    </div>
  );
};

export default RequestIndexing;
