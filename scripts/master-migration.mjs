/**
 * Master Migration Script — Payload CMS ← Astro hardcoded data.
 *
 * Bundles all Astro `src/data/*.ts` + `src/consts.ts` into a single JS module
 * via esbuild, then injects every record into the running Payload REST API.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

/* ────────────────────────────────────────────  Paths ── */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CMS_ROOT = path.resolve(__dirname, '..');
const ASTRO_ROOT = path.resolve(CMS_ROOT, '..');
const ENV_PATH = path.join(CMS_ROOT, '.env');
const BUNDLE_TMP = path.join(__dirname, '.astro-bundle.mjs');

/* ────────────────────────────────────────────  Logging ── */
const c = (s, ...rest) => `\x1b[${s}m${rest.join(' ')}\x1b[0m`;
const log = {
  hr: () => console.log(c('90', '─'.repeat(60))),
  h1: (msg) => { log.hr(); console.log(`  ${c('1;36', msg)}`); log.hr(); },
  h2: (msg) => console.log(`\n  ${c('1;33', '▶')} ${c('1;37', msg)}`),
  ok: (msg, detail = '') => console.log(`    ${c('32', '✔')} ${msg}${detail ? c('2;37', `  ${detail}`) : ''}`),
  warn: (msg) => console.log(`    ${c('33', '⚠')} ${msg}`),
  fail: (msg) => console.log(`    ${c('31', '✖')} ${msg}`),
  data: (label, val) => console.log(`    ${c('2;37', label + ':')} ${c('37', String(val))}`),
};

/* ────────────────────────────────────────────  .env loader ── */
function loadEnv() {
  const env = { CMS_URL: 'http://localhost:3000' };
  if (!existsSync(ENV_PATH)) {
    log.warn(`No .env found at ${ENV_PATH} — using defaults`);
    return env;
  }
  for (const line of readFileSync(ENV_PATH, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

/* ────────────────────────────────────────────  API helpers ── */
async function api(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = data?.errors?.[0]?.message || data?.message || text.slice(0, 200);
    throw new Error(`HTTP ${res.status} — ${msg}`);
  }
  return data;
}

/* ────────────────────────────────────────────  Load Astro data ── */
async function loadAstroData() {
  log.h2('Bundling Astro data files');

  const entry = path.join(ASTRO_ROOT, '.astro-entry.mjs');
  writeFileSync(entry, [
    'import * as C from "./src/consts";',
    'import * as AUTH from "./src/data/authors";',
    'import * as CAT from "./src/data/categories";',
    'import * as T from "./src/data/tools";',
    'import * as ART from "./src/data/articles";',
    'export const consts = C;',
    'export const authors = AUTH;',
    'export const categories = CAT;',
    'export const tools = T;',
    'export const articles = ART;',
  ].join('\n'));

  try {
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'node',
      target: 'node22',
      absWorkingDir: ASTRO_ROOT,
      outfile: 'bundle.js',
    });
    writeFileSync(BUNDLE_TMP, result.outputFiles[0].text);
    const mod = await import(pathToFileURL(BUNDLE_TMP).href);
    log.ok('Astro data files bundled successfully');
    return mod;
  } finally {
    try { unlinkSync(entry); } catch {}
  }
}

function pathToFileURL(p) {
  return new URL('file://' + p.replace(/\\/g, '/'));
}

/* ────────────────────────────────────────────  Auth ── */
async function login(env) {
  log.h2('Authenticating with Payload CMS');
  const email = env.PAYLOAD_EMAIL;
  const password = env.PAYLOAD_PASSWORD;

  if (!email || !password) {
    log.fail('PAYLOAD_EMAIL and PAYLOAD_PASSWORD must be set in .env');
    process.exit(1);
  }

  const data = await api('POST', `${env.CMS_URL}/api/users/login`, {
    email, password,
  });
  const token = data.token;
  if (!token) throw new Error('Login succeeded but no token returned');
  log.ok(`Authenticated as ${email}`);
  return token;
}

/* ────────────────────────────────────────────  Step A: Globals ── */
async function stepA(astro, env, token) {
  log.h2('A — Injecting Globals');
  const C = astro.consts;

  const settingsData = {
    siteTitle: C.SITE.name,
    tagline: C.SITE.tagline,
    description: C.SITE.description,
    primaryColor: C.SITE.themeColor,
    ga4Id: C.ANALYTICS.ga4Id,
    searchConsoleId: C.ANALYTICS.searchConsoleVerification,
    affiliateDisclosure: 'As an affiliate we may earn from qualifying purchases.',
    contactEmail: C.CONTACT.email,
    nav: C.NAV_LINKS.map((l) => ({ label: l.label, href: l.href })),
    copyrightText: `© 2026 ${C.SITE.name}. All rights reserved.`,
    footerLinks: [
      ...C.FOOTER_COMPANY.map((l) => ({ label: l.label, href: l.href })),
      ...C.FOOTER_LEGAL.map((l) => ({ label: l.label, href: l.href })),
    ],
    social: C.SOCIAL_FOLLOW.map((s) => ({
      platform: platformLabel(s.network),
      url: s.href,
      color: C.SOCIAL_NETWORKS[s.network]?.color || '',
    })),
  };

  for (const [slug, data] of [['settings', settingsData], ['social-media', {
    profiles: C.SOCIAL_FOLLOW.map((s) => ({
      platform: platformLabel(s.network),
      url: s.href,
    })),
    twitterSite: C.SITE.twitter,
    ogLocale: C.SITE.locale,
    defaultShareText: `Check this out from ${C.SITE.name}: {title} {url}`,
  }]]) {
    try {
      await api('POST', `${env.CMS_URL}/api/globals/${slug}`, data, token);
      log.ok(`Global "${slug}" created`);
    } catch (e) {
      if (e.message.includes('400') || e.message.includes('already exists')) {
        await api('PATCH', `${env.CMS_URL}/api/globals/${slug}`, data, token);
        log.ok(`Global "${slug}" updated`);
      } else {
        throw e;
      }
    }
  }
}

function platformLabel(network) {
  const map = {
    x: 'X (Twitter)', facebook: 'Facebook', linkedin: 'LinkedIn',
    pinterest: 'Pinterest', whatsapp: 'WhatsApp', reddit: 'Reddit',
    instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok',
    threads: 'Threads', bluesky: 'Bluesky',
  };
  return map[network] || network;
}

/* ────────────────────────────────────────────  Helpers ── */
function catOrder(slug) {
  const order = ['nutrition', 'body-weight', 'fitness', 'heart-vitals', 'heart-health', 'metabolic', 'sleep', 'womens-health', 'health-risk', 'mental-wellness', 'weight-loss'];
  const idx = order.indexOf(slug);
  return idx >= 0 ? idx : 99;
}

function toolOrder(slug) {
  const popular = ['calorie-calculator', 'bmi-calculator', 'intermittent-fasting-calculator', 'protein-intake-calculator', 'sleep-calculator', 'due-date-calculator', 'body-fat-calculator', 'one-rep-max-calculator'];
  const idx = popular.indexOf(slug);
  return idx >= 0 ? idx : 50;
}

/* ────────────────────────────────────────────  Step B: Authors & Categories ── */
async function stepB(astro, env, token) {
  log.h2('B — Injecting Authors');

  const authorIdMap = {};
  for (const a of astro.authors.AUTHORS) {
    const payload = {
      name: a.name,
      slug: a.slug,
      role: a.role,
      credential: a.credential || '',
      bio: a.bio,
      initials: a.initials,
      color: a.color,
      schemaType: a.schemaType,
      links: (a.links || []).map((l) => ({
        label: l.network === 'website' ? 'Website' : l.network,
        url: l.href,
      })),
    };
    const result = await api('POST', `${env.CMS_URL}/api/authors`, payload, token);
    const id = result.doc?.id || result.id;
    authorIdMap[a.slug] = id;
    log.ok(`${a.name}  →  ${c('2;37', id)}`);
  }

  log.h2('B — Injecting Categories');
  const catIdMap = {};

  for (const cat of astro.categories.CATEGORIES) {
    const payload = {
      name: cat.name,
      slug: cat.slug,
      kind: 'tool',
      description: cat.blurb,
      icon: cat.icon,
      accentColor: cat.color,
      accent: cat.accent || cat.color,
      order: catOrder(cat.slug),
    };
    const result = await api('POST', `${env.CMS_URL}/api/categories`, payload, token);
    const id = result.doc?.id || result.id;
    catIdMap[`tool:${cat.id}`] = id;
    log.ok(`Tool: ${cat.name}  →  ${c('2;37', id)}`);
  }

  for (const ac of astro.articles.ARTICLE_CATEGORIES) {
    const payload = {
      name: ac.name,
      slug: ac.slug,
      kind: 'section',
      description: ac.blurb,
      icon: ac.icon,
      accentColor: ac.color,
      order: catOrder(ac.slug),
    };
    const result = await api('POST', `${env.CMS_URL}/api/categories`, payload, token);
    const id = result.doc?.id || result.id;
    catIdMap[`section:${ac.slug}`] = id;
    log.ok(`Section: ${ac.name}  →  ${c('2;37', id)}`);
  }

  return { authorIdMap, catIdMap };
}

/* ────────────────────────────────────────────  Step C: Tools ── */
async function stepC(astro, env, token, catIdMap) {
  log.h2('C — Injecting Tools');

  const toolIdMap = {};
  for (const t of astro.tools.TOOLS) {
    const catKey = `tool:${t.category}`;
    const catId = catIdMap[catKey];

    if (!catId) {
      console.log(`    SKIPPING: Tool '${t.slug}' has no valid category mapping (Attempted: '${t.category}').`);
      continue;
    }

    const payload = {
      name: t.title,
      slug: t.slug,
      category: catId,
      icon: t.icon || 'flame',
      gradient: t.gradient || 'blue',
      enabled: t.live !== false,
      featured: t.popular || false,
      seo: {
        metaTitle: t.title,
        metaDescription: t.blurb,
        keywords: t.keywords || [],
      },
      sortOrder: toolOrder(t.slug),
    };

    try {
      const result = await api('POST', `${env.CMS_URL}/api/tools`, payload, token);
      const id = result.doc?.id || result.id;
      toolIdMap[t.slug] = id;
      log.ok(`${t.title}  →  ${c('2;37', id)}`);
    } catch (err) {
      log.fail(`Failed to inject tool "${t.slug}": ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  for (const t of astro.tools.TOOLS) {
    if (!t.related || t.related.length === 0) continue;
    const id = toolIdMap[t.slug];
    if (!id) continue;
    const relatedIds = t.related.map((s) => toolIdMap[s]).filter(Boolean);
    if (relatedIds.length > 0) {
      await api('PATCH', `${env.CMS_URL}/api/tools/${id}`, { related: relatedIds }, token).catch(e => log.warn(`Failed to link related tools for ${t.slug}`));
    }
  }
  log.data('Tools injected', Object.keys(toolIdMap).length);
  return toolIdMap;
}

/* ────────────────────────────────────────────  Step D: Articles ── */
async function stepD(astro, env, token, authorIdMap, catIdMap, toolIdMap) {
  log.h2('D — Injecting Articles');

  const articleIdMap = {};
  const ARTICLES = astro.articles.ARTICLES;

  for (const a of ARTICLES) {
    const authorId = resolveAuthorId(a, authorIdMap);
    const catId = catIdMap[`section:${a.category}`];
    const toolId = a.primaryTool ? toolIdMap[a.primaryTool] : null;

    const payload = {
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt || '',
      category: catId || null,
      author: authorId || null,
      publishDate: a.publishDate || null,
      updatedDate: a.updatedDate || a.publishDate || null,
      featured: a.featured || false,
      primaryTool: toolId || null,
      relatedTools: (a.relatedTools || []).map((s) => toolIdMap[s]).filter(Boolean),
      seo: {
        metaTitle: a.seoTitle || a.title,
        metaDescription: a.metaDescription || a.excerpt || '',
      },
      sources: (a.sources || []).map((s) => ({
        label: s.citation || s.url || '',
        url: s.url || '',
      })),
      faq: extractFaq(a),
      layout: mapArticleBody(a, toolIdMap),
      _status: 'published',
    };

    const result = await api('POST', `${env.CMS_URL}/api/articles`, payload, token);
    const id = result.doc?.id || result.id;
    articleIdMap[a.slug] = id;
    log.ok(`${a.title.slice(0, 50)}…  →  ${c('2;37', id)}`);
  }

  for (const a of ARTICLES) {
    if (!a.relatedArticles || a.relatedArticles.length === 0) continue;
    const id = articleIdMap[a.slug];
    const relatedIds = a.relatedArticles.map((s) => articleIdMap[s]).filter(Boolean);
    if (relatedIds.length > 0) {
      await api('PATCH', `${env.CMS_URL}/api/articles/${id}`, { relatedArticles: relatedIds }, token);
    }
  }
  log.data('Articles injected', Object.keys(articleIdMap).length);
}

function resolveAuthorId(a, authorIdMap) {
  const astroAuthors = { 'editorial-team': 'HealthyLifeStyles Editorial Team', 'medical-review': 'HealthyLifeStyles Medical Review Board' };
  const fallback = Object.values(authorIdMap)[0];
  for (const [slug, name] of Object.entries(astroAuthors)) {
    if (a.author === name) return authorIdMap[slug];
    if (a.author.toLowerCase().includes(name.toLowerCase())) return authorIdMap[slug];
    if (name.toLowerCase().includes(a.author.toLowerCase())) return authorIdMap[slug];
  }
  return fallback;
}

function extractFaq(a) {
  if (!a.body) return [];
  return a.body.filter(b => b.type === 'paa').flatMap(b => b.items.map(i => ({ question: i.q, answer: i.a })));
}

function mapArticleBody(a, toolIdMap) {
  if (!a.body) return [];
  return a.body.map(block => {
    switch (block.type) {
      case 'p': return { blockType: 'text', style: 'p', text: block.text };
      case 'h2': return { blockType: 'text', style: 'h2', text: block.text };
      case 'h3': return { blockType: 'text', style: 'h3', text: block.text };
      case 'ul': return { blockType: 'list', style: 'unordered', items: block.items.map(text => ({ text })) };
      case 'tool': return { blockType: 'toolEmbed', tool: toolIdMap[block.slug] || null, label: block.label || '' };
      case 'paa': return { blockType: 'peopleAlsoAsk', heading: block.heading || '', items: block.items.map(i => ({ question: i.q, answer: i.a })) };
      default: return null;
    }
  }).filter(Boolean);
}

/* ────────────────────────────────────────────  Main ── */
async function main() {
  console.log(`\n  ${c('1;36', '╔══════════════════════════════════════╗')}`);
  console.log(`  ${c('1;36', '║')}  Payload CMS — Master Migration     ${c('1;36', '║')}`);
  console.log(`  ${c('1;36', '╚══════════════════════════════════════╝')}\n`);

  const start = Date.now();
  const env = loadEnv();
  const astro = await loadAstroData();
  
  const token = await login(env);
  await stepA(astro, env, token);
  const { authorIdMap, catIdMap } = await stepB(astro, env, token);
  const toolIdMap = await stepC(astro, env, token, catIdMap);
  await stepD(astro, env, token, authorIdMap, catIdMap, toolIdMap);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n  ${c('1;32', '✓ Migration complete')}  ${c('2;37', `(${elapsed}s)`)}`);
}

main().catch((err) => {
  console.error(`\n  ${c('1;31', '✖ Migration failed:')} ${err.message}`);
  process.exit(1);
});