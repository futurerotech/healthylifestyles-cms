/**
 * Phase A — Forensic scraper (NETWORK ONLY; NO database, NO DB credentials).
 * FIX v3: Handle Vercel 307 bypass-cookie redirect correctly.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

// ─── Config ────────────────────────────────────────────────────────────────

const BASE = (process.env.RECOVERY_BASE_URL || '').replace(/\/+$/, '');
if (!/^https:\/\/[^/]+$/.test(BASE)) {
  console.error('[ERROR] Set RECOVERY_BASE_URL to the Vercel deployment origin.');
  console.error('        Example: https://healthylifesstyles-abc123.vercel.app');
  process.exit(2);
}

const PRODUCTION_ORIGIN = 'https://www.healthylifesstyles.com';
const DEPLOY_ORIGIN     = new URL(BASE).origin;
const BYPASS            = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';

if (!BYPASS) {
  console.warn('[WARN] VERCEL_AUTOMATION_BYPASS_SECRET is not set — SSO-protected pages will fail.');
}

const EXCLUDED_PATTERNS = [
  /^\/ar\//,
  /^\/es\//,
  /^\/fr\//,
  /^\/de\//,
  /\/tag\//,
  /\/category\//,
  /\/page\/\d+/,
  /\/author\//,
];

const OUT_DIR  = path.resolve(process.cwd(), 'scripts/recovery/artifact');
const OUT_FILE = path.join(OUT_DIR, 'recovered-articles.json');

// ─── HTTP helpers ───────────────────────────────────────────────────────────

function bypassHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'user-agent': 'hls-recovery-scraper/1.0',
    'accept': 'text/html,application/xml',
  };
  if (BYPASS) {
    h['x-vercel-protection-bypass'] = BYPASS;
    h['x-vercel-set-bypass-cookie']  = 'samesitenone';
  }
  return h;
}

/** Fetch from PRODUCTION sitemap — public, no bypass needed. */
async function fetchFromProduction(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'hls-recovery-scraper/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Sitemap fetch failed: HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

/** Fetch from Vercel DEPLOYMENT — handles 307 bypass-cookie redirect. */
async function fetchFromDeployment(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.origin !== DEPLOY_ORIGIN) {
    throw new Error(`[SECURITY] Refusing off-origin fetch: ${url}`);
  }

  // First request — may return 307 to set bypass cookie
  const res1 = await fetch(url, {
    headers: bypassHeaders(),
    redirect: 'manual',
  });

  // Handle 307/302 bypass-cookie redirect
  if (res1.status === 307 || res1.status === 302) {
    const loc = res1.headers.get('location') || '';

    // Reject if redirected to Vercel SSO login
    if (/vercel\.com\/sso-api/.test(loc)) {
      throw new Error(
        'Deployment is SSO-protected and bypass secret is missing or invalid. ' +
        'Check VERCEL_AUTOMATION_BYPASS_SECRET.'
      );
    }

    // Collect Set-Cookie from first response
    const setCookie = res1.headers.get('set-cookie') || '';

    // Build follow-up URL (may be relative)
    const followUrl = loc.startsWith('http')
      ? loc
      : `${DEPLOY_ORIGIN}${loc}`;

    // Follow redirect with cookie + bypass headers
    const res2 = await fetch(followUrl, {
      headers: {
        ...bypassHeaders(),
        ...(setCookie ? { cookie: setCookie } : {}),
      },
      redirect: 'follow',
    });

    if (!res2.ok) {
      throw new Error(
        `HTTP ${res2.status} ${res2.statusText} after redirect for ${url}`
      );
    }
    return res2.text();
  }

  // Direct 200 response (no redirect needed)
  if (!res1.ok) {
    throw new Error(`HTTP ${res1.status} ${res1.statusText} for ${url}`);
  }

  return res1.text();
}

// ─── Text utilities ─────────────────────────────────────────────────────────

const decodeEntities = (s: string): string =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g,         (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g,  ' ')
    .replace(/&amp;/g,   '&')
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/&quot;/g,  '"')
    .replace(/&#39;|&apos;/g, "'");

const stripTags = (s: string): string => s.replace(/<[^>]+>/g, '');
const norm      = (s: string): string =>
  decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();

// ─── Discovery ──────────────────────────────────────────────────────────────

async function discoverArticleUrls(): Promise<string[]> {
  const productionPaths = new Set<string>();

  const sitemapSeeds = [
    `${PRODUCTION_ORIGIN}/sitemap-index.xml`,
    `${PRODUCTION_ORIGIN}/sitemap-0.xml`,
  ];

  for (const seed of sitemapSeeds) {
    let xml = '';
    try {
      xml = await fetchFromProduction(seed);
      console.log(`[Sitemap] Fetched: ${seed}`);
    } catch (e) {
      console.warn(`[Sitemap] Skipping ${seed}: ${(e as Error).message}`);
      continue;
    }

    const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)]
      .map((m) => m[1].trim());

    for (const loc of locs) {
      if (loc.endsWith('.xml')) {
        try {
          const child     = await fetchFromProduction(loc);
          const childLocs = [...child.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)]
            .map((m) => m[1].trim());
          for (const cl of childLocs) {
            try { productionPaths.add(new URL(cl).pathname); } catch { /* skip */ }
          }
          console.log(`[Sitemap] Child: ${loc} → ${childLocs.length} URLs`);
        } catch (e) {
          console.warn(`[Sitemap] Failed child ${loc}: ${(e as Error).message}`);
        }
      } else {
        try { productionPaths.add(new URL(loc).pathname); } catch { /* skip */ }
      }
    }
  }

  console.log(`[Discovery] Total URLs from sitemap: ${productionPaths.size}`);

  const articlePaths = [...productionPaths].filter((pathname) => {
    if (!pathname.startsWith('/wellness-hub/')) return false;
    const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
    if (segments.length < 2) return false;
    if (EXCLUDED_PATTERNS.some((re) => re.test(pathname))) return false;
    return true;
  });

  console.log(`[Discovery] English articles after filtering: ${articlePaths.length}`);

  return articlePaths.map((pathname) => `${DEPLOY_ORIGIN}${pathname}`);
}

// ─── Extraction ─────────────────────────────────────────────────────────────

interface Rec {
  slug     : string;
  title    : string;
  excerpt  : string | null;
  sourceUrl: string;
}

async function extract(deploymentUrl: string): Promise<Rec | null> {
  const html = await fetchFromDeployment(deploymentUrl);

  // Discriminate by JSON-LD @type, NOT by CSS class: category ARCHIVE pages
  // (ArticleArchiveBody) reuse `.wh-article__lead` for the category blurb, so a
  // class check false-positives on them. Article pages emit an Article node;
  // archives emit CollectionPage. Require the former, reject the latter.
  const hasArticleLd = /"@type"\s*:\s*(?:"Article"|\[[^\]]*"Article"[^\]]*\])/.test(html);
  const isCollection = /"@type"\s*:\s*"CollectionPage"/.test(html);
  if (!hasArticleLd || isCollection) return null; // articles only — never category archives

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title   = h1Match ? norm(h1Match[1]) : '';
  if (!title) return null;

  const leadMatch = html.match(
    /<p[^>]*class="[^"]*\bwh-article__lead\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i
  );
  const excerpt = leadMatch ? norm(leadMatch[1]) || null : null;

  const pathname = new URL(deploymentUrl).pathname;
  const slug     = pathname.split('/').filter(Boolean).pop() || '';

  return { slug, title, excerpt, sourceUrl: pathname };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[Recovery] Starting forensic scrape...');
  console.log(`[Recovery] Sitemap source : ${PRODUCTION_ORIGIN}`);
  console.log(`[Recovery] Fetching from  : ${DEPLOY_ORIGIN}`);

  const urls = await discoverArticleUrls();

  if (urls.length === 0) {
    console.error('[ERROR] No article URLs discovered. Check sitemap and filters.');
    process.exit(1);
  }

  console.log(`[Scraper] Processing ${urls.length} URLs...`);

  const bySlug    = new Map<string, Rec>();
  const conflicts : string[] = [];
  const failed    : string[] = [];

  const BATCH_SIZE = 5;
  const DELAY_MS   = 500;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch   = urls.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(extract));

    results.forEach((result, idx) => {
      const url = batch[idx];
      const num = i + idx + 1;

      if (result.status === 'rejected') {
        console.error(`  [${num}/${urls.length}] ✗ ${url}: ${result.reason?.message}`);
        failed.push(url);
        return;
      }

      const rec = result.value;
      if (!rec) {
        console.log(`  [${num}/${urls.length}] – Skipped (not an article): ${url}`);
        return;
      }

      const prev = bySlug.get(rec.slug);
      if (prev && (prev.title !== rec.title || prev.excerpt !== rec.excerpt)) {
        console.warn(`  [${num}/${urls.length}] ⚠ Conflict: ${rec.slug}`);
        conflicts.push(rec.slug);
      }

      bySlug.set(rec.slug, rec);
      console.log(`  [${num}/${urls.length}] ✓ ${rec.title}`);
    });

    if (i + BATCH_SIZE < urls.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  const records = [...bySlug.values()].sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );

  const canonical   = JSON.stringify(
    records.map((r) => ({ slug: r.slug, title: r.title, excerpt: r.excerpt }))
  );
  const contentHash = createHash('sha256').update(canonical).digest('hex');

  const artifact = {
    schema       : 'hls.recovery.v1',
    source       : 'immutable-vercel-deployment-html',
    baseHost     : new URL(BASE).host,
    sitemapSource: PRODUCTION_ORIGIN,
    articleCount : records.length,
    failedCount  : failed.length,
    conflicts,
    contentHash,
    records,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(artifact, null, 2) + '\n');

  console.log('\n[Recovery Complete]');
  console.log(`  Articles recovered : ${records.length}`);
  console.log(`  Failed / Skipped   : ${failed.length}`);
  console.log(`  Conflicts          : ${conflicts.length}`);
  console.log(`  Content hash       : ${contentHash}`);
  console.log(`  Output             : ${path.relative(process.cwd(), OUT_FILE)}`);

  if (conflicts.length) {
    console.error(`\n[WARN] Conflicts:\n  ${conflicts.join('\n  ')}`);
  }

  if (records.length === 0) {
    console.error('\n[ERROR] Zero articles recovered.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[FATAL] scrape failed:', (e as Error).message);
  process.exit(1);
});