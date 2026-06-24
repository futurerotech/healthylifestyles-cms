'use client';
import React from 'react';

/* Colored status badge for list views. Handles article/tool `_status`
 * (published/draft/scheduled) and the tool `enabled` boolean (live/coming-soon). */
const MAP: Record<string, { label: string; tone: string }> = {
  published: { label: 'Published', tone: 'green' },
  draft: { label: 'Draft', tone: 'amber' },
  scheduled: { label: 'Scheduled', tone: 'blue' },
};

export const StatusCell: React.FC<{ cellData?: unknown }> = ({ cellData }) => {
  let label: string;
  let tone: string;
  if (typeof cellData === 'boolean') {
    label = cellData ? 'Live' : 'Coming soon';
    tone = cellData ? 'green' : 'slate';
  } else {
    const key = String(cellData ?? '').toLowerCase();
    const m = MAP[key] ?? { label: cellData ? String(cellData) : '—', tone: 'slate' };
    label = m.label;
    tone = m.tone;
  }
  return <span className={`hls-badge hls-badge--${tone}`}>{label}</span>;
};

export default StatusCell;
