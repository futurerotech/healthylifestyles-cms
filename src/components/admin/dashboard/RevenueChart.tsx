'use client';

/** Projected revenue area chart — sessions × RPM per period. */
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Datum {
  label: string;
  value: number;
}

const tooltipStyle = {
  background: 'var(--theme-elevation-0)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--theme-text)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
};

export const RevenueChart: React.FC<{ data: Datum[]; format?: (v: number) => string }> = ({
  data,
  format = (v) => `$${Math.round(v).toLocaleString()}`,
}) => (
  <ResponsiveContainer width="100%" height={240}>
    <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
      <defs>
        <linearGradient id="bi-rev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--hls-accent-violet)" stopOpacity={0.45} />
          <stop offset="100%" stopColor="var(--hls-accent-violet)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-elevation-150)" vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--theme-elevation-400)" tickLine={false} axisLine={false} />
      <YAxis tick={{ fontSize: 11 }} stroke="var(--theme-elevation-400)" tickLine={false} axisLine={false} width={48} tickFormatter={(v) => format(v as number)} />
      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [format(Number(v)), 'Projected']} cursor={{ stroke: 'var(--hls-accent-violet)', strokeWidth: 1 }} />
      <Area type="monotone" dataKey="value" stroke="var(--hls-accent-violet)" strokeWidth={2.5} fill="url(#bi-rev)" />
    </AreaChart>
  </ResponsiveContainer>
);
