/**
 * Phase A — Forensic scraper (NETWORK ONLY; NO database, NO DB credentials).
 *
 * Recovers English `title` + `excerpt` from a surviving immutable frontend
 * deployment by reading the RENDERED HTML — the only place the values survive
 * after migration 20260711_184910 dropped articles.title / articles.excerpt.
 *
 * Extraction hierarchy is grounded in the frontend source of truth
 * (src/components/ArticleBody.astro): title = the article <h1>; excerpt =
 * <p class="lead wh-article__lead">. Nothing is inferred/fabricated: an article
 * page with no <h1> is skipped; a missing lead yields excerpt=null (Rule 8).
 *
 * Vercel Deployment Protection: the target deployment is SSO-protected. This
 * scraper does NOT perform a login flow. Instead it sends Vercel's official
 * "Protection Bypass for Automation" header, read from an env var and NEVER
 * logged, printed, or written to the artifact (Rule 2):
 *     VERCEL_AUTOMATION_BYPASS_SECRET   (set it in Vercel → Deployment Protection)
 *
 * Usage (run by a human/CI with network access — not from this session):
 *   RECOVERY_BASE_URL="https://<deployment>.vercel.app" \
 *   VERCEL_AUTOMATION_BYPASS_SECRET="<secret>" \
 *   node cms/scripts/recovery/scrape-articles.ts
 *
 * Output: cms/scripts/recovery/artifact/recovered-articles.json (deterministic,
 * slug-sorted, with a sha256 over the canonical content — no secrets).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

const BASE = (process.env.RECOVERY_BASE_URL || '').replace(/\/+$/, '');
if (!/^https:\/\/[^/]+$/.test(BASE)) {
  console.error('Set RECOVERY_BASE_URL to the deployment origin, e.g. https://x.vercel.app');
  process.exit(2);
}
const ORIGIN = new URL(BASE).origin;
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
const OUT_DIR = path.resolve(process.cwd(), 'cms/scripts/recovery/artifact');
const OUT_FILE = path.join(OUT_DIR, 'recovered-articles.json');

/** Headers: bypass secret sent but never logged. */
function headers(): Record<string, string> {
  const h: Record<string, string> = { 'user-agent': 'hls-recovery-scraper/1.0', accept: 'text/html,application/xml' };
  if (BYPASS) {
    h['x-vercel-protection-bypass'] = BYPASS;
    h['x-vercel-set-bypass-cookie'] = 'samesitenone';
  }
  return h;
}

async function get(url: string): Promise<string> {
  if (new URL(url).origin !== ORIGIN) throw new Error(`refusing off-origin fetch: ${url}`);
  const res = await fetch(url, { headers: headers(), redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location') || '';
    // A redirect to Vercel SSO means the bypass secret is missing/invalid.
    if (/vercel\.com\/sso-api/.test(loc)) {
      throw new Error('Deployment is SSO-protected and the bypass secret is missing/invalid (set VERCEL_AUTOMATION_BYPASS_SECRET).');
    }
    throw new Error(`unexpected redirect (${res.status}) for ${url}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

const stripTags = (s: string): string => s.replace(/<[^>]+>/g, '');
const norm = (s: string): string => decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();

/** Collect article URLs from the sitemap(s), restricted to this origin. */
async function discoverArticleUrls(): Promise<string[]> {
  const seeds = [`${BASE}/sitemap-index.xml`, `${BASE}/sitemap-0.xml`];
  const locs = new Set<string>();
  for (const seed of seeds) {
    let xml = '';
    try { xml = await get(seed); } catch { continue; }
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = m[1].trim();
      if (u.endsWith('.xml') && u.startsWith(ORIGIN)) {
        try { const child = await get(u); for (const c of child.matchAll(/<loc>([^<]+)<\/loc>/g)) locs.add(c[1].trim()); } catch { /* skip */ }
      } else if (u.startsWith(ORIGIN)) {
        locs.add(u);
      }
    }
  }
  // Article pages live at /wellness-hub/<slug> (one segment). Category archives
  // share the shape but are filtered out below by the absence of the lead.
  return [...locs].filter((u) => /\/wellness-hub\/[^/]+$/.test(new URL(u).pathname));
}

interface Rec { slug: string; title: string; excerpt: string | null; sourceUrl: string }

async function extract(url: string): Promise<Rec | null> {
  const html = await get(url);
  // Article detector: the lead paragraph class only exists on article pages.
  const isArticle = /class="[^"]*\bwh-article__lead\b[^"]*"/.test(html) || /<article[^>]*class="[^"]*\bwh-article\b/.test(html);
  if (!isArticle) return null; // category archive or other — not an article
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1 ? norm(h1[1]) : '';
  if (!title) return null; // no title → skip, never fabricate (Rule 8)
  const leadM = html.match(/<p[^>]*class="[^"]*\bwh-article__lead\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const excerpt = leadM ? norm(leadM[1]) || null : null;
  const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
  return { slug, title, excerpt, sourceUrl: new URL(url).pathname };
}

async function main(): Promise<void> {
  const urls = await discoverArticleUrls();
  console.log(`Discovered ${urls.length} candidate /wellness-hub/* URLs.`);
  const bySlug = new Map<string, Rec>();
  const conflicts: string[] = [];
  for (const url of urls) {
    let rec: Rec | null = null;
    try { rec = await extract(url); } catch (e) { console.error(`  ! ${url}: ${(e as Error).message}`); continue; }
    if (!rec) continue;
    const prev = bySlug.get(rec.slug);
    if (prev && (prev.title !== rec.title || prev.excerpt !== rec.excerpt)) {
      conflicts.push(rec.slug); // ambiguous → validator will reject (Rule 8)
    }
    bySlug.set(rec.slug, rec);
  }
  const records = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  const canonical = JSON.stringify(records.map((r) => ({ slug: r.slug, title: r.title, excerpt: r.excerpt })));
  const contentHash = createHash('sha256').update(canonical).digest('hex');
  const artifact = {
    schema: 'hls.recovery.v1',
    source: 'immutable-vercel-deployment-html',
    baseHost: new URL(BASE).host, // host only — no secret, no full protected URL query
    articleCount: records.length,
    conflicts,
    contentHash,
    records,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(artifact, null, 2) + '\n');
  console.log(`Wrote ${records.length} records (${conflicts.length} conflicts) → ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`contentHash=${contentHash}`);
  if (conflicts.length) console.error(`Conflicting slugs (must resolve before restore): ${conflicts.join(', ')}`);
}

main().catch((e) => { console.error('scrape failed:', (e as Error).message); process.exit(1); });
