/**
 * USDA FoodData Central API service.
 *
 * searchFood(query) — searches the FDC database, preferring SR Legacy and
 *   Foundation data types (generic, per-100g) over Branded items.
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
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractNutrients(foodNutrients: any[]): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const [key, id] of Object.entries(NUTRIENT_IDS)) {
    const found = foodNutrients.find((n) => n.nutrientId === id || n.nutrient?.id === id);
    result[key] = found ? (found.amount ?? found.nutrient?.amount ?? null) : null;
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

export function isUsdaConfigured(): boolean {
  return !!API_KEY;
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

  // Try SR Legacy + Foundation first (generic, per-100g).
  const preferredTypes = 'SR%20Legacy,Foundation';
  const url = `${FDC_BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(normalized)}&dataType=${preferredTypes}&pageSize=3&sortBy=dataType.keyword`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[USDA] search failed (${res.status}) for: ${normalized}`);
      return null;
    }
    const data = await res.json();
    const foods = data?.foods;
    if (!Array.isArray(foods) || foods.length === 0) {
      // Fallback: try Branded if no SR Legacy/Foundation match.
      const fallbackUrl = `${FDC_BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(normalized)}&dataType=Branded&pageSize=1`;
      const fbRes = await fetch(fallbackUrl);
      if (!fbRes.ok) return null;
      const fbData = await fbRes.json();
      if (!fbData?.foods?.length) return null;
      const food = fbData.foods[0];
      const nutrients = extractNutrients(food.foodNutrients || []);
      const confidence = assessConfidence(normalized, food.description || '');
      cache.set(normalized, {
        fdcId: food.fdcId,
        name: food.description || normalized,
        dataType: 'Branded',
        nutrients,
        cachedAt: Date.now(),
      });
      return { fdcId: food.fdcId, name: food.description || normalized, dataType: 'Branded', matchConfidence: confidence, nutrients };
    }

    // Pick the best match from SR Legacy/Foundation.
    let best = foods[0];
    let bestConfidence = 'none' as 'exact' | 'approx' | 'none';
    for (const food of foods) {
      const conf = assessConfidence(normalized, food.description || '');
      if (conf === 'exact') { best = food; bestConfidence = 'exact'; break; }
      if (conf === 'approx' && bestConfidence === 'none') { best = food; bestConfidence = 'approx'; }
    }

    const nutrients = extractNutrients(best.foodNutrients || []);
    cache.set(normalized, {
      fdcId: best.fdcId,
      name: best.description || normalized,
      dataType: best.dataType || 'SR Legacy',
      nutrients,
      cachedAt: Date.now(),
    });

    return {
      fdcId: best.fdcId,
      name: best.description || normalized,
      dataType: best.dataType || 'SR Legacy',
      matchConfidence: bestConfidence,
      nutrients,
    };
  } catch (err) {
    console.warn(`[USDA] search error for "${normalized}":`, (err as Error).message);
    return null;
  }
}
