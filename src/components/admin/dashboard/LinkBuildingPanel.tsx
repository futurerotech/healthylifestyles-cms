import React from 'react';
import config from '@payload-config';
import { getPayload } from 'payload';
import { Link2, Clock, Trophy, Globe } from 'lucide-react';

/**
 * Link Building panel on the admin dashboard: links won this month, pending
 * follow-ups (reminders), outreach win rate, links by target page, and the
 * sites embedding our calculators (each one a natural backlink + warm lead).
 * Server component — aggregates via the Local API like the rest of Dashboard.
 */

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export async function LinkBuildingPanel() {
  const payload = await getPayload({ config });
  const list = (args: Record<string, unknown>) =>
    safe(() => payload.find(args as any).then((r) => r.docs as any[]), [] as any[]);

  const [backlinks, prospects, embeds] = await Promise.all([
    list({ collection: 'backlinks', limit: 2000, depth: 0, sort: '-dateEarned' }),
    list({ collection: 'link-prospects', limit: 2000, depth: 0 }),
    list({ collection: 'embed-logs', limit: 2000, depth: 0, sort: '-count' }),
  ]);

  // Links won this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const wonThisMonth = backlinks.filter((b) => {
    const t = new Date(b.dateEarned || b.createdAt).getTime();
    return !Number.isNaN(t) && t >= monthStart;
  }).length;

  // Pending follow-ups: due (or overdue) and still in play
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
  const followUps = prospects
    .filter((p) => {
      if (!p.followUpDate || p.status === 'won' || p.status === 'rejected') return false;
      const t = new Date(p.followUpDate).getTime();
      return !Number.isNaN(t) && t <= endOfToday;
    })
    .sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime())
    .slice(0, 6);

  // Win rate of decided outreach
  const won = prospects.filter((p) => p.status === 'won').length;
  const rejected = prospects.filter((p) => p.status === 'rejected').length;
  const winRate = won + rejected > 0 ? won / (won + rejected) : null;

  // Links by target page (top 5)
  const byTarget = new Map<string, number>();
  for (const b of backlinks) {
    const key = (b.targetPage || '—').replace(/^https?:\/\/[^/]+/i, '') || '/';
    byTarget.set(key, (byTarget.get(key) || 0) + 1);
  }
  const topTargets = [...byTarget.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Top embedding hosts (top 5)
  const byHost = new Map<string, number>();
  for (const e of embeds) byHost.set(e.referrerHost, (byHost.get(e.referrerHost) || 0) + (e.count || 1));
  const topHosts = [...byHost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const liveLinks = backlinks.filter((b) => b.liveStatus === 'live').length;
  const lostLinks = backlinks.filter((b) => b.liveStatus === 'lost').length;

  const CARDS = [
    { icon: <Trophy size={18} />, label: 'Links won this month', value: String(wonThisMonth), sub: `${backlinks.length} total · ${liveLinks} live · ${lostLinks} lost`, href: '/admin/collections/backlinks', color: '#22c55e' },
    { icon: <Clock size={18} />, label: 'Pending follow-ups', value: String(followUps.length), sub: followUps.length ? 'due now — see below' : 'nothing due', href: '/admin/collections/link-prospects', color: '#f59e0b' },
    { icon: <Link2 size={18} />, label: 'Outreach win rate', value: winRate === null ? '—' : `${Math.round(winRate * 100)}%`, sub: `${won} won · ${rejected} rejected`, href: '/admin/collections/link-prospects', color: '#3b82f6' },
    { icon: <Globe size={18} />, label: 'Sites embedding tools', value: String(byHost.size), sub: `${embeds.reduce((s, e) => s + (e.count || 1), 0)} embed loads`, href: '/admin/collections/embed-logs', color: '#8b5cf6' },
  ];

  return (
    <div className="hls-bi__card hls-bi__card--span2" style={{ marginTop: '1rem' }}>
      <div className="hls-bi__card-head">
        <h2>Link Building</h2>
        <span className="hls-bi__badge">white-hat outreach</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {CARDS.map((c) => (
          <a key={c.label} href={c.href} style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--theme-elevation-100)', borderRadius: 10, padding: '0.75rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c.color, fontSize: 12, fontWeight: 700 }}>
              {c.icon} {c.label}
            </span>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.3 }}>{c.value}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{c.sub}</div>
          </a>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: 13, margin: '0 0 6px', opacity: 0.8 }}>Follow-ups due</h3>
          {followUps.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>No follow-ups due. Add followUpDate on prospects to get reminders here.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
              {followUps.map((p) => (
                <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--theme-elevation-100)' }}>
                  <a href={`/admin/collections/link-prospects/${p.id}`} style={{ fontWeight: 600 }}>{p.siteName}</a>
                  <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>{fmtDate(p.followUpDate)} · {p.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 style={{ fontSize: 13, margin: '0 0 6px', opacity: 0.8 }}>Links by target page</h3>
          {topTargets.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>No backlinks logged yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
              {topTargets.map(([page, n]) => (
                <li key={page} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--theme-elevation-100)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page}</span>
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 style={{ fontSize: 13, margin: '0 0 6px', opacity: 0.8 }}>Top embedding sites</h3>
          {topHosts.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>No embeds logged yet — every embed is a backlink you didn’t have to ask for.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
              {topHosts.map(([host, n]) => (
                <li key={host} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--theme-elevation-100)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{host}</span>
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
