/**
 * First-party Search Console opportunity screening — no network, AI API, or writes.
 *
 * This is a transparent triage heuristic for queries that already displayed a
 * HealthyLifeStyles URL. Search Console impressions are NOT total market search
 * volume, and this module does NOT measure organic competition or guarantee a
 * ranking. Run on private, authorized, finalized query+page GSC exports only.
 */
export interface GscQueryPageRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface Opportunity {
  query: string;
  page: string;
  clicks28d: number;
  impressions28d: number;
  ctr: number;
  averagePosition: number;
  previousImpressions28d: number | null;
  observedChangePercent: number | null;
  /** 0–100 FIRST-PARTY editorial triage heuristic; NOT "keyword difficulty". */
  priorityScore: number;
  nextStep: 'review-existing-page';
  medicalReviewRequired: boolean;
  globalMonthlySearches: null;
  organicCompetition: 'unmeasured';
  evidence: 'gsc-query-page-28d';
}

export interface ScreeningResult {
  opportunities: Opportunity[];
  acceptedRows: number;
  rejectedRows: number;
  caveats: string[];
}

const ORIGIN = 'https://www.healthylifesstyles.com';
const MIN_IMPRESSIONS = 20;
const MAX_ROWS = 25000;
const HIGH_RISK_TERMS = /\b(pregnan(?:t|cy)|diabet(?:es|ic)|depress(?:ion|ed)|suicid(?:e|al)|cancer|heart disease|blood pressure|medicat(?:ion|ions)|drug interaction|treat(?:ment)?|diagnos(?:is|e)|eating disorder|anorexia|child|infant)\b/i;

function normalizedQuery(q: string): string {
  return q.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function rowKey(query: string, page: string): string {
  return query + '\u0000' + page;
}

function safePage(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === ORIGIN && url.search === '' && url.hash === '' &&
      url.pathname !== '/' && (url.pathname.startsWith('/tools/') || url.pathname.startsWith('/wellness-hub/'));
  } catch {
    return false;
  }
}

function validRow(row: GscQueryPageRow): row is GscQueryPageRow {
  if (!row || !Array.isArray(row.keys) || row.keys.length !== 2) return false;
  const [query, page] = row.keys;
  if (typeof query !== 'string' || typeof page !== 'string' ||
      !normalizedQuery(query) || query.length > 300 || !safePage(page)) return false;
  return [row.clicks, row.impressions, row.ctr, row.position].every(Number.isFinite) &&
    row.impressions >= 0 && row.clicks >= 0 && row.clicks <= row.impressions &&
    row.ctr >= 0 && row.ctr <= 1 && row.position > 0;
}

/**
 * Deterministic screening; accepted rows are grouped by query + own-site page.
 * Reject duplicate keys rather than silently double-count paginated responses.
 */
export function screenSearchOpportunities(
  current28d: readonly GscQueryPageRow[],
  previous28d: readonly GscQueryPageRow[] = [],
): ScreeningResult {
  if (current28d.length > MAX_ROWS || previous28d.length > MAX_ROWS) {
    throw new RangeError('GSC batch is larger than 25,000 rows; paginate and analyze separately.');
  }
  const previous = new Map<string, GscQueryPageRow>();
  for (const row of previous28d) {
    if (!validRow(row)) continue;
    const key = rowKey(normalizedQuery(row.keys[0]), row.keys[1]);
    if (!previous.has(key)) previous.set(key, row);
  }

  let rejectedRows = 0;
  const seen = new Set<string>();
  const opportunities: Opportunity[] = [];

  for (const row of current28d) {
    if (!validRow(row) || row.impressions < MIN_IMPRESSIONS) {
      rejectedRows++;
      continue;
    }
    const query = normalizedQuery(row.keys[0]);
    const page = row.keys[1];
    const key = rowKey(query, page);
    if (seen.has(key)) {
      rejectedRows++;
      continue;
    }
    seen.add(key);
    const prior = previous.get(key);
    const priorImpressions = prior?.impressions ?? null;
    const change = priorImpressions !== null && priorImpressions > 0 ?
      (row.impressions - priorImpressions) / priorImpressions * 100 : null;
    // The ranking band is an editorial heuristic, not a SERP competitiveness measure.
    const rankingOpportunity = row.position >= 5 && row.position <= 30 ? 1 :
      row.position > 30 && row.position <= 60 ? 0.5 : 0.2;
    // Log scaling avoids allowing a few very high-impression queries to dominate.
    const siteDemandSignal = Math.min(1, Math.log1p(row.impressions) / Math.log1p(2000));
    const growthSignal = change === null ? 0 : Math.max(0, Math.min(1, change / 100));
    const priorityScore = Math.round(100 * (
      0.55 * siteDemandSignal + 0.35 * rankingOpportunity + 0.10 * growthSignal
    ));

    opportunities.push({
      query, page, clicks28d: row.clicks, impressions28d: row.impressions,
      ctr: row.ctr, averagePosition: row.position,
      previousImpressions28d: priorImpressions,
      observedChangePercent: change === null ? null : Math.round(change * 10) / 10,
      priorityScore, nextStep: 'review-existing-page',
      medicalReviewRequired: HIGH_RISK_TERMS.test(query),
      globalMonthlySearches: null, organicCompetition: 'unmeasured',
      evidence: 'gsc-query-page-28d',
    });
  }
  opportunities.sort((a, b) => b.priorityScore - a.priorityScore ||
    b.impressions28d - a.impressions28d || a.query.localeCompare(b.query) ||
    a.page.localeCompare(b.page));

  return {
    opportunities, acceptedRows: opportunities.length, rejectedRows,
    caveats: [
      'First-party Search Console impressions do not measure global keyword search volume.',
      'Google Ads advertising competition is not organic SEO ranking difficulty.',
      'Search Console omits some queries and does not guarantee a complete inventory.',
      'Opportunities suggest reviewing existing pages; new articles need distinct human-verified search intent and editorial approval.',
      'High-risk medical queries require qualified review; no tool auto-publishes content.',
    ],
  };
}
