/**
 * USDA FoodData Central search for per-100g nutrients.
 * FDC IDs and dataType are reported from USDA, not inferred from descriptions.
 * 1008 is Energy for SR Legacy/Branded; Foundation also uses 2047/2048.
 * Data source: https://fdc.nal.usda.gov/Foundation_Foods_Documentation/
 */
const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';
const API_KEY = process.env.USDA_FDC_API_KEY || '';
const NUTRIENT_IDS: Record<string, number> = {
  protein: 1003, fat: 1004, carbs: 1005, fiber: 1079,
  sugar: 2000, sodium: 1093,
};
type Confidence = 'exact' | 'approx' | 'none';
type Per100gNutrients = Record<string, number | null>;
export interface UsdaSearchResult {
  fdcId: number;
  name: string;
  dataType: string;
  matchConfidence: Confidence;
  nutrients: Per100gNutrients;
}

interface FdcFood {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: unknown[];
}
interface CacheEntry extends Omit<UsdaSearchResult, 'matchConfidence'> {
  cachedAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

/** Keep raw/cooked descriptors even if separated by parentheses or commas. */
export function normalizeQuery(query: string): string {
  return query.toLowerCase()
    .replace(/[()[\],;:]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const tokens = (text: string) =>
  normalizeQuery(text).split(/\s+/).filter(Boolean);
const stateOf = (text: string): 'raw' | 'cooked' | 'ambiguous' | null => {
  const words = new Set(tokens(text));
  const raw = words.has('raw') || words.has('uncooked');
  const cooked = ['cooked', 'boiled', 'baked', 'steamed', 'roasted',
    'grilled', 'fried', 'braised'].some(w => words.has(w));
  return raw && cooked ? 'ambiguous' : raw ? 'raw' : cooked ? 'cooked' : null;
};

export function assessConfidence(query: string, description: string): Confidence {
  const q = tokens(query).filter(w => w.length > 2);
  const d = new Set(tokens(description));
  if (!q.length || !d.size) return 'none';
  // Raw and cooked ingredient variants are materially different. Never
  // auto-substitute an explicit user preparation state with the opposite one.
  const requestedState = stateOf(query);
  const foundState = stateOf(description);
  if (requestedState === 'ambiguous' || foundState === 'ambiguous' ||
      (requestedState && requestedState !== foundState)) return 'none';
  const matched = q.filter(w => d.has(w) || (w.endsWith('s') && d.has(w.slice(0, -1)))).length;
  const ratio = matched / q.length;
  return ratio >= 0.8 ? 'exact' : ratio >= 0.4 ? 'approx' : 'none';
}

type FoodNutrient = {
  nutrientId?: number; nutrient?: { id?: number; amount?: number };
  value?: number | null; amount?: number | null; unitName?: string;
};
const findValue = (raw: FoodNutrient[], nutrientId: number, isEnergy = false): number | null => {
  for (const n of raw) {
    if (!n || (n.nutrientId !== nutrientId && n.nutrient?.id !== nutrientId)) continue;
    const unit = n.unitName?.toLowerCase();
    if (isEnergy && unit && unit !== 'kcal') continue;
    const value = n.value ?? n.amount ?? n.nutrient?.amount;
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  }
  return null;
};
export function extractNutrients(data: unknown, dataType: string): Per100gNutrients {
  const values: FoodNutrient[] = Array.isArray(data) ? data : [];
  const result: Per100gNutrients = {};
  // Foundation's food-specific Atwater factor energy is preferable to
  // general factor; for other types keep 1008 first for compatibility.
  const energyIds = dataType === 'Foundation' ? [2048, 2047, 1008] : [1008, 2048, 2047];
  result.calories = null;
  for (const id of energyIds) {
    const kcal = findValue(values, id, true);
    if (kcal !== null) { result.calories = kcal; break; }
  }
  for (const [key, id] of Object.entries(NUTRIENT_IDS))
    result[key] = findValue(values, id);
  return result;
}
const energyAvailable = (food: FdcFood): boolean =>
  extractNutrients(food.foodNutrients, food.dataType).calories !== null;
export function isUsdaConfigured(): boolean { return !!API_KEY; }

/** Reject invalid USDA records, then rank text fit BEFORE energy coverage. */
export function selectBestFood(foods: readonly FdcFood[], query: string): FdcFood | null {
  let chosen: FdcFood | null = null;
  let highest = -1;
  for (const food of foods) {
    if (!Number.isSafeInteger(food.fdcId) || food.fdcId <= 0 ||
        !food.description.trim() || !food.dataType.trim()) continue;
    const confidence = assessConfidence(query, food.description);
    if (confidence === 'none') continue;
    const rank = (confidence === 'exact' ? 100 : 50) +
      (energyAvailable(food) ? 10 : 0) +
      (food.dataType === 'SR Legacy' ? 3 : food.dataType === 'Foundation' ? 2 : 1);
    if (rank > highest) { highest = rank; chosen = food; }
  }
  return chosen;
}

const toFood = (data: unknown): FdcFood[] => {
  if (!data || typeof data !== 'object' || !('foods' in data) ||
      !Array.isArray((data as { foods?: unknown }).foods)) return [];
  const result: FdcFood[] = [];
  for (const item of (data as { foods: unknown[] }).foods) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Partial<FdcFood>;
    if (!Number.isSafeInteger(f.fdcId) || !f.fdcId || f.fdcId <= 0 ||
        typeof f.description !== 'string' || typeof f.dataType !== 'string') continue;
    result.push({
      fdcId: f.fdcId,
      description: f.description,
      dataType: f.dataType,
      foodNutrients: Array.isArray(f.foodNutrients) ? f.foodNutrients : [],
    });
  }
  return result;
};

/** Explicit search fields: raw/cooked tokens remain in the query and cache key. */
async function searchData(query: string, dataType: string, size: number): Promise<FdcFood[]> {
  const url = new URL(FDC_BASE + '/foods/search');
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('query', query);
  url.searchParams.set('dataType', dataType);
  url.searchParams.set('pageSize', String(size));
  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  });
  if (!response.ok) return [];
  return toFood(await response.json());
}

export async function searchFood(query: string): Promise<UsdaSearchResult | null> {
  if (!API_KEY || typeof query !== 'string') return null;
  const normalized = normalizeQuery(query);
  if (!normalized || normalized.length > 300) return null;
  const saved = cache.get(normalized);
  if (saved && Date.now() - saved.cachedAt < CACHE_TTL)
    return {
      fdcId: saved.fdcId, name: saved.name, dataType: saved.dataType,
      matchConfidence: assessConfidence(normalized, saved.name),
      nutrients: saved.nutrients,
    };

  try {
    // Prefer generic food data, but also try Branded if generic text matches
    // are absent or conflict with a requested raw/cooked state.
    let preferred = await searchData(normalized, 'SR Legacy,Foundation', 5);
    let best = selectBestFood(preferred, normalized);
    if (!best) {
      preferred = await searchData(normalized, 'Branded', 3);
      best = selectBestFood(preferred, normalized);
    }
    if (!best) return null;
    const nutrients = extractNutrients(best.foodNutrients, best.dataType);
    const found = {
      fdcId: best.fdcId,
      name: best.description,
      dataType: best.dataType,
      nutrients,
    };
    cache.set(normalized, { ...found, cachedAt: Date.now() });
    return {
      ...found,
      matchConfidence: assessConfidence(normalized, best.description),
    };
  } catch {
    // Upstream text, API credentials, and ingredient names are not logged.
    return null;
  }
}
