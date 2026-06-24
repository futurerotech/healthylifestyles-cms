'use client';

import React, { useState, useEffect } from 'react';
import { useFormFields } from '@payloadcms/ui';

export const PseoPreview: React.FC = () => {
  const csvFile = useFormFields(([f]) => f?.csvFile?.value) as any;
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!csvFile) { setPreview(null); return; }

    const id = typeof csvFile === 'object' ? csvFile.id : csvFile;
    if (!id) return;

    setLoading(true);
    fetch(`/api/media/${id}?depth=0`)
      .then((r) => r.json())
      .then(async (doc) => {
        if (!doc?.url) return;
        const res = await fetch(doc.url);
        const text = await res.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) return;

        const headers = parseLine(lines[0]);
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < Math.min(lines.length, 7); i++) {
          const vals = parseLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });
          rows.push(row);
        }
        setPreview({ headers, rows });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [csvFile]);

  if (!csvFile) {
    return <div className="hls-pseo-preview hls-pseo-preview--empty">Upload a CSV file to see a preview.</div>;
  }

  if (loading) {
    return <div className="hls-pseo-preview hls-pseo-preview--loading">Loading preview…</div>;
  }

  if (!preview) {
    return <div className="hls-pseo-preview hls-pseo-preview--empty">Could not parse CSV.</div>;
  }

  return (
    <div className="hls-pseo-preview">
      <div className="hls-pseo-preview__header">
        <span className="hls-pseo-preview__title">CSV Preview</span>
        <span className="hls-pseo-preview__count">{preview.rows.length} rows shown (first 5)</span>
      </div>
      <div className="hls-pseo-preview__table-wrap">
        <table className="hls-pseo-preview__table">
          <thead>
            <tr>
              {preview.headers.map((h) => (
                <th key={h}>
                  {h}
                  <span className="hls-pseo-preview__var">&#123;&#123;{h}&#125;&#125;</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, i) => (
              <tr key={i}>
                {preview.headers.map((h) => (
                  <td key={h}>{row[h] || ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hls-pseo-preview__note">
        Columns become <code>{'{{variable}}'}</code> placeholders in your template.
        Use <code>{'{{keyword|slugify}}'}</code> for URL-safe slugs.
      </p>
    </div>
  );
};

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += ch;
  }
  result.push(current);
  return result;
}

export default PseoPreview;
