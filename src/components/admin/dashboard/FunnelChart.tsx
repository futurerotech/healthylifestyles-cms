'use client';

/** Conversion funnel — horizontal bars: sessions → completions → leads → subscribers. */
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Datum {
  stage: string;
  value: number;
  color: string;
}

const tooltipStyle = {
  background: 'var(--theme-elevation-0)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--theme-text)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
};

export const FunnelChart: React.FC<{ data: Datum[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={240}>
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
      <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--theme-elevation-400)" tickLine={false} axisLine={false} allowDecimals={false} />
      <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} stroke="var(--theme-elevation-400)" tickLine={false} axisLine={false} width={92} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--theme-elevation-100)', opacity: 0.4 }} />
      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
        {data.map((entry, i) => (
          <Cell key={i} fill={entry.color} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);
