import type { Endpoint, PayloadRequest } from 'payload';
import { searchFood, isUsdaConfigured, type UsdaSearchResult } from '../lib/usda';
import { parseRecipe, isParseConfigured, type ParsedIngredient } from '../lib/parseRecipe';

/* ---------------------------------------------------------------------------
 * Recipe Nutrition Analyzer endpoint.
 *
 * POST /api/analyze-recipe
 *   Body: { text: string, servings: number }
 *   Public (no auth) — rate-limited by simple in-memory counter.
 *
 * Flow: AI parse → USDA search per ingredient → compute totals → return.
 * The AI NEVER estimates nutrient values. All numbers come from USDA.
 * ------------------------------------------------------------------------- */

interface NutrientSet {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
}

interface IngredientResult extends ParsedIngredient {
  usedFood: string;
  nutrients: NutrientSet;
}

interface AnalyzeResponse {
  perRecipe: NutrientSet;
  perServing: NutrientSet;
  ingredients: IngredientResult[];
  unmatched: ParsedIngredient[];
  servings: number;
  notes: string[];
}

const MAX_TEXT_LENGTH = 5000;
const NUTRIENT_KEYS: (keyof NutrientSet)[] = ['calories', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'sodium'];

// Simple in-memory rate limiter (per IP, 10 requests per minute).
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function checkRate(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function emptyNutrients(): NutrientSet {
  return { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 };
}

function scaleNutrients(n: Record<string, number | null>, grams: number): NutrientSet {
  const factor = grams / 100;
  return {
    calories: n.calories != null ? n.calories * factor : null,
    protein: n.protein != null ? n.protein * factor : null,
    fat: n.fat != null ? n.fat * factor : null,
    carbs: n.carbs != null ? n.carbs * factor : null,
    fiber: n.fiber != null ? n.fiber * factor : null,
    sugar: n.sugar != null ? n.sugar * factor : null,
    sodium: n.sodium != null ? n.sodium * factor : null,
  };
}

function addInto(totals: NutrientSet, add: NutrientSet): void {
  for (const key of NUTRIENT_KEYS) {
    if (add[key] != null) {
      totals[key] = (totals[key] ?? 0) + add[key]!;
    }
  }
}

function divideBy(totals: NutrientSet, servings: number): NutrientSet {
  const result = emptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    if (totals[key] != null) {
      result[key] = Math.round((totals[key]! / servings) * 10) / 10;
    } else {
      result[key] = null;
    }
  }
  return result;
}

function roundSet(n: NutrientSet): NutrientSet {
  const result = emptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    result[key] = n[key] != null ? Math.round(n[key]! * 10) / 10 : null;
  }
  return result;
}

export const analyzeRecipe: Endpoint = {
  path: '/analyze-recipe',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    // Rate limit
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    if (!checkRate(ip)) {
      return Response.json({ error: 'Too many requests. Please wait a minute and try again.' }, { status: 429 });
    }

    // Config check
    if (!isUsdaConfigured()) {
      return Response.json({ error: 'Recipe analyzer is not configured. Set USDA_FDC_API_KEY on the server.' }, { status: 503 });
    }
    if (!isParseConfigured()) {
      return Response.json({ error: 'Recipe analyzer is not configured. Set NARAROUTER_API_KEY and USDA_FDC_API_KEY on the server.' }, { status: 503 });
    }

    // Parse body
    let body: { text?: string; servings?: number };
    try {
      body = req.json ? await req.json() : {};
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const text = (body.text || '').trim();
    const servings = Math.max(1, Math.min(100, Math.round(Number(body.servings) || 1)));

    if (!text || text.length < 5) {
      return Response.json({ error: 'Please provide a recipe or ingredient list (at least a few words).' }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return Response.json({ error: `Recipe text is too long (max ${MAX_TEXT_LENGTH} characters).` }, { status: 400 });
    }

    try {
      // 1. AI parse
      const parsed = await parseRecipe(text);

      // 2. USDA search + 3. compute
      const ingredients: IngredientResult[] = [];
      const unmatched: ParsedIngredient[] = [];
      const notes: string[] = [];
      const totals = emptyNutrients();

      for (const ing of parsed) {
        if (ing.quantity <= 0 || ing.unit === 'unknown') {
          unmatched.push(ing);
          continue;
        }

        const usdaResult: UsdaSearchResult | null = await searchFood(ing.name);

        if (!usdaResult || usdaResult.matchConfidence === 'none') {
          unmatched.push(ing);
          continue;
        }

        const ingNutrients = scaleNutrients(usdaResult.nutrients, ing.quantity);
        addInto(totals, ingNutrients);

        ingredients.push({
          ...ing,
          usedFood: usdaResult.name,
          nutrients: roundSet(ingNutrients),
        });

        if (usdaResult.matchConfidence === 'approx') {
          notes.push(`"${ing.raw}" was approximated as "${usdaResult.name}" — the match is not exact.`);
        }
        if (ing.unitConverted) {
          notes.push(`"${ing.raw}" was converted from ${ing.originalUnit} to grams — this is an approximation.`);
        }
      }

      // Check for null nutrients in totals
      for (const key of NUTRIENT_KEYS) {
        if (totals[key] === null) {
          notes.push(`Some ingredients did not report ${key} — the total may be understated.`);
        }
      }

      const perRecipe = roundSet(totals);
      const perServing = divideBy(totals, servings);

      const result: AnalyzeResponse = {
        perRecipe,
        perServing,
        ingredients,
        unmatched,
        servings,
        notes: [...new Set(notes)], // dedupe
      };

      return Response.json(result, { status: 200 });
    } catch (err) {
      const message = (err as Error).message || 'Unknown error during analysis.';
      return Response.json({ error: message }, { status: 502 });
    }
  },
};
