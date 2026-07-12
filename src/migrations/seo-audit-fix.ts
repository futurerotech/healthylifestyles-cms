/**
 * PHASE 17 — one-off, idempotent SEO data-quality remediation (CLI script).
 *
 * Runs through Payload's Local API. DRY-RUN BY DEFAULT — writes require --apply.
 *
 *   Dry run:  npx payload run src/migrations/seo-audit-fix.ts
 *   Apply:    npx payload run src/migrations/seo-audit-fix.ts -- --apply
 *   Flags:    --apply --batch-size=100 --limit=500 --locale=en --verbose
 *
 * REPOSITORY-VERIFIED MAPPINGS (spec deviations follow the repo, per spec):
 *  - Meta description lives at `seo.metaDescription` (plain textarea, NOT
 *    localized) on both `articles` and `tools`.
 *  - The VISIBLE FAQ (and the only source Phase-16 FAQPage schema reads) is the
 *    `peopleAlsoAsk` block inside the localized `layout` field — NOT the legacy
 *    `faq` array. Operation 2 therefore inserts a `peopleAlsoAsk` block and
 *    sets `hasFAQ: true` (both fields exist; hasFAQ validation requires the
 *    block to carry items).
 *  - Tools carry NO relationship to articles. The real direction is
 *    articles→tools via `relatedTools` (hasMany) and `primaryTool` (single).
 *    Operation 3 therefore finds ORPHAN TOOLS (referenced by no article) and
 *    appends the tool to the single unambiguous best-matching article's
 *    `relatedTools`. Existing relationships are never modified.
 *  - There is no "needs editorial review" status for FAQ content in the schema
 *    (`reviewedByHuman` tracks AI *drafting*, not FAQ edits) — inserted FAQs
 *    are logged for review instead of toggling unrelated editorial state.
 *
 * This file lives in src/migrations/ by explicit request. It is NOT a Payload
 * migration: the exported up/down are inert no-ops so the migration runner can
 * never execute the remediation; the real work only runs via `payload run`.
 */
import { getPayload, type Payload } from 'payload';
import configPromise from '@payload-config';
import type { Article, Tool, Tag } from '../../payload-types';

/* ── inert exports: keep `payload migrate` safe if it ever scans this file ── */
export async function up(): Promise<void> {
  console.log('[INFO] seo-audit-fix is a CLI script, not a schema migration — no-op in the migration runner.');
}
export async function down(): Promise<void> {
  console.log('[INFO] seo-audit-fix down(): no-op.');
}

/* ── CLI flags ─────────────────────────────────────────────────────────────── */
interface Flags {
  apply: boolean;
  batchSize: number;
  limit: number;
  locale: string;
  verbose: boolean;
}
function parseFlags(argv: string[]): Flags {
  const get = (name: string): string | undefined => {
    const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!hit) return undefined;
    return hit.includes('=') ? hit.split('=').slice(1).join('=') : 'true';
  };
  return {
    apply: get('apply') === 'true' || process.env.APPLY === 'true',
    batchSize: Math.max(1, Math.min(500, Number(get('batch-size') ?? 100) || 100)),
    limit: Math.max(1, Number(get('limit') ?? 500) || 500),
    locale: get('locale') ?? 'en',
    verbose: get('verbose') === 'true',
  };
}

/* ── logging ───────────────────────────────────────────────────────────────── */
const log = {
  info: (m: string) => console.log(`[INFO] ${m}`),
  ok: (m: string) => console.log(`[SUCCESS] ${m}`),
  warn: (m: string) => console.warn(`[WARNING] ${m}`),
  err: (m: string) => console.error(`[ERROR] ${m}`),
  sum: (m: string) => console.log(`[SUMMARY] ${m}`),
};

/* ── counters ──────────────────────────────────────────────────────────────── */
const counters = {
  scanned: 0,
  metaChanged: 0,
  faqInserted: 0,
  relationshipsRepaired: 0,
  tagsAppended: 0,
  skipped: 0,
  ambiguous: 0,
  unmatchedTools: 0,
  failed: 0,
};

/* ── text helpers ──────────────────────────────────────────────────────────── */
const MAX_DESC = 150;

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}
function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
/** Grapheme-safe length (never counts a surrogate pair or emoji as 2+). */
const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
function graphemes(s: string): string[] {
  return [...seg.segment(s)].map((x) => x.segment);
}
/**
 * Truncate to MAX_DESC graphemes with a single trailing '…' (which counts
 * toward the limit), preferring a whole-word boundary and never cutting
 * through a grapheme cluster.
 */
function truncateDescription(input: string): string {
  const clean = normalizeWs(stripHtml(input));
  const g = graphemes(clean);
  if (g.length <= MAX_DESC) return clean;
  let cut = g.slice(0, MAX_DESC - 1).join('');
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > (MAX_DESC - 1) * 0.6) cut = cut.slice(0, lastSpace);
  cut = cut.replace(/[\s,;:–—-]+$/g, '');
  return `${cut}…`;
}

/* ── slug/token helpers ────────────────────────────────────────────────────── */
const GENERIC_TOKENS = new Set([
  'tool', 'checker', 'calculator', 'guide', 'online', 'free', 'quiz', 'test',
  'tracker', 'estimator', 'builder', 'generator', 'analyzer', 'timer', 'log',
  'planner', 'score', 'daily', 'simple', 'easy',
]);
function tokens(slug: string): string[] {
  return slug
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !GENERIC_TOKENS.has(t));
}
const normQ = (q: string): string => normalizeWs(q).toLowerCase().replace(/[?.!]+$/, '');
const relId = (v: unknown): number | null =>
  typeof v === 'number'
    ? v
    : v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'number'
      ? (v as { id: number }).id
      : null;

/* ── FAQ content (Operation 2) — conservative, educational, non-diagnostic ── */
interface FaqEntry { question: string; answer: string }
const FAQ_CONTENT: Record<string, FaqEntry[]> = {
  'healthy-bmi-by-age': [
    {
      question: 'Does a healthy BMI range change with age?',
      answer:
        'The standard adult range (18.5–24.9) applies to most adults, but research suggests slightly higher values may be acceptable in older adults, and BMI is interpreted differently for children and teens using age-specific percentiles. Ask a healthcare professional what range fits your situation.',
    },
    {
      question: 'Why can BMI be misleading for some people?',
      answer:
        'BMI does not distinguish muscle from fat, so muscular people can score "overweight" while people with low muscle mass can score "normal" despite excess body fat. It is a screening measure, not a diagnosis.',
    },
    {
      question: 'What should I do if my BMI is outside the healthy range?',
      answer:
        'Treat it as a prompt for a conversation, not a verdict. A clinician can combine BMI with waist measurement, body composition, blood work, and history to advise whether any change is actually needed.',
    },
  ],
  'how-long-does-it-take-to-lose-weight': [
    {
      question: 'What is a realistic weekly rate of weight loss?',
      answer:
        'Public-health guidance such as the CDC considers roughly 0.5–1 kg (1–2 lb) per week a sustainable pace for most adults. Faster loss is more likely to cost muscle and rebound. A registered dietitian or doctor can personalize the target.',
    },
    {
      question: 'Why does weight loss slow down after the first weeks?',
      answer:
        'Early loss includes water and glycogen. As body mass drops, daily calorie needs drop too, shrinking the original deficit. Plateaus are normal and usually mean the plan needs a small recalculation, not that progress has failed.',
    },
    {
      question: 'Do I need to hit a specific date to succeed?',
      answer:
        'No — timelines are estimates, not deadlines. Consistency over months matters far more than any single week. If you have health conditions or a lot of weight to lose, plan the pace with a qualified healthcare professional.',
    },
  ],
  'calories-burned-calculator-guide': [
    {
      question: 'How are calories burned during exercise estimated?',
      answer:
        'Most estimates multiply a MET value (the metabolic cost of an activity) by your body weight and duration. They are averages: fitness level, technique, and body composition all shift the real number up or down.',
    },
    {
      question: 'Why do two people burn different calories doing the same workout?',
      answer:
        'Heavier bodies move more mass, so they burn more energy for the same activity; muscle mass, age, and intensity add further differences. Treat calculator outputs as ballpark figures rather than exact measurements.',
    },
    {
      question: 'Should I eat back the calories my workout burned?',
      answer:
        'It depends on your goal. Estimates run high for many activities, so eating back everything can erase a deficit. If you are managing weight for a medical reason, a healthcare professional or dietitian can set the right balance.',
    },
  ],
};

/* ── Operation 4 relevance dictionaries (transparent, in-script) ───────────── */
const TAG_TOPICS: Record<string, string[]> = {
  'heart-health': ['heart', 'blood-pressure', 'blood', 'pressure', 'cholesterol', 'cardio', 'cardiovascular', 'hypertension'],
  'mental-wellness': ['stress', 'anxiety', 'depression', 'mental', 'mood', 'mindfulness', 'burnout', 'wellbeing', 'breathing'],
};
const TAG_MIN_SCORE = 2;
const TAG_MAX_ARTICLES = 5;

/* ── shared update helper: preserves publication state, isolates errors ───── */
async function safeUpdate(
  payload: Payload,
  collection: 'articles' | 'tools',
  doc: { id: number; _status?: string | null },
  data: Record<string, unknown>,
  flags: Flags,
  what: string,
): Promise<boolean> {
  if (!flags.apply) {
    log.info(`DRY-RUN would update ${collection}/${doc.id}: ${what}`);
    return true;
  }
  try {
    await payload.update({
      collection,
      id: doc.id,
      data,
      // Preserve publication state: published docs are republished in place;
      // drafts stay drafts. Never flips state.
      draft: doc._status === 'draft',
      locale: flags.locale as 'en' | 'es' | 'ar',
      overrideAccess: true, // trusted administrative migration (this script only)
      context: { seoAuditFix: true },
    });
    log.ok(`updated ${collection}/${doc.id}: ${what}`);
    return true;
  } catch (e) {
    counters.failed++;
    log.err(`update failed ${collection}/${doc.id} (${what}): ${(e as Error).message}`);
    return false;
  }
}

/* ══ Operation 1 — meta description remediation ═══════════════════════════── */
async function opMetaDescriptions(payload: Payload, flags: Flags): Promise<void> {
  log.info('── Operation 1: meta descriptions > 150 chars (articles + tools) ──');
  for (const collection of ['articles', 'tools'] as const) {
    let page = 1;
    let seen = 0;
    for (;;) {
      const res = await payload.find({
        collection,
        limit: flags.batchSize,
        page,
        depth: 0,
        locale: flags.locale as 'en',
        draft: false,
        overrideAccess: true,
      });
      for (const doc of res.docs as (Article | Tool)[]) {
        counters.scanned++;
        seen++;
        const seo = (doc as { seo?: { metaDescription?: unknown } }).seo;
        const raw = seo?.metaDescription;
        if (raw == null || raw === '') continue;
        if (typeof raw !== 'string') {
          counters.skipped++;
          log.warn(`${collection}/${doc.id}: unsupported metaDescription shape (${typeof raw}) — skipped`);
          continue;
        }
        const plainLen = graphemes(normalizeWs(stripHtml(raw))).length;
        if (plainLen <= MAX_DESC) continue; // never touch valid shorter descriptions
        const next = truncateDescription(raw);
        if (flags.verbose) log.info(`${collection}/${doc.id} "${(doc as { slug?: string }).slug ?? ''}": ${plainLen} → ${graphemes(next).length} chars`);
        const ok = await safeUpdate(
          payload, collection, doc as { id: number; _status?: string | null },
          { seo: { ...(seo as object), metaDescription: next } },
          flags, `metaDescription ${plainLen}→${graphemes(next).length} chars`,
        );
        if (ok) counters.metaChanged++;
      }
      if (!res.hasNextPage || seen >= flags.limit) break;
      page++;
    }
    log.info(`${collection}: ${seen} scanned.`);
  }
}

/* ══ Operation 2 — FAQ insertion via the VISIBLE peopleAlsoAsk block ═══════── */
interface PaaItem { question?: string | null; answer?: string | null }
interface PaaBlock { blockType: string; heading?: string | null; items?: PaaItem[] | null }

async function opFaqs(payload: Payload, flags: Flags): Promise<void> {
  log.info('── Operation 2: FAQ remediation (peopleAlsoAsk block + hasFAQ) ──');
  for (const [slug, entries] of Object.entries(FAQ_CONTENT)) {
    try {
      const res = await payload.find({
        collection: 'articles',
        where: { slug: { equals: slug } },
        limit: 1, depth: 0, draft: false,
        locale: flags.locale as 'en',
        overrideAccess: true,
      });
      const doc = res.docs[0] as Article | undefined;
      if (!doc) {
        counters.skipped++;
        log.warn(`FAQ target "${slug}" not found in CMS — skipped (nothing fabricated).`);
        continue;
      }
      const layout = (doc.layout ?? []) as unknown as PaaBlock[];
      const existingPaa = layout.filter((b) => b.blockType === 'peopleAlsoAsk');
      const existingQs = new Set(
        existingPaa.flatMap((b) => (b.items ?? []).map((i) => normQ(String(i.question ?? '')))).filter(Boolean),
      );
      const hasValidFaq = existingQs.size > 0;
      if (hasValidFaq) {
        counters.skipped++;
        log.info(`"${slug}": already has a visible FAQ (${existingQs.size} question(s)) — never overwritten.`);
        continue;
      }
      // dedupe by normalized question text (idempotency)
      const fresh = entries.filter((e) => !existingQs.has(normQ(e.question)));
      if (fresh.length === 0) {
        counters.skipped++;
        log.info(`"${slug}": all FAQ questions already present — skipped.`);
        continue;
      }
      const newLayout = [
        ...layout,
        { blockType: 'peopleAlsoAsk', heading: 'People also ask', items: fresh.map((e) => ({ question: e.question, answer: e.answer })) },
      ];
      const ok = await safeUpdate(
        payload, 'articles', doc as { id: number; _status?: string | null },
        { layout: newLayout, hasFAQ: true },
        flags, `insert ${fresh.length} FAQ item(s) + hasFAQ=true`,
      );
      if (ok) {
        counters.faqInserted += fresh.length;
        log.warn(`"${slug}": inserted FAQ needs EDITORIAL REVIEW (no schema status field exists for this — tracked by this log).`);
      }
    } catch (e) {
      counters.failed++;
      log.err(`FAQ op failed for "${slug}": ${(e as Error).message}`);
    }
  }
}

/* ══ Operation 3 — orphan tools → article.relatedTools (repo direction) ════── */
async function opRelationships(payload: Payload, flags: Flags): Promise<void> {
  log.info('── Operation 3: orphan tools → best article.relatedTools (articles→tools per schema) ──');
  const [toolsRes, articlesRes] = await Promise.all([
    payload.find({ collection: 'tools', limit: 500, depth: 0, draft: false, overrideAccess: true, locale: flags.locale as 'en' }),
    payload.find({ collection: 'articles', limit: 500, depth: 0, draft: false, overrideAccess: true, locale: flags.locale as 'en' }),
  ]);
  const tools = toolsRes.docs as Tool[];
  const articles = articlesRes.docs as Article[];

  const referenced = new Set<number>();
  for (const a of articles) {
    for (const t of a.relatedTools ?? []) { const id = relId(t); if (id) referenced.add(id); }
    const p = relId(a.primaryTool as never); if (p) referenced.add(p);
  }
  const orphans = tools.filter((t) => !referenced.has(t.id));
  log.info(`${tools.length} tools, ${articles.length} articles, ${orphans.length} orphan tool(s).`);

  const MIN_SCORE = 4;
  const MIN_GAP = 2;

  for (const tool of orphans) {
    const tSlug = String((tool as { slug?: string }).slug ?? '');
    const tTokens = tokens(tSlug);
    if (tTokens.length === 0) { counters.unmatchedTools++; log.warn(`tool "${tSlug}": no meaningful tokens — unmatched.`); continue; }
    const tPhrase = tTokens.join('-');

    const scored = articles.map((a) => {
      const aSlug = String(a.slug ?? '');
      const aTokens = tokens(aSlug);
      let score = 0;
      const reasons: string[] = [];
      if (aTokens.join('-') === tPhrase) { score += 5; reasons.push('exact-normalized-slug'); }
      const overlap = tTokens.filter((t) => aTokens.includes(t));
      if (overlap.length) { score += overlap.length * 2; reasons.push(`token-overlap:${overlap.join(',')}`); }
      if (aSlug.includes(tPhrase) || tSlug.includes(aTokens.join('-')) && aTokens.length > 0) { score += 3; reasons.push('keyphrase-containment'); }
      const toolCat = relId(tool.category);
      const artCat = relId(a.category);
      if (toolCat && artCat && toolCat === artCat) { score += 1; reasons.push('category-match'); }
      return { article: a, score, reasons };
    }).sort((x, y) => y.score - x.score);

    const [best, second] = scored;
    if (!best || best.score < MIN_SCORE) {
      counters.unmatchedTools++;
      log.warn(`tool "${tSlug}": no candidate ≥${MIN_SCORE} (best=${best?.score ?? 0}) — editorial review needed.`);
      continue;
    }
    if (second && best.score - second.score < MIN_GAP) {
      counters.ambiguous++;
      log.warn(`tool "${tSlug}": AMBIGUOUS — "${best.article.slug}"(${best.score}) vs "${second.article.slug}"(${second.score}) — skipped for editors.`);
      continue;
    }
    const existing = (best.article.relatedTools ?? []).map((x) => relId(x)).filter((x): x is number => x !== null);
    if (existing.includes(tool.id)) { counters.skipped++; continue; } // idempotent
    const ok = await safeUpdate(
      payload, 'articles', best.article as { id: number; _status?: string | null },
      { relatedTools: [...new Set([...existing, tool.id])] },
      flags, `append tool "${tSlug}" → relatedTools of "${best.article.slug}" (score=${best.score}; ${best.reasons.join('; ')})`,
    );
    if (ok) counters.relationshipsRepaired++;
  }
}

/* ══ Operation 4 — orphan tag integration ═════════════════════════════════── */
async function opTags(payload: Payload, flags: Flags): Promise<void> {
  log.info('── Operation 4: orphan tags (heart-health, mental-wellness) ──');
  for (const [tagSlug, dictionary] of Object.entries(TAG_TOPICS)) {
    const tagRes = await payload.find({
      collection: 'tags', where: { slug: { equals: tagSlug } }, limit: 1, depth: 0, overrideAccess: true,
    });
    const tag = tagRes.docs[0] as Tag | undefined;
    if (!tag) { counters.skipped++; log.warn(`tag "${tagSlug}" does not exist — skipped safely.`); continue; }

    const arts = await payload.find({
      collection: 'articles',
      where: { _status: { equals: 'published' } },
      sort: '-publishDate', limit: 100, depth: 0,
      locale: flags.locale as 'en', overrideAccess: true,
    });

    const candidates = (arts.docs as Article[])
      .map((a) => {
        const already = (a.tags ?? []).map((x) => relId(x)).includes(tag.id);
        const hay = [String(a.slug ?? ''), String(a.title ?? ''), String((a as { excerpt?: string }).excerpt ?? '')].join(' ').toLowerCase();
        let score = 0;
        const hits: string[] = [];
        for (const kw of dictionary) {
          if (String(a.slug ?? '').includes(kw)) { score += 2; hits.push(`slug:${kw}`); }
          else if (hay.includes(kw)) { score += 1; hits.push(kw); }
        }
        return { a, already, score, hits };
      })
      .filter((c) => !c.already && c.score >= TAG_MIN_SCORE)
      .sort((x, y) => y.score - x.score)
      .slice(0, TAG_MAX_ARTICLES);

    if (candidates.length < 3) {
      log.warn(`tag "${tagSlug}": only ${candidates.length} genuinely relevant article(s) found — updating those only (no unrelated tagging).`);
    }
    for (const c of candidates) {
      const existing = (c.a.tags ?? []).map((x) => relId(x)).filter((x): x is number => x !== null);
      const ok = await safeUpdate(
        payload, 'articles', c.a as { id: number; _status?: string | null },
        { tags: [...new Set([...existing, tag.id])] },
        flags, `append tag "${tagSlug}" to "${c.a.slug}" (score=${c.score}; ${c.hits.join(',')})`,
      );
      if (ok) counters.tagsAppended++;
    }
  }
}

/* ══ Post-apply verification ══════════════════════════════════════════════── */
async function verify(payload: Payload, flags: Flags): Promise<void> {
  if (!flags.apply) { log.info('verification: skipped in dry-run (nothing written).'); return; }
  log.info('── Verification pass ──');
  for (const collection of ['articles', 'tools'] as const) {
    const res = await payload.find({ collection, limit: 500, depth: 0, draft: false, overrideAccess: true, locale: flags.locale as 'en' });
    let over = 0;
    for (const d of res.docs as (Article | Tool)[]) {
      const md = (d as { seo?: { metaDescription?: unknown } }).seo?.metaDescription;
      if (typeof md === 'string' && graphemes(normalizeWs(md)).length > MAX_DESC) over++;
    }
    if (over > 0) log.err(`verify: ${over} ${collection} description(s) still >${MAX_DESC} chars`);
    else log.ok(`verify: all ${collection} meta descriptions ≤${MAX_DESC} chars.`);
  }
  for (const slug of Object.keys(FAQ_CONTENT)) {
    const res = await payload.find({ collection: 'articles', where: { slug: { equals: slug } }, limit: 1, depth: 0, draft: false, locale: flags.locale as 'en', overrideAccess: true });
    const doc = res.docs[0] as Article | undefined;
    if (!doc) continue;
    const layout = (doc.layout ?? []) as unknown as PaaBlock[];
    const qs = layout.filter((b) => b.blockType === 'peopleAlsoAsk').flatMap((b) => (b.items ?? []).map((i) => normQ(String(i.question ?? ''))));
    const dupes = qs.length - new Set(qs).size;
    if (dupes > 0) log.err(`verify: "${slug}" has ${dupes} duplicate FAQ question(s)`);
    else if (qs.length > 0) log.ok(`verify: "${slug}" FAQ present, ${qs.length} unique question(s), status=${doc._status}.`);
  }
}

/* ══ main ═════════════════════════════════════════════════════════════════── */
async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  log.info(`seo-audit-fix starting — mode=${flags.apply ? 'APPLY' : 'DRY-RUN'} batch=${flags.batchSize} limit=${flags.limit} locale=${flags.locale}`);
  if (!flags.apply) log.info('No writes will occur. Re-run with --apply after reviewing this output.');

  let payload: Payload | null = null;
  let fatal = false;
  try {
    payload = await getPayload({ config: configPromise });
    await opMetaDescriptions(payload, flags);
    await opFaqs(payload, flags);
    await opRelationships(payload, flags);
    await opTags(payload, flags);
    await verify(payload, flags);
  } catch (e) {
    fatal = true;
    log.err(`fatal: ${(e as Error).message}`);
  } finally {
    log.sum(
      `scanned=${counters.scanned} metaChanged=${counters.metaChanged} faqInserted=${counters.faqInserted} ` +
        `relationshipsRepaired=${counters.relationshipsRepaired} tagsAppended=${counters.tagsAppended} ` +
        `skipped=${counters.skipped} ambiguous=${counters.ambiguous} unmatchedTools=${counters.unmatchedTools} failed=${counters.failed}`,
    );
    if (typeof (payload as { db?: { destroy?: () => Promise<void> } })?.db?.destroy === 'function') {
      try { await (payload as unknown as { db: { destroy: () => Promise<void> } }).db.destroy(); } catch { /* cleanup best-effort */ }
    }
  }
  if (fatal || counters.failed > 0) process.exit(1);
}

/* Run only when executed directly (payload run / tsx), never on import. */
const isDirect = process.argv[1]?.replace(/\\/g, '/').includes('seo-audit-fix');
if (isDirect) {
  void main();
}
