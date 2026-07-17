/**
 * Site Audit — read-only PREVIEW runner (SEO Quality Gate, Phase 1).
 *
 * Runs the exact same scanner as the dashboard (src/lib/siteAudit.ts) against
 * the LIVE site but persists NOTHING — no SiteAudits row, no side effects.
 * Use it to verify scanner accuracy after changes (honest before/after counts)
 * without polluting the audit history.
 *
 * Usage: ./node_modules/.bin/payload run scripts/seo/audit-preview.ts
 */
import { getPayload } from 'payload';
import configPromise from '@payload-config';
import { runSiteAudit } from '../../src/lib/siteAudit';

const payload = await getPayload({ config: configPromise });
console.log('[INFO] running site audit (read-only preview — nothing persisted)…');
const res = await runSiteAudit(payload);

const issues = (res as { issues: { severity: string; category: string; message: string }[] }).issues;
const byClass = new Map<string, number>();
for (const i of issues) {
  const key = `${i.severity.padEnd(6)} ${i.category.padEnd(9)} ${i.message.replace(/[0-9]+/g, '#').slice(0, 70)}`;
  byClass.set(key, (byClass.get(key) ?? 0) + 1);
}
console.log(`\n[TOTAL] ${issues.length} issue(s)\n`);
for (const [k, c] of [...byClass.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(String(c).padStart(4), '×', k);
}
process.exit(0);
