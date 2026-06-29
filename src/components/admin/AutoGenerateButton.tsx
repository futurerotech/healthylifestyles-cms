'use client';
import React from 'react';
import { useFormFields, useDocumentInfo } from '@payloadcms/ui';

/**
 * "✨ Auto-Generate E-E-A-T Content" sidebar control for Articles.
 *
 * - Generate the full draft (server-side, then reload). Never silently
 *   overwrites human edits (fill-empty vs replace).
 * - "Generate from tool": no title needed — get 5 intent-varied titles for the
 *   selected tool, click one to generate.
 * - Optional hero image (off by default).
 * - "Regenerate one section" (snippet / meta / FAQ).
 * - "Find & verify sources": ASSISTIVE only — suggests authority sources for the
 *   draft's claims and flags unmatched ones. It does NOT certify accuracy,
 *   auto-publish, or edit anything; a qualified human signs off.
 */

const PROGRESS = ['Researching the topic…', 'Drafting the article…', 'Structuring & sourcing…', 'Validating output…'];

type RelValue = string | number | { value: string | number } | null | undefined;
const relId = (v: RelValue): string => {
  if (v == null) return '';
  if (typeof v === 'object') return String((v as { value: unknown }).value ?? '');
  return String(v);
};

interface VerifyClaim {
  claim: string;
  query: string;
  suggestedSources: { title: string; url: string }[];
  matched: boolean;
  check: boolean;
}
interface VerifyState {
  loading: boolean;
  disclaimer?: string;
  searchConfigured?: boolean;
  claims?: VerifyClaim[];
}

export const AutoGenerateButton: React.FC = () => {
  const { id } = useDocumentInfo();

  const [title, tool, category, hasExcerpt, hasMeta, layoutRows, aiProviderVal] = useFormFields(([fields]) => [
    fields?.title?.value,
    fields?.primaryTool?.value,
    fields?.category?.value,
    fields?.excerpt?.value,
    fields?.['seo.metaTitle']?.value,
    (fields?.layout as { rows?: unknown[] } | undefined)?.rows?.length ?? 0,
    fields?.aiProvider?.value,
  ]) as [unknown, RelValue, RelValue, unknown, unknown, number, unknown];

  // Provider chosen in the sidebar; falls back to gemini if unset.
  const aiProvider = typeof aiProviderVal === 'string' && aiProviderVal ? aiProviderVal : 'gemini';

  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [msg, setMsg] = React.useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [section, setSection] = React.useState<'snippet' | 'meta' | 'faq'>('snippet');
  const [genImage, setGenImage] = React.useState(false);
  const [titles, setTitles] = React.useState<{ title: string; intent: string }[]>([]);
  const [titlesLoading, setTitlesLoading] = React.useState(false);
  const [verify, setVerify] = React.useState<VerifyState | null>(null);

  const titleStr = typeof title === 'string' ? title.trim() : '';
  const toolId = relId(tool);
  const categoryId = relId(category);
  const coreReady = Boolean(toolId && categoryId && id); // tool + category + saved doc
  const ready = coreReady && Boolean(titleStr); // full generate also needs a title
  const hasContent = Boolean((typeof hasExcerpt === 'string' && hasExcerpt.trim()) || (typeof hasMeta === 'string' && hasMeta.trim()) || layoutRows > 0);

  React.useEffect(() => {
    if (!busy) return;
    setProgress(0);
    const t = setInterval(() => setProgress((p) => (p + 1) % PROGRESS.length), 1400);
    return () => clearInterval(t);
  }, [busy]);

  async function post(path: string, payload: Record<string, unknown>) {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) throw new Error(json?.error || `Request failed (${res.status}).`);
    return json;
  }

  async function generate(mode: 'replace' | 'fillEmpty', titleOverride?: string) {
    const useTitle = (titleOverride ?? titleStr).trim();
    if (!useTitle || !coreReady || busy) return;
    setBusy(true);
    setMsg(null);
    setTitles([]);
    try {
      const json = await post('/api/generate-article', { docId: id, title: useTitle, toolId, categoryId, mode, generateImage: genImage, aiProvider });
      let text = 'AI draft saved. Reloading to show the content…';
      let tone: 'ok' | 'info' = 'ok';
      if (genImage && json?.image) {
        if (json.image.generated) text = 'AI draft + hero image saved. Reloading…';
        else if (json.image.error) {
          text = `AI draft saved — image skipped: ${json.image.error} Reloading…`;
          tone = 'info';
        }
      }
      setMsg({ tone, text });
      setTimeout(() => window.location.reload(), 1400);
    } catch (e) {
      setBusy(false);
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Generation failed.' });
    }
  }

  function onGenerateClick() {
    if (!ready || busy) return;
    if (!hasContent) {
      void generate('replace');
      return;
    }
    const choice = window.prompt(
      'This article already has content.\n\nType "fill" to only fill EMPTY fields, or "replace" to overwrite AI-fillable fields. (Cancel to abort.)',
      'fill',
    );
    if (choice == null) return;
    void generate(choice.trim().toLowerCase() === 'replace' ? 'replace' : 'fillEmpty');
  }

  async function suggest() {
    if (!coreReady || titlesLoading || busy) return;
    setTitlesLoading(true);
    setMsg(null);
    try {
      const json = await post('/api/suggest-titles', { docId: id, toolId, categoryId, aiProvider });
      setTitles(Array.isArray(json.titles) ? json.titles : []);
      if (!json.titles?.length) setMsg({ tone: 'info', text: 'No titles returned — try again.' });
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Could not suggest titles.' });
    } finally {
      setTitlesLoading(false);
    }
  }

  async function regenerate() {
    if (!ready || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await post('/api/regenerate-section', { docId: id, section, title: titleStr, toolId, categoryId, aiProvider });
      setMsg({ tone: 'ok', text: `Regenerated “${section}”. Reloading…` });
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      setBusy(false);
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Regeneration failed.' });
    }
  }

  async function verifySources() {
    if (!id || verify?.loading || busy) return;
    setVerify({ loading: true });
    setMsg(null);
    try {
      const json = await post('/api/verify-sources', { docId: id, aiProvider });
      setVerify({ loading: false, disclaimer: json.disclaimer, searchConfigured: json.searchConfigured, claims: json.claims || [] });
    } catch (e) {
      setVerify(null);
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Source check failed.' });
    }
  }

  return (
    <div className="hls-aigen">
      <button type="button" className="hls-aigen__btn" onClick={onGenerateClick} disabled={!ready || busy}>
        {busy ? (
          <>
            <span className="hls-aigen__spin" aria-hidden="true" /> {PROGRESS[progress]}
          </>
        ) : (
          <>✨ Auto-Generate E-E-A-T Content</>
        )}
      </button>

      {!ready && !busy && (
        <p className="hls-aigen__hint">
          {!id
            ? 'Save this article as a draft first, then generate.'
            : !coreReady
              ? 'Set a Primary Tool and Category to enable.'
              : 'Add a Title, or use “Suggest titles” below.'}
        </p>
      )}

      {/* Generate from tool: suggest titles (no title needed) */}
      <div className="hls-aigen__titles">
        <button type="button" className="hls-aigen__sub-btn" onClick={suggest} disabled={!coreReady || titlesLoading || busy}>
          {titlesLoading ? 'Suggesting…' : '💡 Suggest titles from tool'}
        </button>
        {titles.length > 0 && (
          <ul className="hls-aigen__title-list">
            {titles.map((t, i) => (
              <li key={i}>
                <button type="button" className="hls-aigen__title-chip" onClick={() => generate('replace', t.title)} disabled={busy}>
                  <span className="hls-aigen__title-text">{t.title}</span>
                  <span className="hls-aigen__title-intent">{t.intent}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Hero image toggle (off by default) */}
      <label className="hls-aigen__toggle">
        <input type="checkbox" checked={genImage} onChange={(e) => setGenImage(e.target.checked)} disabled={busy} />
        <span>
          Generate hero image
          <em> — off by default; a human-picked image is often better. Adds ~10–20s.</em>
        </span>
      </label>

      {/* Regenerate one section */}
      <div className="hls-aigen__regen">
        <label className="hls-aigen__regen-label">Regenerate one section</label>
        <div className="hls-aigen__regen-row">
          <select value={section} onChange={(e) => setSection(e.target.value as typeof section)} disabled={busy}>
            <option value="snippet">Snippet answer</option>
            <option value="meta">Meta title & description</option>
            <option value="faq">FAQ</option>
          </select>
          <button type="button" className="hls-aigen__regen-btn" onClick={regenerate} disabled={!ready || busy}>
            Regenerate
          </button>
        </div>
      </div>

      {/* Find & verify sources (assistive only) */}
      <div className="hls-aigen__verify">
        <button type="button" className="hls-aigen__sub-btn" onClick={verifySources} disabled={!id || verify?.loading || busy}>
          {verify?.loading ? 'Checking claims…' : '🔎 Find & verify sources'}
        </button>
        {verify && !verify.loading && (
          <div className="hls-aigen__verify-out">
            <p className="hls-aigen__verify-note">{verify.disclaimer}</p>
            {verify.searchConfigured === false && (
              <p className="hls-aigen__verify-warn">Web search isn’t configured (set TAVILY_API_KEY). Claims are listed for manual review.</p>
            )}
            {(verify.claims || []).map((c, i) => (
              <div key={i} className={`hls-aigen__claim${c.check ? ' hls-aigen__claim--check' : ''}`}>
                <div className="hls-aigen__claim-text">
                  {c.check && <span className="hls-aigen__claim-flag">⚠ needs a source</span>}
                  {c.claim}
                </div>
                {c.suggestedSources.length > 0 && (
                  <ul className="hls-aigen__src">
                    {c.suggestedSources.map((s, j) => (
                      <li key={j}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {(verify.claims || []).length === 0 && <p className="hls-aigen__hint">No claims extracted.</p>}
          </div>
        )}
      </div>

      {msg && <p className={`hls-aigen__msg hls-aigen__msg--${msg.tone}`}>{msg.text}</p>}
    </div>
  );
};

export default AutoGenerateButton;
