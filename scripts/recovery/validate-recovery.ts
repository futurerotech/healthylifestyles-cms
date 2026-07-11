/**
 * Phase B — Offline validator (NO network, NO database).
 *
 * Validates the scraped artifact against strict invariants and recomputes the
 * content hash. Exits non-zero on any violation so a bad artifact can never
 * reach the restoration migration. Never mutates production; never fabricates.
 *
 * Usage: node cms/scripts/recovery/validate-recovery.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

// Resolve from the actual cwd — works whether run from the cms root (where the
// scraper writes) or a monorepo parent. Never assume the working directory.
const CANDIDATES = [
  path.resolve(process.cwd(), 'scripts/recovery/artifact/recovered-articles.json'),
  path.resolve(process.cwd(), 'cms/scripts/recovery/artifact/recovered-articles.json'),
];
const FILE = CANDIDATES.find((p) => fs.existsSync(p)) ?? CANDIDATES[0];
const MAX_TITLE = 300;
const MAX_EXCERPT = 2000;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(msgs: string[]): never {
  console.error(`validate-recovery: FAIL (${msgs.length} issue(s))`);
  for (const m of msgs) console.error('  ✗ ' + m);
  process.exit(1);
}

const raw = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf-8') : '';
if (!raw) fail([`artifact not found: ${path.relative(process.cwd(), FILE)} (run scrape-articles.ts first)`]);

let art: any;
try { art = JSON.parse(raw); } catch (e) { fail([`artifact is not valid JSON: ${(e as Error).message}`]); }

const errors: string[] = [];
if (art.schema !== 'hls.recovery.v1') errors.push(`unexpected schema: ${art.schema}`);
if (!Array.isArray(art.records)) fail(['records is not an array']);
if (Array.isArray(art.conflicts) && art.conflicts.length) errors.push(`unresolved scrape conflicts: ${art.conflicts.join(', ')}`);

const seen = new Set<string>();
const htmlish = /<[^>]+>|&(?:amp|lt|gt|quot|#\d+|#x[0-9a-f]+);/i;

for (const [i, r] of art.records.entries()) {
  const at = `record[${i}] slug=${r?.slug ?? '?'}`;
  if (typeof r?.slug !== 'string' || !SLUG_RE.test(r.slug)) errors.push(`${at}: invalid slug`);
  if (r?.slug && seen.has(r.slug)) errors.push(`${at}: duplicate slug`);
  if (r?.slug) seen.add(r.slug);
  if (typeof r?.title !== 'string' || r.title.trim() === '') errors.push(`${at}: empty/non-string title (never fabricate — omit instead)`);
  if (typeof r?.title === 'string') {
    if (r.title.length > MAX_TITLE) errors.push(`${at}: title exceeds ${MAX_TITLE} chars`);
    if (htmlish.test(r.title)) errors.push(`${at}: title still contains HTML/entities (normalize)`);
    if (r.title !== r.title.trim()) errors.push(`${at}: title not trimmed`);
    // Defense-in-depth: category ARCHIVE pages ("… Guides") are not articles and
    // must never enter an article restore (the scraper now excludes them via
    // JSON-LD @type; this is the offline backstop).
    if (/\bGuides$/.test(r.title)) errors.push(`${at}: looks like a category ARCHIVE page ("${r.title}"), not an article — re-scrape with the JSON-LD @type filter`);
  }
  if (r?.excerpt !== null && typeof r?.excerpt !== 'string') errors.push(`${at}: excerpt must be string or null`);
  if (typeof r?.excerpt === 'string') {
    if (r.excerpt.length > MAX_EXCERPT) errors.push(`${at}: excerpt exceeds ${MAX_EXCERPT} chars`);
    if (htmlish.test(r.excerpt)) errors.push(`${at}: excerpt still contains HTML/entities`);
    if (r.excerpt.trim() === '') errors.push(`${at}: excerpt is empty string (use null, not "")`);
  }
}

// Recompute the content hash exactly as the scraper does.
const canonical = JSON.stringify(art.records.map((r: any) => ({ slug: r.slug, title: r.title, excerpt: r.excerpt })));
const recomputed = createHash('sha256').update(canonical).digest('hex');
if (recomputed !== art.contentHash) errors.push(`contentHash mismatch: artifact=${art.contentHash} recomputed=${recomputed}`);
if (typeof art.articleCount === 'number' && art.articleCount !== art.records.length) {
  errors.push(`articleCount ${art.articleCount} != records ${art.records.length}`);
}

if (errors.length) fail(errors);
console.log(`validate-recovery: PASS — ${art.records.length} records, hash ${recomputed.slice(0, 12)}…, 0 conflicts.`);
console.log('Artifact is safe to review and feed to the restoration migration.');
