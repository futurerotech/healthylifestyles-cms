'use client';
import React from 'react';
import { useFormFields } from '@payloadcms/ui';

/* Live word count + reading time + a plain-language readability hint for the
 * article body. Reads the lexical `content` field from form state and walks it
 * for text. Fully defensive — unknown shapes just yield an empty string. */

function lexicalText(node: any, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  if (typeof node.text === 'string') out.push(node.text);
  if (node.root) lexicalText(node.root, out);
  const kids = node.children;
  if (Array.isArray(kids)) for (const k of kids) lexicalText(k, out);
}

function readability(words: number, sentences: number): { label: string; tone: 'ok' | 'warn' | 'muted' } {
  if (!words) return { label: 'Start writing to see readability', tone: 'muted' };
  const avg = words / Math.max(1, sentences);
  if (avg <= 14) return { label: 'Easy to read', tone: 'ok' };
  if (avg <= 20) return { label: 'Fairly readable', tone: 'ok' };
  if (avg <= 25) return { label: 'A little dense — vary sentence length', tone: 'warn' };
  return { label: 'Long sentences — try breaking some up', tone: 'warn' };
}

export const ContentStats: React.FC = () => {
  const content = useFormFields(([fields]) => fields?.content?.value);

  const out: string[] = [];
  try {
    lexicalText(content, out);
  } catch {
    /* ignore malformed content */
  }
  const text = out.join(' ').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').filter(Boolean).length : 0;
  const sentences = text ? (text.match(/[.!?]+(\s|$)/g) || []).length : 0;
  const minutes = Math.max(1, Math.round(words / 200));
  const read = readability(words, sentences);

  return (
    <div className="hls-stats" aria-label="Article body statistics">
      <div className="hls-stats__item">
        <span className="hls-stats__num">{words.toLocaleString()}</span>
        <span className="hls-stats__label">{words === 1 ? 'word' : 'words'}</span>
      </div>
      <div className="hls-stats__item">
        <span className="hls-stats__num">{words ? `${minutes}` : '—'}</span>
        <span className="hls-stats__label">min read</span>
      </div>
      <div className="hls-stats__item">
        <span className="hls-stats__num">{sentences.toLocaleString()}</span>
        <span className="hls-stats__label">{sentences === 1 ? 'sentence' : 'sentences'}</span>
      </div>
      <div className={`hls-stats__hint hls-stats__hint--${read.tone}`}>{read.label}</div>
    </div>
  );
};

export default ContentStats;
