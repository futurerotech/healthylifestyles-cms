import React from 'react';
import config from '@payload-config';
import { getPayload } from 'payload';
import { DollarSign, Activity, FlaskConical, Mail, UserPlus, FilePlus2, ArrowLeftRight } from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { KpiSparkline } from './KpiSparkline';
import { CmdPaletteTrigger } from './CmdPaletteTrigger';
import { RevenueChart } from './dashboard/RevenueChart';
import { SessionsChart } from './dashboard/SessionsChart';
import { GrowthChart } from './dashboard/GrowthChart';
import { FunnelChart } from './dashboard/FunnelChart';
import { DonutCard } from './dashboard/DonutCard';
import { computeToolAnalytics, type UsageRecord } from '../../lib/analytics';
import { SeoIndexingEngine } from '../dashboard/SeoIndexingEngine';
import { LinkBuildingPanel } from './dashboard/LinkBuildingPanel';
import { SiteAuditPanel } from './dashboard/SiteAuditPanel';

type AdminUser = { name?: string | null; email?: string | null } | null | undefined;
type Props = { user?: AdminUser };

/** Accent colors — mirrored by CSS vars --hls-accent-blue/violet in custom.scss. */
const ACCENTS = {
  green: '#22c55e',
  blue: '#3b82f6',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

/** Bucket a list of timestamps into N weekly counts (oldest → newest). */
function weeklyCounts(dates: (string | Date | undefined)[], weeks = 8): number[] {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const out = new Array(weeks).fill(0);
  for (const d of dates) {
    const t = new Date(d as string).getTime();
    if (Number.isNaN(t)) continue;
    const elapsed = now - t;
    if (elapsed >= 0 && elapsed < weeks * weekMs) {
      const idx = weeks - 1 - Math.floor(elapsed / weekMs);
      if (idx >= 0 && idx < weeks) out[idx]++;
    }
  }
  return out;
}

/** Compact week labels for chart x-axis (oldest → newest). */
const weekLabels = (weeks = 8): string[] => {
  const out: string[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    out.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return out;
};

export async function Dashboard({ user }: Props) {
  const payload = await getPayload({ config });

  const count = (collection: string, where?: Record<string, unknown>) =>
    safe(() => payload.count({ collection: collection as any, where: where as any }).then((r) => r.totalDocs), 0);
  const list = (args: Record<string, unknown>) =>
    safe(() => payload.find(args as any).then((r) => r.docs as any[]), [] as any[]);

  // ---- Real aggregates (Local API, server-side) ----
  const [toolUsage, profiles, subscribers, leads, pushHistory, toolsTotal, articlesPub, usersCount, audienceCfg] = await Promise.all([
    list({ collection: 'tool-usage', limit: 5000, depth: 0, sort: '-createdAt' }),
    list({ collection: 'profiles', limit: 5000, depth: 0 }),
    list({ collection: 'subscribers', limit: 5000, depth: 0, sort: '-subscribedAt' }),
    list({ collection: 'leads', limit: 5000, depth: 0, sort: '-createdAt' }),
    list({ collection: 'push-history', limit: 5000, depth: 0 }),
    count('tools'),
    count('articles', { _status: { equals: 'published' } }),
    count('users'),
    safe(() => payload.findGlobal({ slug: 'audience', depth: 0 }), null as any),
  ]);

  const projectedRpm = (audienceCfg as any)?.projectedRpm ?? 8;

  // ---- Tool-usage analytics (real sessions/completion/duration) ----
  const analytics = computeToolAnalytics(
    toolUsage.map((r) => ({ ...r, createdAt: r.createdAt || r.startedAt }) as UsageRecord),
    0,
  );
  const totalSessions = analytics.totalSessions;
  const completionRate = totalSessions > 0 ? analytics.completedSessions / totalSessions : 0;

  // ---- Active users = profiles active in last 30 days ----
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const activeUsers = profiles.filter((p) => {
    const t = new Date(p.lastActiveAt || p.updatedAt || p.createdAt).getTime();
    return !Number.isNaN(t) && t >= thirtyDaysAgo;
  }).length;

  // ---- Push delivery rate ----
  const pushSent = pushHistory.reduce((sum, h) => sum + (h.sentCount || 0), 0);
  const pushFailed = pushHistory.reduce((sum, h) => sum + (h.failedCount || 0), 0);
  const pushRate = pushSent + pushFailed > 0 ? pushSent / (pushSent + pushFailed) : 0;

  // ---- Time-series (last 8 weeks) ----
  const labels = weekLabels();
  const sessionsByWeek = weeklyCounts(toolUsage.map((r) => r.createdAt || r.startedAt));
  const completedByWeek = weeklyCounts(toolUsage.filter((r) => r.completed).map((r) => r.createdAt || r.startedAt));
  const subsByWeek = weeklyCounts(subscribers.map((s) => s.subscribedAt || s.createdAt));
  const leadsByWeek = weeklyCounts(leads.map((l) => l.createdAt));

  // Projected revenue per week = sessions × RPM / 1000
  const revenueByWeek = sessionsByWeek.map((s) => (s * projectedRpm) / 1000);
  const projectedRevenue = revenueByWeek.reduce((a, b) => a + b, 0);

  // ---- KPI cards ----
  const KPIS = [
    {
      icon: <DollarSign size={18} />,
      label: 'Projected Revenue',
      value: `$${Math.round(projectedRevenue).toLocaleString()}`,
      sub: `8w · ${projectedRpm.toFixed(2)} RPM`,
      spark: revenueByWeek,
      color: ACCENTS.violet,
      href: '/admin/globals/audience',
      badge: 'Projected',
    },
    {
      icon: <Activity size={18} />,
      label: 'Active Users',
      value: activeUsers.toLocaleString(),
      sub: 'last 30 days',
      spark: subsByWeek,
      color: ACCENTS.blue,
      href: '/admin/collections/profiles',
    },
    {
      icon: <FlaskConical size={18} />,
      label: 'Tool Sessions',
      value: totalSessions.toLocaleString(),
      sub: `${Math.round(completionRate * 100)}% complete`,
      spark: sessionsByWeek,
      color: ACCENTS.green,
      href: '/admin/collections/tool-usage',
    },
    {
      icon: <Mail size={18} />,
      label: 'Subscribers',
      value: subscribers.length.toLocaleString(),
      sub: `${leads.length} leads`,
      spark: subsByWeek,
      color: ACCENTS.amber,
      href: '/admin/collections/subscribers',
    },
  ];

  // ---- Chart datasets ----
  const revenueData = labels.map((label, i) => ({ label, value: revenueByWeek[i] }));
  const sessionsData = labels.map((label, i) => ({ label, sessions: sessionsByWeek[i], completed: completedByWeek[i] }));
  const growthData = labels.map((label, i) => ({ label, subscribers: subsByWeek[i], leads: leadsByWeek[i] }));
  const funnelData = [
    { stage: 'Sessions', value: totalSessions, color: ACCENTS.green },
    { stage: 'Completed', value: analytics.completedSessions, color: ACCENTS.blue },
    { stage: 'Leads', value: leads.length, color: ACCENTS.violet },
    { stage: 'Subscribers', value: subscribers.length, color: ACCENTS.amber },
  ].filter((d) => d.value > 0);

  const ACTIONS = [
    { icon: <FilePlus2 size={16} />, label: 'New article', href: '/admin/collections/articles/create' },
    { icon: <FlaskConical size={16} />, label: 'New tool', href: '/admin/collections/tools/create' },
    { icon: <UserPlus size={16} />, label: 'New author', href: '/admin/collections/authors/create' },
    { icon: <ArrowLeftRight size={16} />, label: 'Manage redirects', href: '/admin/collections/redirects' },
  ];

  const firstName = (user?.name || '').trim().split(/\s+/)[0] || (user?.email || '').split('@')[0] || 'there';
  const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <section className="hls-bi" aria-label="Dashboard">
      <CommandPalette />

      <header className="hls-bi__header">
        <div className="hls-bi__welcome">
          <span className="hls-bi__mark" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 48 48">
              <defs>
                <linearGradient id="hls-bi-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#22c55e" />
                  <stop offset="1" stopColor="#16a34a" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#hls-bi-grad)" />
              <path d="M9 25h6l3-9 5 16 4-11 2.5 4H39" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h1>Welcome back, {firstName}</h1>
            <p className="hls-bi__sub">Updated {now} · {toolsTotal} tools · {articlesPub} articles · {usersCount} users</p>
          </div>
        </div>
        <CmdPaletteTrigger />
      </header>

      {/* ---- KPI strip ---- */}
      <div className="hls-bi__kpis">
        {KPIS.map((k) => (
          <a key={k.label} className="hls-bi__kpi" href={k.href}>
            <div className="hls-bi__kpi-top">
              <span className="hls-bi__kpi-icon" style={{ color: k.color }}>{k.icon}</span>
              {k.badge && <span className="hls-bi__badge">{k.badge}</span>}
              {k.spark.length >= 2 && <span className="hls-bi__kpi-spark"><KpiSparkline data={k.spark} color={k.color} /></span>}
            </div>
            <span className="hls-bi__kpi-value">{k.value}</span>
            <span className="hls-bi__kpi-label">{k.label}</span>
            <span className="hls-bi__kpi-sub">{k.sub}</span>
          </a>
        ))}
      </div>

      {/* ---- Live graphs ---- */}
      <div className="hls-bi__grid">
        <div className="hls-bi__card hls-bi__card--span2">
          <div className="hls-bi__card-head">
            <h2>Projected Revenue</h2>
            <span className="hls-bi__badge">sessions × {projectedRpm.toFixed(2)} RPM</span>
          </div>
          <RevenueChart data={revenueData} />
        </div>

        <div className="hls-bi__card">
          <div className="hls-bi__card-head">
            <h2>Completion Rate</h2>
          </div>
          <DonutCard rate={completionRate} label="completed" color={ACCENTS.green} />
        </div>

        <div className="hls-bi__card">
          <div className="hls-bi__card-head">
            <h2>Tool Sessions</h2>
            <span className="hls-bi__legend"><i style={{ background: ACCENTS.blue }} /> sessions <i style={{ background: ACCENTS.green }} /> completed</span>
          </div>
          <SessionsChart data={sessionsData} />
        </div>

        <div className="hls-bi__card">
          <div className="hls-bi__card-head">
            <h2>Audience Growth</h2>
            <span className="hls-bi__legend"><i style={{ background: ACCENTS.green }} /> subscribers <i style={{ background: ACCENTS.blue }} /> leads</span>
          </div>
          <GrowthChart data={growthData} />
        </div>

        <div className="hls-bi__card">
          <div className="hls-bi__card-head">
            <h2>Conversion Funnel</h2>
          </div>
          <FunnelChart data={funnelData} />
        </div>

        <div className="hls-bi__card hls-bi__card--span2">
          <div className="hls-bi__card-head">
            <h2>Push Delivery</h2>
            <span className="hls-bi__badge">{pushSent.toLocaleString()} sent</span>
          </div>
          <DonutCard rate={pushRate} label="delivered" color={ACCENTS.blue} />
        </div>
      </div>

      {/* ---- Quick actions ---- */}
      <div className="hls-bi__actions">
        {ACTIONS.map((a) => (
          <a key={a.label} className="hls-bi__action" href={a.href}>
            {a.icon}
            <span>{a.label}</span>
          </a>
        ))}
      </div>

      {/* ---- Site Audit ---- */}
      <SiteAuditPanel />

      {/* ---- Link Building & Outreach ---- */}
      <LinkBuildingPanel />

      {/* ---- SEO Indexing Engine ---- */}
      <SeoIndexingEngine />
    </section>
  );
}
