export type UsageRecord = {
  id: string;
  tool: string;
  sessionId: string;
  startedAt: string;
  completedAt?: string;
  lastFieldReached?: string;
  totalFieldsCompleted?: number;
  totalFields?: number;
  completed?: boolean;
  duration?: number;
  referrer?: string;
  createdAt: string;
};

export type ToolAnalytics = {
  totalSessions: number;
  completedSessions: number;
  abandonRate: number;
  avgDuration: number;
  dailyUsage: { date: string; count: number; completed: number }[];
  fieldDropoff: { fieldKey: string; reached: number; percent: number }[];
};

export function computeToolAnalytics(records: UsageRecord[], totalInputFields: number): ToolAnalytics {
  const totalSessions = records.length;
  const completedSessions = records.filter((r) => r.completed).length;
  const abandonRate = totalSessions > 0 ? 1 - completedSessions / totalSessions : 0;
  const durations = records
    .filter((r) => r.completed && r.duration != null)
    .map((r) => r.duration!);
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

  const dayMap = new Map<string, { count: number; completed: number }>();
  for (const r of records) {
    const day = r.createdAt?.slice(0, 10) || 'unknown';
    const entry = dayMap.get(day) || { count: 0, completed: 0 };
    entry.count++;
    if (r.completed) entry.completed++;
    dayMap.set(day, entry);
  }
  const dailyUsage = Array.from(dayMap.entries())
    .map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const fieldCounts = new Map<string, number>();
  for (const r of records) {
    const key = r.lastFieldReached || '__start__';
    fieldCounts.set(key, (fieldCounts.get(key) || 0) + 1);
  }
  const totalSessionsWithField = records.filter((r) => r.totalFields != null && r.totalFields > 0).length;
  const fieldDropoff: { fieldKey: string; reached: number; percent: number }[] = [];
  const sortedKeys = Array.from(fieldCounts.keys()).sort();
  for (const key of sortedKeys) {
    const reached = fieldCounts.get(key) || 0;
    fieldDropoff.push({
      fieldKey: key === '__start__' ? 'Page loaded' : key,
      reached,
      percent: totalSessionsWithField > 0 ? reached / totalSessionsWithField : 0,
    });
  }

  return {
    totalSessions,
    completedSessions,
    abandonRate,
    avgDuration,
    dailyUsage,
    fieldDropoff,
  };
}
