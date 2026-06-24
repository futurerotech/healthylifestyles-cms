'use client';

import React, { useState, useCallback } from 'react';
import { useFormFields } from '@payloadcms/ui';

type Status = 'idle' | 'loading' | 'success' | 'error';

type TaskState = {
  status: Status;
  result: string;
  error: string;
};

const INITIAL: TaskState = { status: 'idle', result: '', error: '' };

/* ------------------------------------------------------------------ */

export const AiWritingAssistant: React.FC = () => {
  const [seoGaps, setSeoGaps] = useState<TaskState>(INITIAL);
  const [links, setLinks] = useState<TaskState>(INITIAL);
  const [metaDesc, setMetaDesc] = useState<TaskState>(INITIAL);
  const [availableArticles, setAvailableArticles] = useState<Record<string, unknown>[] | null>(null);

  const fields = useFormFields(([fields]) => ({
    id: fields?.id?.value,
    title: fields?.title?.value,
    excerpt: fields?.excerpt?.value,
    content: fields?.content?.value,
    metaTitle: fields?.['seo.metaTitle']?.value,
    metaDescription: fields?.['seo.metaDescription']?.value,
    keywords: fields?.['seo.keywords']?.value,
    category: fields?.category?.value,
    slug: fields?.slug?.value,
  }));

  const getCategoryName = (cat: unknown): string => {
    if (!cat) return '';
    if (typeof cat === 'object') return String((cat as Record<string, unknown>)?.name ?? '');
    return String(cat);
  };

  const callAssistant = useCallback(
    async (task: 'seoGaps' | 'internalLinks' | 'metaDescription') => {
      const setter =
        task === 'seoGaps' ? setSeoGaps : task === 'internalLinks' ? setLinks : setMetaDesc;
      setter({ status: 'loading', result: '', error: '' });

      /* For internalLinks, fetch available articles if not already loaded */
      let articles: Record<string, unknown>[] | undefined;
      if (task === 'internalLinks') {
        if (!availableArticles) {
          try {
            const r = await fetch('/api/articles?limit=200&depth=0&sort=-createdAt');
            const body = await r.json() as { docs?: Record<string, unknown>[] };
            articles = body?.docs || [];
            setAvailableArticles(articles);
          } catch {
            articles = [];
          }
        } else {
          articles = availableArticles;
        }
      }

      const context = {
        title: fields.title,
        excerpt: fields.excerpt,
        content: fields.content,
        metaTitle: fields.metaTitle,
        metaDescription: fields.metaDescription,
        keywords: Array.isArray(fields.keywords) ? fields.keywords.join(', ') : fields.keywords || '',
        category: getCategoryName(fields.category),
        articles,
      };

      try {
        const res = await fetch('/api/ai-writing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task, context }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Request failed' }));
          setter({ status: 'error', result: '', error: err.error || `Server error ${res.status}` });
          return;
        }

        const body = await res.json() as { result?: string };
        setter({ status: 'success', result: body.result || '', error: '' });
      } catch (err) {
        setter({ status: 'error', result: '', error: (err as Error).message || 'Network error' });
      }
    },
    [fields, availableArticles],
  );

  /* ── Render helpers ── */

  const renderJsonResult = (raw: string) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const pill = (score: string) => {
    const cls =
      score === 'good' ? 'hls-aiw__pill--green' : score === 'fair' ? 'hls-aiw__pill--amber' : 'hls-aiw__pill--red';
    return <span className={`hls-aiw__pill ${cls}`}>{score}</span>;
  };

  const sevBadge = (s: string) => {
    const cls =
      s === 'high' ? 'hls-aiw__sev--high' : s === 'medium' ? 'hls-aiw__sev--med' : 'hls-aiw__sev--low';
    return <span className={`hls-aiw__sev ${cls}`}>{s}</span>;
  };

  return (
    <div className="hls-aiw">
      <p className="hls-aiw__intro">
        Analyze your draft with DeepSeek AI — SEO audit, internal link suggestions,
        and meta description generation. Results are suggestions; always review before publishing.
      </p>

      {/* ── Card: SEO Gap Analysis ── */}
      <div className="hls-aiw__card">
        <div className="hls-aiw__card-head">
          <div>
            <h3 className="hls-aiw__card-title">SEO Gap Analysis</h3>
            <p className="hls-aiw__card-desc">
              Audits title, meta description, keyword usage, readability, and content structure.
            </p>
          </div>
          <button
            className="hls-aiw__btn"
            onClick={() => callAssistant('seoGaps')}
            disabled={seoGaps.status === 'loading'}
            type="button"
          >
            {seoGaps.status === 'loading' ? 'Analyzing…' : 'Run Audit'}
          </button>
        </div>

        {seoGaps.status === 'loading' && (
          <div className="hls-aiw__loading">Contacting DeepSeek AI…</div>
        )}
        {seoGaps.status === 'error' && (
          <div className="hls-aiw__error">{seoGaps.error}</div>
        )}
        {seoGaps.status === 'success' && (() => {
          const d = renderJsonResult(seoGaps.result);
          if (!d) return <pre className="hls-aiw__raw">{seoGaps.result}</pre>;
          return (
            <div className="hls-aiw__body">
              <div className="hls-aiw__score-wrap">
                <div className="hls-aiw__score-ring">
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="var(--theme-elevation-150)" strokeWidth="6" />
                    <circle
                      cx="36" cy="36" r="30"
                      fill="none"
                      stroke={d.score >= 70 ? '#22c55e' : d.score >= 40 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="6"
                      strokeDasharray={`${(d.score / 100) * 188.5} 188.5`}
                      strokeLinecap="round"
                      transform="rotate(-90 36 36)"
                    />
                    <text x="36" y="36" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="800" fill="var(--theme-text)">
                      {d.score}
                    </text>
                  </svg>
                </div>
                <div className="hls-aiw__assessments">
                  <div>Title: {pill(d.titleAssessment?.score)} — {d.titleAssessment?.feedback}</div>
                  <div>Meta desc: {pill(d.metaDescriptionAssessment?.score)} — {d.metaDescriptionAssessment?.feedback}</div>
                </div>
              </div>

              {d.contentGaps?.length > 0 && (
                <div className="hls-aiw__section">
                  <h4>Content Gaps ({d.contentGaps.length})</h4>
                  {d.contentGaps.map((g: Record<string, string>, i: number) => (
                    <div key={i} className="hls-aiw__gap">
                      <div className="hls-aiw__gap-head">
                        {sevBadge(g.severity)} <strong>{g.issue}</strong>
                      </div>
                      <p className="hls-aiw__gap-rec">{g.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}

              {d.missingElements?.length > 0 && (
                <div className="hls-aiw__section">
                  <h4>Missing Elements</h4>
                  <ul className="hls-aiw__list">
                    {d.missingElements.map((m: string, i: number) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {d.readability && (
                <div className="hls-aiw__section">
                  <h4>Readability</h4>
                  <p>{d.readability.estimatedLevel} — {d.readability.suggestion}</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Card: Internal Links ── */}
      <div className="hls-aiw__card">
        <div className="hls-aiw__card-head">
          <div>
            <h3 className="hls-aiw__card-title">Internal Link Suggestions</h3>
            <p className="hls-aiw__card-desc">
              Finds 5 existing articles contextually relevant to link from this draft.
            </p>
          </div>
          <button
            className="hls-aiw__btn"
            onClick={() => callAssistant('internalLinks')}
            disabled={links.status === 'loading'}
            type="button"
          >
            {links.status === 'loading' ? 'Finding…' : 'Find Links'}
          </button>
        </div>

        {links.status === 'loading' && (
          <div className="hls-aiw__loading">Fetching article catalog + contacting DeepSeek AI…</div>
        )}
        {links.status === 'error' && (
          <div className="hls-aiw__error">{links.error}</div>
        )}
        {links.status === 'success' && (() => {
          const d = renderJsonResult(links.result);
          if (!d?.suggestions) return <pre className="hls-aiw__raw">{links.result}</pre>;
          return (
            <div className="hls-aiw__body">
              {d.suggestions.map((s: Record<string, string>, i: number) => (
                <div key={i} className="hls-aiw__link-sug">
                  <div className="hls-aiw__link-sug-head">
                    <a
                      href={`/admin/collections/articles/${s.articleSlug}`}
                      className="hls-aiw__link-title"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {s.articleTitle}
                    </a>
                    <span className={`hls-aiw__rel hls-aiw__rel--${s.relevance}`}>
                      {s.relevance}
                    </span>
                  </div>
                  <p className="hls-aiw__link-placement"><strong>Place at:</strong> {s.placementContext}</p>
                  <p className="hls-aiw__link-reason"><strong>Why:</strong> {s.reason}</p>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── Card: Meta Description ── */}
      <div className="hls-aiw__card">
        <div className="hls-aiw__card-head">
          <div>
            <h3 className="hls-aiw__card-title">Meta Description</h3>
            <p className="hls-aiw__card-desc">
              Generates a 140–155 character SEO meta description with primary keyword.
            </p>
          </div>
          <button
            className="hls-aiw__btn"
            onClick={() => callAssistant('metaDescription')}
            disabled={metaDesc.status === 'loading'}
            type="button"
          >
            {metaDesc.status === 'loading' ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {metaDesc.status === 'loading' && (
          <div className="hls-aiw__loading">Contacting DeepSeek AI…</div>
        )}
        {metaDesc.status === 'error' && (
          <div className="hls-aiw__error">{metaDesc.error}</div>
        )}
        {metaDesc.status === 'success' && (() => {
          const d = renderJsonResult(metaDesc.result);
          if (!d?.metaDescription) return <pre className="hls-aiw__raw">{metaDesc.result}</pre>;
          return (
            <div className="hls-aiw__body">
              <div className="hls-aiw__meta-card">
                <p className="hls-aiw__meta-text">{d.metaDescription}</p>
                <div className="hls-aiw__meta-meta">
                  <span className={d.characterCount > 155 ? 'hls-aiw__meta-count--over' : 'hls-aiw__meta-count--ok'}>
                    {d.characterCount} / 155 chars
                  </span>
                  {d.primaryKeywordIncluded && (
                    <span className="hls-aiw__meta-kw">Keyword included ✓</span>
                  )}
                </div>
              </div>

              {d.alternatives?.length > 1 && (
                <div className="hls-aiw__section">
                  <h4>Alternatives</h4>
                  {d.alternatives.map((alt: string, i: number) => (
                    <p key={i} className="hls-aiw__alt">{alt}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
