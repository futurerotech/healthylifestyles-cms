'use client';

/** Daily tool sessions — dual line (total + completed). */
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Datum {
  label: string;
  sessions: number;
  completed: number;
}

const tooltipStyle = {
  background: 'var(--theme-elevation-0)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--theme-text)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
};

export const SessionsChart: React.FC<{ data: Datum[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={240}>
    <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-elevation-150)" vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--theme-elevation-400)" tickLine={false} axisLine={false} />
      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--theme-elevation-400)" tickLine={false} axisLine={false} width={36} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--theme-elevation-300)' }} />
      <Line type="monotone" dataKey="sessions" stroke="var(--hls-accent-blue)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
      <Line type="monotone" dataKey="completed" stroke="var(--theme-success-400)" strokeWidth={2.5} dot={false} strokeDasharray="4 3" />
    </LineChart>
  </ResponsiveContainer>
);
