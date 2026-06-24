'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useFormFields } from '@payloadcms/ui';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

const COLORS = { green: '#22c55e', amber: '#f59e0b', blue: '#3b82f6', gray: '#94a3b8' };

type UsageRecord = {
  id: string;
  completed?: boolean;
  duration?: number;
  lastFieldReached?: string;
  totalFieldsCompleted?: number;
  totalFields?: number;
  createdAt: string;
};

type ToolAnalyticsData = {
  totalSessions: number;
  completedSessions: number;
  abandonRate: number;
  avgDuration: number;
  dailyUsage: { date: string; count: number }[];
  completionPie: { name: string; value: number; color: string }[];
  fieldDropoff: { fieldKey: string; reached: number }[];
};

function compute(records: UsageRecord[], inputKeys: string[]): ToolAnalyticsData {
  const totalSessions = records.length;
  const completedSessions = records.filter((r) => r.completed).length;
  const abandonRate = totalSessions > 0 ? (totalSessions - completedSessions) / totalSessions : 0;

  const durations = records.filter((r) => r.completed && r.duration != null).map((r) => r.duration!);
  const avgDuration =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const dayMap = new Map<string, number>();
  for (const r of records) {
    const day = r.createdAt?.slice(0, 10) || 'unknown';
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  }
  const dailyUsage = Array.from(dayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const completionPie = [
    { name: 'Completed', value: completedSessions, color: COLORS.green },
    { name: 'Abandoned', value: totalSessions - completedSessions, color: COLORS.amber },
  ];

  const fieldCounts = new Map<string, number>();
  fieldCounts.set('__start__', totalSessions);
  for (const key of inputKeys) fieldCounts.set(key, 0);
  for (const r of records) {
    const key = r.lastFieldReached || '__start__';
    const current = fieldCounts.get(key) || 0;
    fieldCounts.set(key, current + 1);
  }

  let cumulative = totalSessions;
  const fieldDropoff = [
    { fieldKey: 'Loaded', reached: totalSessions },
  ];
  for (const key of inputKeys) {
    const reached = fieldCounts.get(key) || 0;
    fieldDropoff.push({ fieldKey: key, reached });
  }

  return { totalSessions, completedSessions, abandonRate, avgDuration, dailyUsage, completionPie, fieldDropoff };
}

export const ToolAnalytics: React.FC = () => {
  const id = useFormFields(([fields]) => fields?.id?.value as string | undefined);
  const inputs = useFormFields(([fields]) => fields?.inputs?.value as { key: string; label: string }[] | undefined);

  const [raw, setRaw] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/tool-usage?where[tool][equals]=${encodeURIComponent(id)}&limit=10000&depth=0&sort=-createdAt`)
      .then((r) => r.json())
      .then((body) => {
        setRaw((body as any)?.docs || []);
      })
      .catch(() => setRaw([]))
      .finally(() => setLoading(false));
  }, [id]);

  const inputKeys = useMemo(
    () => (Array.isArray(inputs) ? inputs.map((i) => i.key).filter(Boolean) : []),
    [inputs],
  );

  const data = useMemo(() => compute(raw, inputKeys), [raw, inputKeys]);

  if (!id) {
    return (
      <div className="hls-analytics">
        <div className="hls-analytics__empty">Save this tool first to see analytics.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="hls-analytics">
        <div className="hls-analytics__loading">Loading usage data…</div>
      </div>
    );
  }

  if (data.totalSessions === 0) {
    return (
      <div className="hls-analytics">
        <div className="hls-analytics__empty">
          No usage data yet. Usage tracking starts once the client-side tracking snippet is deployed on the public site.
        </div>
      </div>
    );
  }

  return (
    <div className="hls-analytics">
      <div className="hls-analytics__kpis">
        <div className="hls-analytics__kpi">
          <span className="hls-analytics__kpi-value">{data.totalSessions.toLocaleString()}</span>
          <span className="hls-analytics__kpi-label">Total Sessions</span>
        </div>
        <div className="hls-analytics__kpi">
          <span className="hls-analytics__kpi-value">{data.completedSessions.toLocaleString()}</span>
          <span className="hls-analytics__kpi-label">Completed</span>
        </div>
        <div className="hls-analytics__kpi">
          <span className="hls-analytics__kpi-value">{(data.abandonRate * 100).toFixed(0)}%</span>
          <span className="hls-analytics__kpi-label">Abandon Rate</span>
        </div>
        <div className="hls-analytics__kpi">
          <span className="hls-analytics__kpi-value">
            {data.avgDuration >= 60
              ? `${Math.floor(data.avgDuration / 60)}m ${data.avgDuration % 60}s`
              : `${data.avgDuration}s`}
          </span>
          <span className="hls-analytics__kpi-label">Avg Time</span>
        </div>
      </div>

      <div className="hls-analytics__grid">
        <div className="hls-analytics__card">
          <h3 className="hls-analytics__card-title">Daily Usage</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.dailyUsage} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-elevation-150)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--theme-elevation-400)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--theme-elevation-400)" />
              <ReTooltip
                contentStyle={{
                  background: 'var(--theme-elevation-0)',
                  border: '1px solid var(--theme-elevation-150)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="count" fill={COLORS.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="hls-analytics__card">
          <h3 className="hls-analytics__card-title">Completion</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.completionPie}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {data.completionPie.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <ReTooltip
                contentStyle={{
                  background: 'var(--theme-elevation-0)',
                  border: '1px solid var(--theme-elevation-150)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="hls-analytics__legend">
            {data.completionPie.map((entry) => (
              <div key={entry.name} className="hls-analytics__legend-item">
                <span className="hls-analytics__legend-dot" style={{ background: entry.color }} />
                <span>{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.fieldDropoff.length > 1 && (
        <div className="hls-analytics__card">
          <h3 className="hls-analytics__card-title">Drop-off by Input Field</h3>
          <p className="hls-analytics__card-sub">
            How many users reach each field. A sharp drop indicates where users disengage.
          </p>
          <ResponsiveContainer width="100%" height={Math.max(160, data.fieldDropoff.length * 40)}>
            <BarChart
              data={data.fieldDropoff}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 80, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-elevation-150)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--theme-elevation-400)" />
              <YAxis
                type="category"
                dataKey="fieldKey"
                tick={{ fontSize: 12 }}
                stroke="var(--theme-elevation-400)"
                width={76}
              />
              <ReTooltip
                contentStyle={{
                  background: 'var(--theme-elevation-0)',
                  border: '1px solid var(--theme-elevation-150)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="reached" fill={COLORS.blue} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
