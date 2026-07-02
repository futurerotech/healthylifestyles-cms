import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Payload } from 'payload';

/**
 * Site Audit engine — crawls the LIVE Astro site (sitemap-driven) plus the CMS
 * content (Local API) and produces severity-graded issues across three
 * categories: technical/indexing, E-E-A-T/YMYL, and content health.
 *
 * READ-ONLY by design: it never edits content — every issue carries a one-line
 * fix and, where the page maps to a CMS record, an admin path for a one-click
 * jump. Runs server-side with bounded concurrency and hard caps so a scan
 * finishes in a couple of minutes and can never hammer the site.
 */

export interface AuditIssue {
  severity: 'high' | 'medium' | 'low';
  category: 'technical' | 'eeat' | 'content' | 'admin';
  page: string;
  message: string;
  fix: string;
  adminPath?: string;
}

export interface AuditResult {
  healthScore: number;
  pagesScanned: number;
  high: number;
  medium: number;
  low: number;
  issues: AuditIssue[];
}

/* ─────────────────────────── config ─────────────────────────── */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.healthylifesstyles.com').replace(/\/$/, '');
const SITE_HOST = new URL(SITE).hostname.replace(/^www\./, '');
const UA = 'HealthyLifeStyles-SiteAudit/1.0 (+' + SITE + ')';
const MAX_PAGES = 300;
const MAX_LINK_CHECKS = 150;
const MAX_IMG_CHECKS = 150;
const MAX_EXT_CHECKS = 60;
const CONCURRENCY = 6;
const FETCH_TIMEOUT = 12_000;

const TRUST_PAGES = ['/about', '/contact', '/privacy', '/terms', '/medical-disclaimer', '/editorial-policy', '/methodology'];
const DISCLAIMER_RX = /not (a substitute for|medical advice)|medical disclaimer|educational (purposes|use) only|consult (a|your) (doctor|physician|healthcare|clinician)/i;
const STOPWORDS = new Set(['a', 'an', 'the', 'to', 'for', 'of', 'and', 'or', 'in', 'on', 'your', 'you', 'is', 'are', 'how', 'what', 'by', 'with', 'per']);

/* ─────────────────────────── helpers ─────────────────────────── */

async function fetchPage(url: string): Promise<{ status: number; text: string; bytes: number } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' } });
    clearTimeout(timer);
    const text = await res.text();
    return { status: res.status, text, bytes: Buffer.byteLength(text) };
  } catch {
    return null;
  }
}

/** HEAD with GET fallback; returns status or 0 on network failure. */
async function checkUrl(url: string): Promise<number> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { method, signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': UA } });
      clearTimeout(timer);
      if (method === 'HEAD' && (res.status === 405 || res.status === 501)) continue;
      return res.status;
    } catch {
      if (method === 'GET') return 0;
    }
  }
  return 0;
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

const attr = (tag: string, name: string): string => {
  const m = tag.match(new RegExp(name + '\\s*=\\s*["\']([^"\']*)["\']', 'i'));
  return m ? m[1] : '';
};

const first = (html: string, rx: RegExp): string => {
  const m = html.match(rx);
  return m ? m[1].trim() : '';
};

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize an href to an absolute URL; '' when it's not a page link. */
function absUrl(href: string, base: string): string {
  if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:|data:)/i.test(href)) return '';
  try {
    const u = new URL(href, base);
    u.hash = '';
    return u.href.replace(/\/$/, '') || u.href;
  } catch {
    return '';
  }
}

const isInternal = (url: string): boolean => {
  try {
    return new URL(url).hostname.replace(/^www\./, '') === SITE_HOST;
  } catch {
    return false;
  }
};

/** Significant-token set of a title (for duplicate/cannibalization checks). */
function titleTokens(title: string): Set<string> {
  const cleaned = title.split(/[—|–-]\s*Healthy/i)[0]; // strip "— HealthyLifeStyles" suffix
  return new Set(
    cleaned
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/* ─────────────────────────── admin UX: contrast math ─────────────────────────── */

/** WCAG relative luminance of a 3/6-digit hex (no #). */
function luminance(hex: string): number {
  const h = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (no #). */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The admin theme's canonical surfaces (must match custom.scss). */
const DARK_SURFACE = '14243a';
const LIGHT_SURFACE = 'ffffff';
const AA = 4.5;

/**
 * ADMIN / UX health. Deterministic, non-visual checks:
 *  1. Stylesheet contrast scan — every literal `color: #hex` in the admin CSS is
 *     contrast-checked against its own literal background (badges) or against
 *     both theme surfaces; unscoped text with no [data-theme='dark'] override
 *     that fails on the dark card surface is exactly the dark-on-dark bug class.
 *  2. Inline-style scan of admin components (`color: '#hex'`) — inline styles
 *     apply in BOTH themes, so they must pass on both surfaces.
 *  3. Collection list-view config — missing admin.defaultColumns (raw noisy
 *     lists that look empty/unscannable) and useAsTitle left on `id`.
 * File reads are best-effort: on a build without source files the scans skip
 * silently rather than fail the audit.
 */
async function auditAdminUx(payload: Payload, add: (severity: AuditIssue['severity'], category: AuditIssue['category'], page: string, message: string, fix: string, adminPath?: string) => void): Promise<void> {
  /* ---- 1. stylesheet contrast scan ---- */
  const cssFiles = ['src/app/(payload)/custom.scss', 'src/styles/theme-override.css'];
  for (const rel of cssFiles) {
    let css = '';
    try {
      css = await readFile(path.join(process.cwd(), rel), 'utf8');
    } catch {
      continue;
    }
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');

    interface Rule { selector: string; body: string; dark: boolean }
    const rules: Rule[] = [];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1].trim();
      if (!selector || selector.startsWith('@') || /^\d|^from$|^to$/.test(selector)) continue;
      rules.push({ selector, body: m[2], dark: /\[data-theme=.?dark/.test(selector) });
    }

    // Class tokens that get a text color inside a dark-scoped rule (= has override).
    const darkColorClasses = new Set<string>();
    for (const r of rules) {
      if (r.dark && /(?:^|;)\s*color\s*:/.test(r.body)) {
        for (const t of r.selector.matchAll(/\.[a-zA-Z][\w-]*/g)) darkColorClasses.add(t[0]);
      }
    }

    for (const r of rules) {
      const colorHex = r.body.match(/(?:^|;)\s*color\s*:\s*#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/)?.[1];
      if (!colorHex) continue;
      const bgHex = r.body.match(/(?:^|;)\s*background(?:-color)?\s*:\s*#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/)?.[1];
      const sel = r.selector.replace(/\s+/g, ' ').slice(0, 70);
      const file = path.basename(rel);

      if (bgHex) {
        // Self-contained pair (badge/pill) — theme-independent.
        const ratio = contrast(colorHex, bgHex);
        if (ratio < AA)
          add(ratio < 3 ? 'high' : 'medium', 'admin', file, `Badge/text "${sel}" is #${colorHex} on #${bgHex} (${ratio.toFixed(1)}:1 — needs 4.5:1).`, 'Use a darker/lighter pair, or theme variables.');
        continue;
      }

      if (r.dark) {
        const ratio = contrast(colorHex, DARK_SURFACE);
        if (ratio < AA)
          add('high', 'admin', file, `Dark-mode text "${sel}" is #${colorHex} on the dark surface (${ratio.toFixed(1)}:1).`, 'Lighten the color (aim ≥4.5:1 on #14243a).');
        continue;
      }

      // Unscoped rule: applies to both themes unless a dark override exists.
      const lightRatio = contrast(colorHex, LIGHT_SURFACE);
      if (lightRatio < AA)
        add('medium', 'admin', file, `Text "${sel}" is #${colorHex} on light surfaces (${lightRatio.toFixed(1)}:1).`, 'Darken the color or use var(--theme-text)/elevation tokens.');
      const hasOverride = [...r.selector.matchAll(/\.[a-zA-Z][\w-]*/g)].some((t) => darkColorClasses.has(t[0]));
      const darkRatio = contrast(colorHex, DARK_SURFACE);
      if (!hasOverride && darkRatio < AA)
        add('high', 'admin', file, `Text "${sel}" (#${colorHex}) has NO [data-theme='dark'] override and reads ${darkRatio.toFixed(1)}:1 on dark surfaces — dark-on-dark.`, "Add a html[data-theme='dark'] override or switch to var(--theme-text).");
    }
  }

  /* ---- 2. inline styles in admin components ---- */
  const componentDirs = ['src/components/admin', 'src/components/dashboard'];
  for (const dir of componentDirs) {
    let files: string[] = [];
    try {
      files = (await readdir(path.join(process.cwd(), dir), { recursive: true, withFileTypes: true }))
        .filter((e) => e.isFile() && e.name.endsWith('.tsx'))
        .map((e) => path.join(e.parentPath ?? (e as unknown as { path: string }).path, e.name));
    } catch {
      continue;
    }
    for (const file of files) {
      let src = '';
      try {
        src = await readFile(file, 'utf8');
      } catch {
        continue;
      }
      const failing = new Set<string>();
      for (const m of src.matchAll(/color:\s*['"]#([0-9a-fA-F]{6})['"]/g)) {
        const hex = m[1];
        const failsLight = contrast(hex, LIGHT_SURFACE) < AA;
        const failsDark = contrast(hex, DARK_SURFACE) < AA;
        if (failsLight || failsDark) failing.add(`#${hex}${failsLight && failsDark ? ' (both themes)' : failsLight ? ' (light)' : ' (dark)'}`);
      }
      if (failing.size) {
        const name = path.basename(file);
        const both = [...failing].some((f) => f.includes('both'));
        add(both ? 'medium' : 'low', 'admin', name, `Inline text color(s) below 4.5:1 in ${name}: ${[...failing].join(', ')}.`, 'Inline styles hit both themes — use theme variables or a CSS class with a dark override.');
      }
    }
  }

  /* ---- 3. collection list-view config ---- */
  for (const c of payload.config.collections) {
    if (c.slug.startsWith('payload-')) continue;
    const admin = (c.admin || {}) as { defaultColumns?: string[]; useAsTitle?: string };
    const pagePath = `/admin/collections/${c.slug}`;
    if (!admin.defaultColumns || admin.defaultColumns.length < 2)
      add('low', 'admin', pagePath, `Collection "${c.slug}" has no curated list columns — the list view falls back to raw defaults and can look empty/unscannable.`, 'Set admin.defaultColumns to the 3–5 most useful fields.');
    if (!admin.useAsTitle || admin.useAsTitle === 'id')
      add('low', 'admin', pagePath, `Collection "${c.slug}" titles rows by raw id.`, 'Set admin.useAsTitle to a human-readable field.');
  }
}

/* ─────────────────────────── per-page extraction ─────────────────────────── */

interface PageData {
  url: string;
  path: string;
  status: number;
  bytes: number;
  title: string;
  metaDesc: string;
  canonical: string;
  robots: string;
  jsonLdValid: boolean;
  jsonLdTypes: Set<string>;
  imgs: { src: string; width: string; height: string }[];
  anchorsAll: string[];
  anchorsMain: string[];
  words: number;
  blockingScripts: number;
  hasDisclaimer: boolean;
}

function parsePage(url: string, status: number, html: string, bytes: number): PageData {
  const headEnd = html.indexOf('</head>');
  const head = headEnd > -1 ? html.slice(0, headEnd) : html;
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  const main = mainMatch ? mainMatch[0] : html;

  const jsonLdTypes = new Set<string>();
  let jsonLdValid = true;
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(m[1]);
      for (const t of m[1].matchAll(/"@type"\s*:\s*"([A-Za-z]+)"/g)) jsonLdTypes.add(t[1]);
    } catch {
      jsonLdValid = false;
    }
  }

  const imgs: PageData['imgs'] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    imgs.push({ src: attr(tag, 'src'), width: attr(tag, 'width'), height: attr(tag, 'height') });
  }

  const collect = (scope: string): string[] => {
    const out: string[] = [];
    for (const m of scope.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)) {
      const u = absUrl(m[1], url);
      if (u) out.push(u);
    }
    return out;
  };

  let blockingScripts = 0;
  for (const m of head.matchAll(/<script\b[^>]*\bsrc\s*=[^>]*>/gi)) {
    const tag = m[0];
    if (!/\basync\b|\bdefer\b|type=["']module["']/i.test(tag)) blockingScripts++;
  }

  const mainText = stripTags(main);

  return {
    url,
    path: new URL(url).pathname || '/',
    status,
    bytes,
    title: stripTags(first(html, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    metaDesc:
      first(head, /<meta\s+[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
      first(head, /<meta\s+[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i),
    canonical:
      first(head, /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
      first(head, /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i),
    robots: first(head, /<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i).toLowerCase(),
    jsonLdValid,
    jsonLdTypes,
    imgs,
    anchorsAll: collect(html),
    anchorsMain: collect(main),
    words: mainText ? mainText.split(/\s+/).length : 0,
    blockingScripts,
    hasDisclaimer: DISCLAIMER_RX.test(stripTags(html)),
  };
}

/* ─────────────────────────── the audit ─────────────────────────── */

export async function runSiteAudit(payload: Payload): Promise<AuditResult> {
  const issues: AuditIssue[] = [];
  const add = (severity: AuditIssue['severity'], category: AuditIssue['category'], page: string, message: string, fix: string, adminPath?: string) =>
    issues.push({ severity, category, page, message, fix, ...(adminPath ? { adminPath } : {}) });

  /* ---- CMS records (for classification + one-click admin jumps) ---- */
  const safeList = async (args: Record<string, unknown>) => {
    try {
      return (await payload.find(args as never)).docs as any[];
    } catch {
      return [];
    }
  };
  const [tools, articles] = await Promise.all([
    safeList({ collection: 'tools', limit: 500, depth: 0 }),
    safeList({ collection: 'articles', limit: 1000, depth: 0, draft: false }),
  ]);
  const toolBySlug = new Map(tools.map((t) => [t.slug, t]));
  const articleBySlug = new Map(articles.map((a) => [a.slug, a]));
  const adminFor = (path: string): string | undefined => {
    const toolSlug = path.match(/^\/tools\/([^/]+)$/)?.[1];
    if (toolSlug && toolBySlug.has(toolSlug)) return `/admin/collections/tools/${toolBySlug.get(toolSlug).id}`;
    const artSlug = path.match(/^\/wellness-hub\/([^/]+)$/)?.[1];
    if (artSlug && articleBySlug.has(artSlug)) return `/admin/collections/articles/${articleBySlug.get(artSlug).id}`;
    return undefined;
  };

  /* ---- admin / UX health (config + stylesheet introspection; cheap) ---- */
  await auditAdminUx(payload, add);

  /* ---- robots.txt ---- */
  const robots = await fetchPage(`${SITE}/robots.txt`);
  if (!robots || robots.status !== 200) {
    add('medium', 'technical', '/robots.txt', 'robots.txt missing or unreachable.', 'Add a robots.txt allowing crawl and pointing at the sitemap.');
  } else {
    const txt = robots.text;
    if (/user-agent:\s*\*[\s\S]{0,200}?disallow:\s*\/\s*$/im.test(txt)) {
      add('high', 'technical', '/robots.txt', 'robots.txt blocks ALL crawling (Disallow: / for *).', 'Remove the blanket Disallow so search engines can crawl the site.');
    }
    if (!/sitemap:/i.test(txt)) {
      add('low', 'technical', '/robots.txt', 'robots.txt has no Sitemap: line.', 'Add "Sitemap: <site>/sitemap-index.xml" to robots.txt.');
    }
  }

  /* ---- sitemap → page inventory ---- */
  let pageUrls: string[] = [];
  const smIndex = await fetchPage(`${SITE}/sitemap-index.xml`);
  const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
  if (smIndex && smIndex.status === 200 && smIndex.text.includes('<')) {
    const children = locs(smIndex.text);
    const childSitemaps = children.filter((u) => u.endsWith('.xml'));
    if (childSitemaps.length) {
      for (const sm of childSitemaps.slice(0, 5)) {
        const child = await fetchPage(sm);
        if (child && child.status === 200) pageUrls.push(...locs(child.text));
      }
    } else {
      pageUrls = children; // index was actually a flat sitemap
    }
  }
  if (!pageUrls.length) {
    add('high', 'technical', '/sitemap-index.xml', 'Sitemap missing, unreachable, or empty.', 'Restore @astrojs/sitemap output and submit it in Search Console.');
    // Fallback inventory from CMS so the rest of the audit still runs.
    pageUrls = [
      SITE,
      ...TRUST_PAGES.map((p) => SITE + p),
      ...tools.map((t) => `${SITE}/tools/${t.slug}`),
      ...articles.filter((a) => a._status === 'published').map((a) => `${SITE}/wellness-hub/${a.slug}`),
    ];
  }
  pageUrls = [...new Set(pageUrls.map((u) => u.replace(/\/$/, '')))].filter(isInternal).slice(0, MAX_PAGES);

  /* ---- crawl pages ---- */
  const pages: PageData[] = [];
  await pool(pageUrls, CONCURRENCY, async (url) => {
    const res = await fetchPage(url);
    if (!res) {
      add('high', 'technical', new URL(url).pathname, 'Page in sitemap failed to load (network error/timeout).', 'Confirm the page deploys and loads; remove dead URLs from the sitemap.');
      return;
    }
    if (res.status !== 200) {
      add('high', 'technical', new URL(url).pathname, `Page in sitemap returns HTTP ${res.status}.`, 'Fix or redirect the page — sitemap URLs must return 200.');
      return;
    }
    pages.push(parsePage(url, res.status, res.text, res.bytes));
  });

  /* ---- trust pages (E-E-A-T) ---- */
  const fetchedPaths = new Set(pages.map((p) => p.path));
  for (const tp of TRUST_PAGES) {
    if (fetchedPaths.has(tp)) continue;
    const status = await checkUrl(SITE + tp);
    if (status !== 200) {
      add('high', 'eeat', tp, `Trust page missing (HTTP ${status || 'unreachable'}).`, 'Publish this page — YMYL sites need visible About/Contact/Policy pages.');
    }
  }

  /* ---- per-page technical checks ---- */
  const titleGroups = new Map<string, string[]>();
  const descGroups = new Map<string, string[]>();
  for (const p of pages) {
    const admin = adminFor(p.path);
    const isTool = /^\/tools\/[^/]+$/.test(p.path) && toolBySlug.has(p.path.split('/')[2]);
    const isArticle = /^\/wellness-hub\/[^/]+$/.test(p.path) && articleBySlug.has(p.path.split('/')[2]);

    if (!p.title) add('high', 'technical', p.path, 'Missing <title>.', 'Add a unique, descriptive title (≤60 chars).', admin);
    else {
      if (p.title.length > 60) add('medium', 'technical', p.path, `Title is ${p.title.length} chars (>60 — truncates in SERPs).`, 'Shorten the title to ≤60 characters.', admin);
      const key = p.title.toLowerCase();
      titleGroups.set(key, [...(titleGroups.get(key) || []), p.path]);
    }

    if (!p.metaDesc) add('medium', 'technical', p.path, 'Missing meta description.', 'Add a 140–155 char meta description.', admin);
    else {
      if (p.metaDesc.length > 155) add('low', 'technical', p.path, `Meta description is ${p.metaDesc.length} chars (>155 — truncates).`, 'Trim the meta description to ≤155 characters.', admin);
      const key = p.metaDesc.toLowerCase();
      descGroups.set(key, [...(descGroups.get(key) || []), p.path]);
    }

    if (!p.canonical) add('medium', 'technical', p.path, 'Missing canonical link.', 'Emit <link rel="canonical"> with the page’s own URL.', admin);
    else {
      try {
        const c = new URL(p.canonical);
        if (c.hostname.replace(/^www\./, '') !== SITE_HOST) add('high', 'technical', p.path, `Canonical points to a different host (${c.hostname}).`, 'Point the canonical at this page’s own URL.', admin);
        else if (c.pathname.replace(/\/$/, '') !== p.path.replace(/\/$/, '')) add('medium', 'technical', p.path, `Canonical points to a different path (${c.pathname}).`, 'Canonical should self-reference unless intentionally consolidating.', admin);
      } catch {
        add('medium', 'technical', p.path, 'Canonical URL is invalid.', 'Fix the canonical href.', admin);
      }
    }

    if (p.robots.includes('noindex')) add('high', 'technical', p.path, 'Page is noindexed but listed in the sitemap.', 'Remove noindex (or drop the URL from the sitemap if intentional).', admin);

    if (!p.jsonLdValid) add('high', 'technical', p.path, 'A JSON-LD block fails to parse (invalid schema).', 'Fix the JSON-LD syntax — invalid blocks are ignored by Google.', admin);
    if (isTool && !p.jsonLdTypes.has('WebApplication') && !p.jsonLdTypes.has('SoftwareApplication'))
      add('medium', 'technical', p.path, 'Tool page missing WebApplication/SoftwareApplication schema.', 'Emit the app schema in the tool page JSON-LD.', admin);
    if (isArticle) {
      if (!p.jsonLdTypes.has('Article')) add('medium', 'technical', p.path, 'Article page missing Article schema.', 'Emit Article JSON-LD on article pages.', admin);
      if (!p.jsonLdTypes.has('FAQPage')) add('low', 'technical', p.path, 'Article has no FAQPage schema.', 'Add an FAQ section (feeds FAQPage rich results).', admin);
    }
    if (p.path === '' || p.path === '/') {
      if (!p.jsonLdTypes.has('Organization')) add('medium', 'technical', '/', 'Homepage missing Organization schema.', 'Emit sitewide Organization JSON-LD.');
    }

    // CWV proxies
    if (p.blockingScripts > 0) add('medium', 'technical', p.path, `${p.blockingScripts} render-blocking script(s) in <head>.`, 'Add async/defer (or move scripts out of <head>).', admin);
    if (p.bytes > 150_000) add('low', 'technical', p.path, `HTML weighs ${(p.bytes / 1024).toFixed(0)} KB.`, 'Trim inline payloads/scripts; keep HTML lean.', admin);
    const noDims = p.imgs.filter((i) => i.src && (!i.width || !i.height)).length;
    if (noDims) add('medium', 'technical', p.path, `${noDims} image(s) without width/height (CLS risk).`, 'Set explicit width and height attributes on images.', admin);
    const legacyFmt = p.imgs.filter((i) => /\.(jpe?g|png|gif)(\?|$)/i.test(i.src)).length;
    if (legacyFmt) add('low', 'technical', p.path, `${legacyFmt} image(s) not WebP/AVIF.`, 'Serve images as WebP/AVIF (the CMS converts uploads automatically).', admin);
    for (const img of p.imgs) {
      if (!img.src) add('high', 'technical', p.path, 'Image with missing/empty src.', 'Fix or remove the broken <img>.', admin);
    }

    // Disclaimer on health-content pages
    if ((isTool || isArticle) && !p.hasDisclaimer)
      add('medium', 'eeat', p.path, 'No medical disclaimer detected on this health page.', 'Add a "not medical advice / consult a clinician" note.', admin);

    // Content: outgoing internal links from the main content
    const outInternal = p.anchorsMain.filter((u) => isInternal(u) && u.replace(/\/$/, '') !== p.url.replace(/\/$/, ''));
    if (isArticle && outInternal.length === 0)
      add('medium', 'content', p.path, 'Article has no internal links in its body.', 'Weave 2–3 contextual links to related tools/articles.', admin);

    // Thin content (articles only — tool pages are interactive by design)
    if (isArticle && p.words < 300) add('medium', 'content', p.path, `Thin content: ~${p.words} words.`, 'Expand the article (aim 900+ words of genuinely useful content).', admin);
  }

  for (const [, paths] of titleGroups) {
    if (paths.length > 1) add('medium', 'technical', paths.join(', '), `Duplicate <title> on ${paths.length} pages.`, 'Give each page a unique title.', adminFor(paths[0]));
  }
  for (const [, paths] of descGroups) {
    if (paths.length > 1) add('medium', 'technical', paths.join(', '), `Duplicate meta description on ${paths.length} pages.`, 'Write a unique description per page.', adminFor(paths[0]));
  }

  /* ---- link graph: orphans + broken internal links ---- */
  const inbound = new Map<string, number>();
  for (const p of pages) inbound.set(p.url, 0);
  const unknownInternal = new Set<string>();
  for (const p of pages) {
    for (const u of new Set(p.anchorsAll)) {
      if (!isInternal(u)) continue;
      const clean = u.replace(/\/$/, '');
      if (clean === p.url.replace(/\/$/, '')) continue;
      if (inbound.has(clean)) inbound.set(clean, (inbound.get(clean) || 0) + 1);
      else if (!/\.(png|jpe?g|webp|avif|gif|svg|ico|css|js|xml|txt|pdf|woff2?)(\?|$)/i.test(clean)) unknownInternal.add(clean);
    }
  }
  for (const p of pages) {
    if (p.path === '/' || p.path === '') continue;
    if ((inbound.get(p.url) || 0) === 0)
      add('medium', 'content', p.path, 'Orphan page — no internal links point to it.', 'Link to it from related articles/tools or the relevant hub page.', adminFor(p.path));
  }

  const linkTargets = [...unknownInternal].slice(0, MAX_LINK_CHECKS);
  const linkStatuses = await pool(linkTargets, CONCURRENCY, async (u) => ({ u, status: await checkUrl(u) }));
  const brokenInternal = new Set(linkStatuses.filter((r) => r.status === 404 || r.status === 410).map((r) => r.u));
  for (const p of pages) {
    const broken = [...new Set(p.anchorsAll)].filter((u) => brokenInternal.has(u.replace(/\/$/, '')));
    if (broken.length)
      add('high', 'technical', p.path, `Broken internal link(s): ${broken.slice(0, 3).map((b) => new URL(b).pathname).join(', ')}${broken.length > 3 ? '…' : ''}`, 'Fix or remove the dead links (or add redirects).', adminFor(p.path));
  }

  /* ---- broken external links (sampled) ---- */
  const externals = new Map<string, string>(); // url -> first page seen on
  for (const p of pages) for (const u of p.anchorsMain) if (!isInternal(u) && !externals.has(u)) externals.set(u, p.path);
  const extSample = [...externals.keys()].slice(0, MAX_EXT_CHECKS);
  const extStatuses = await pool(extSample, CONCURRENCY, async (u) => ({ u, status: await checkUrl(u) }));
  for (const { u, status } of extStatuses) {
    if (status === 404 || status === 410)
      add('low', 'technical', externals.get(u) || '/', `Broken external link: ${u}`, 'Replace or remove the dead reference (bad for trust + E-E-A-T).', adminFor(externals.get(u) || ''));
  }

  /* ---- broken images (sampled, absolute URLs) ---- */
  const imgMap = new Map<string, string>();
  for (const p of pages) {
    for (const img of p.imgs) {
      if (!img.src || img.src.startsWith('data:')) continue;
      const u = absUrl(img.src, p.url);
      if (u && !imgMap.has(u)) imgMap.set(u, p.path);
    }
  }
  const imgSample = [...imgMap.keys()].slice(0, MAX_IMG_CHECKS);
  const imgStatuses = await pool(imgSample, CONCURRENCY, async (u) => ({ u, status: await checkUrl(u) }));
  for (const { u, status } of imgStatuses) {
    if (status !== 200 && status !== 0)
      add('high', 'technical', imgMap.get(u) || '/', `Broken image (HTTP ${status}): ${u.length > 80 ? u.slice(0, 77) + '…' : u}`, 'Re-upload the image or fix its URL (check media storage).', adminFor(imgMap.get(u) || ''));
  }

  /* ---- E-E-A-T from CMS records ---- */
  for (const a of articles) {
    if (a._status !== 'published') continue;
    const adminPath = `/admin/collections/articles/${a.id}`;
    const page = `/wellness-hub/${a.slug}`;
    if (!a.author) add('high', 'eeat', page, 'Article has no named author.', 'Assign an author — YMYL content needs clear attribution.', adminPath);
    if (!a.reviewer) add('medium', 'eeat', page, 'Article has no reviewer.', 'Assign a medical reviewer and show it on the page.', adminPath);
    if (!a.updatedDate) add('medium', 'eeat', page, 'Article has no "Updated" date.', 'Set updatedDate — freshness signals matter for health queries.', adminPath);
    if (!Array.isArray(a.sources) || a.sources.length === 0) add('high', 'eeat', page, 'Article cites no sources.', 'Add 2–3 reputable references (CDC/WHO/NHS/peer-reviewed).', adminPath);
  }

  /* ---- content backlog: tools without an article ---- */
  const coveredToolIds = new Set<number | string>();
  for (const a of articles) {
    if (a.primaryTool) coveredToolIds.add(typeof a.primaryTool === 'object' ? a.primaryTool.id : a.primaryTool);
    for (const rt of a.relatedTools || []) coveredToolIds.add(typeof rt === 'object' ? rt.id : rt);
  }
  for (const t of tools) {
    if (t.enabled !== false && !coveredToolIds.has(t.id))
      add('low', 'content', `/tools/${t.slug}`, `Tool has no supporting Wellness Hub article: ${t.name || t.slug}.`, 'Write a supporting article and link it via primaryTool.', `/admin/collections/tools/${t.id}`);
  }

  /* ---- keyword cannibalization (near-duplicate titles) ---- */
  const contentPages = pages.filter((p) => /^\/(tools|wellness-hub)\/[^/]+$/.test(p.path) && p.title);
  const flaggedPairs = new Set<string>();
  for (let i = 0; i < contentPages.length && flaggedPairs.size < 10; i++) {
    for (let j = i + 1; j < contentPages.length && flaggedPairs.size < 10; j++) {
      const a = contentPages[i];
      const b = contentPages[j];
      const sim = jaccard(titleTokens(a.title), titleTokens(b.title));
      if (sim >= 0.75) {
        const key = [a.path, b.path].sort().join('|');
        if (!flaggedPairs.has(key)) {
          flaggedPairs.add(key);
          add('medium', 'content', `${a.path} ↔ ${b.path}`, `Possible keyword cannibalization (titles ${Math.round(sim * 100)}% similar).`, 'Differentiate the target keywords, or consolidate one page into the other.', adminFor(a.path));
        }
      }
    }
  }

  /* ---- score ---- */
  const high = issues.filter((i) => i.severity === 'high').length;
  const medium = issues.filter((i) => i.severity === 'medium').length;
  const low = issues.filter((i) => i.severity === 'low').length;
  const healthScore = Math.max(5, Math.min(100, Math.round(100 - 5 * high - 2 * medium - 0.5 * low)));

  const order = { high: 0, medium: 1, low: 2 } as const;
  issues.sort((a, b) => order[a.severity] - order[b.severity] || a.category.localeCompare(b.category) || a.page.localeCompare(b.page));

  return { healthScore, pagesScanned: pages.length, high, medium, low, issues };
}
