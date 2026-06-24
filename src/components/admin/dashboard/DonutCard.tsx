'use client';

/** Compact donut for a single rate metric (e.g. completion rate, push delivery). */
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

interface Props {
  /** Fraction fulfilled, 0..1. */
  rate: number;
  label: string;
  color?: string;
}

export const DonutCard: React.FC<Props> = ({ rate, label, color = 'var(--theme-success-400)' }) => {
  const pct = Math.max(0, Math.min(1, rate || 0));
  const remaining = Math.max(0, 1 - pct);
  const data = [
    { name: label, value: pct * 100 },
    { name: 'rest', value: remaining * 100 },
  ];
  const muted = 'var(--theme-elevation-200)';

  return (
    <div className="hls-bi__donut">
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={62}
            startAngle={90}
            endAngle={-270}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            <Cell key="on" fill={color} />
            <Cell key="off" fill={muted} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="hls-bi__donut-center">
        <span className="hls-bi__donut-value">{Math.round(pct * 100)}%</span>
        <span className="hls-bi__donut-label">{label}</span>
      </div>
    </div>
  );
};
