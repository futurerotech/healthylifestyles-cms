'use client';

/** Audience growth — subscribers vs leads per period. */
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Datum {
  label: string;
  subscribers: number;
  leads: number;
}

const tooltipStyle = {
  background: 'var(--theme-elevation-0)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--theme-text)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
};

export const GrowthChart: React.FC<{ data: Datum[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={240}>
    <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barGap={2}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-elevation-150)" vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--theme-elevation-400)" tickLine={false} axisLine={false} />
      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--theme-elevation-400)" tickLine={false} axisLine={false} width={36} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--theme-elevation-100)', opacity: 0.4 }} />
      <Bar dataKey="subscribers" fill="var(--theme-success-400)" radius={[4, 4, 0, 0]} />
      <Bar dataKey="leads" fill="var(--hls-accent-blue)" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);
