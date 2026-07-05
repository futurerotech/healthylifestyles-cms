/**
 * USDA FoodData Central API service.
 *
 * searchFood(query) — searches the FDC database, preferring SR Legacy and
 *   Foundation data types (generic, per-100g) over Branded items.
 *   Crucially, prefers matches that actually HAVE calorie data — some
 *   Foundation items lack Energy (1008) and would produce 0-calorie results.
 * getNutrients(fdcId) — fetches per-100g nutrient values for the 7 nutrients
 *   we report. Missing nutrients are returned as null (NEVER zero).
 *
 * The API key is read from server env (USDA_FDC_API_KEY) and never exposed
 * to the client. Results are cached in-memory to avoid repeated API calls
 * for common ingredients.
 */

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';
const API_KEY = process.env.USDA_FDC_API_KEY || '';

/** Nutrient IDs we report (per the spec — read these exact IDs). */
const NUTRIENT_IDS: Record<string, number> = {
  calories: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
  sugar: 2000,
  sodium: 1093,
};

export interface UsdaSearchResult {
  fdcId: number;
  name: string;
  dataType: string;
  matchConfidence: 'exact' | 'approx' | 'none';
  nutrients: Record<string, number | null>;
}

interface CacheEntry {
  fdcId: number;
  name: string;
  dataType: string;
  nutrients: Record<string, number | null>;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase()
    .replace(/\(.*?\)/g, ' ')   // strip parenthetical notes like "(raw)"
    .replace(/[,;].*$/, '')      // strip everything after comma/semicolon
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNutrients(foodNutrients: any[]): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const [key, id] of Object.entries(NUTRIENT_IDS)) {
    const found = foodNutrients.find((n) => n.nutrientId === id || n.nutrient?.id === id);
    // FDC search API uses "value"; FDC detail API uses "amount". Check both.
    result[key] = found ? (found.value ?? found.amount ?? found.nutrient?.amount ?? null) : null;
  }
  return result;
}

function assessConfidence(query: string, description: string): 'exact' | 'approx' | 'none' {
  const q = normalizeQuery(query);
  const d = description.toLowerCase();
  const qWords = q.split(' ').filter((w) => w.length > 2);
  const matched = qWords.filter((w) => d.includes(w)).length;
  const ratio = qWords.length > 0 ? matched / qWords.length : 0;
  if (ratio >= 0.8) return 'exact';
  if (ratio >= 0.4) return 'approx';
  return 'none';
}

/** Check if a food has calorie data (nutrient 1008) — used to prefer matches with complete data. */
function hasCalories(foodNutrients: any[]): boolean {
  const cal = foodNutrients.find((n) => n.nutrientId === 1008);
  return cal != null && cal.value != null && cal.value > 0;
}

export function isUsdaConfigured(): boolean {
  return !!API_KEY;
}

interface FdcFood {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: any[];
}

/** Score a food: prefer has-calories > confidence > SR Legacy > Foundation > Branded. */
function scoreFood(food: FdcFood, query: string): number {
  let score = 0;
  if (hasCalories(food.foodNutrients || [])) score += 10;
  const conf = assessConfidence(query, food.description || '');
  if (conf === 'exact') score += 5;
  else if (conf === 'approx') score += 2;
  if (food.dataType === 'SR Legacy') score += 3;
  else if (food.dataType === 'Foundation') score += 2;
  else if (food.dataType === 'Branded') score += 0.5;
  return score;
}

export async function searchFood(query: string): Promise<UsdaSearchResult | null> {
  if (!API_KEY) return null;

  const normalized = normalizeQuery(query);
  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return {
      fdcId: cached.fdcId,
      name: cached.name,
      dataType: cached.dataType,
      matchConfidence: assessConfidence(normalized, cached.name),
      nutrients: cached.nutrients,
    };
  }

  try {
    // Search SR Legacy + Foundation first (generic, per-100g).
    const preferredUrl = `${FDC_BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(normalized)}&dataType=SR%20Legacy,Foundation&pageSize=5`;
    const res = await fetch(preferredUrl);
    if (!res.ok) {
      console.warn(`[USDA] search failed (${res.status}) for: ${normalized}`);
      return null;
    }
    const data = await res.json();
    let foods: FdcFood[] = (data?.foods || []).map((f: any) => ({
      fdcId: f.fdcId,
      description: f.description || '',
      dataType: f.dataType || '',
      foodNutrients: f.foodNutrients || [],
    }));

    // If no SR Legacy/Foundation results, fall back to Branded.
    if (foods.length === 0) {
      const brandedUrl = `${FDC_BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(normalized)}&dataType=Branded&pageSize=3`;
      const fbRes = await fetch(brandedUrl);
      if (!fbRes.ok) return null;
      const fbData = await fbRes.json();
      foods = (fbData?.foods || []).map((f: any) => ({
        fdcId: f.fdcId,
        description: f.description || '',
        dataType: 'Branded',
        foodNutrients: f.foodNutrients || [],
      }));
    }

    if (foods.length === 0) return null;

    // Score and pick the best match (prefer has-calories + confidence + SR Legacy).
    let best = foods[0];
    let bestScore = -1;
    for (const food of foods) {
      const score = scoreFood(food, normalized);
      if (score > bestScore) {
        bestScore = score;
        best = food;
      }
    }

    const nutrients = extractNutrients(best.foodNutrients);
    const confidence = assessConfidence(normalized, best.description);

    cache.set(normalized, {
      fdcId: best.fdcId,
      name: best.description,
      dataType: best.dataType,
      nutrients,
      cachedAt: Date.now(),
    });

    return {
      fdcId: best.fdcId,
      name: best.description,
      dataType: best.dataType,
      matchConfidence: confidence,
      nutrients,
    };
  } catch (err) {
    console.warn(`[USDA] search error for "${normalized}":`, (err as Error).message);
    return null;
  }
}
