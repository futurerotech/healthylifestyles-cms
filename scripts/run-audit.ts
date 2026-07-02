/**
 * CLI Site Audit runner — same engine the dashboard uses, printed to stdout.
 *
 *   npx payload run scripts/run-audit.ts
 *
 * Make sure NEXT_PUBLIC_SITE_URL points at the site you mean to scan (the
 * audit crawls THAT origin); local .env defaults it to localhost:4321, so
 * override it for a production scan. Read-only: never edits content.
 */
import { getPayload } from 'payload';
import config from '@payload-config';
import { runSiteAudit } from '../src/lib/siteAudit';

const payload = await getPayload({ config });

console.log(`Scanning ${process.env.NEXT_PUBLIC_SITE_URL || '(default site)'} …`);
const started = Date.now();
const r = await runSiteAudit(payload);

console.log('');
console.log(`HEALTH SCORE: ${r.healthScore}/100   (${((Date.now() - started) / 1000).toFixed(0)}s, ${r.pagesScanned} pages)`);
console.log(`Issues: ${r.high} high · ${r.medium} medium · ${r.low} low`);
console.log('');

const CAT = { technical: 'TECH ', eeat: 'EEAT ', content: 'CONT ', admin: 'ADMIN' } as Record<string, string>;
for (const i of r.issues) {
  console.log(`[${i.severity.toUpperCase().padEnd(6)}] [${CAT[i.category] || i.category}] ${i.page}`);
  console.log(`         ${i.message}`);
  console.log(`         fix: ${i.fix}${i.adminPath ? `  → ${i.adminPath}` : ''}`);
}

process.exit(0);
