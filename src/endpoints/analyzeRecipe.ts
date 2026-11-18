import type { Endpoint, PayloadRequest } from 'payload';
import { searchFood, isUsdaConfigured, type UsdaSearchResult } from '../lib/usda';
import { parseRecipe, type ParsedIngredient } from '../lib/parseRecipe';
import {
  NUTRIENT_KEYS, emptyNutrients, scaleNutrients, addInto,
  roundSet, divideBy, validateRecipeRequest, type NutrientSet,
} from '../lib/recipeNutrition';
import { denyIsolatedStagingOutbound } from '../lib/isolated-staging-outbound';

/**
 * POST /api/analyze-recipe — PUBLIC, educational nutrition estimates.
 * Parses ingredient amounts with the existing AI/regex flow and retrieves
 * per-100g data from USDA. This endpoint never estimates nutrient values
 * from an AI answer. All missing nutrient fields remain null, not zero.
 */
interface IngredientResult extends ParsedIngredient {
  usedFood: string;
  fdcId: number;
  dataType: string;
  matchConfidence: UsdaSearchResult['matchConfidence'];
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
const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (payload: unknown, status = 200): Response =>
  Response.json(payload, { status, headers: RESPONSE_HEADERS });

export const analyzeRecipe: Endpoint = {
  path: '/analyze-recipe',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    // Staging must not reach paid AI parsing or the external USDA API.
    const stagingDenied = denyIsolatedStagingOutbound();
    if (stagingDenied) return stagingDenied;
    // Rate limit
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    if (!checkRate(ip))
      return json({ error: 'Too many requests. Please wait a minute and try again.' }, 429);

    let body: unknown;
    try { body = req.json ? await req.json() : null; }
    catch { return json({ error: 'Invalid JSON body.' }, 400); }

    const validated = validateRecipeRequest(body);
    if (!validated.ok) return json({ error: validated.error }, 400);
    const { text, servings } = validated.value;

    if (!isUsdaConfigured())
      return json({ error: 'Nutrition lookup is currently unavailable.' }, 503);

    try {
      // The parser itself safely falls back to regex when its AI key is absent
      // or the provider fails. USDA key is still necessary for all nutrition.
      const parsed = await parseRecipe(text);
      const ingredients: IngredientResult[] = [];
      const unmatched: ParsedIngredient[] = [];
      const notes: string[] = [];
      const totals = emptyNutrients();

      for (const ing of parsed) {
        if (!Number.isFinite(ing.quantity) || ing.quantity <= 0 || ing.unit !== 'g' ||
            !ing.name.trim()) {
          unmatched.push(ing);
          continue;
        }

        const food = await searchFood(ing.name);
        if (!food || food.matchConfidence === 'none') {
          unmatched.push(ing);
          continue;
        }

        const ingNutrients = scaleNutrients(food.nutrients, ing.quantity);
        if (NUTRIENT_KEYS.every(key => ingNutrients[key] === null)) {
          unmatched.push(ing);
          continue;
        }
        addInto(totals, ingNutrients);
        ingredients.push({
          ...ing,
          usedFood: food.name,
          fdcId: food.fdcId,
          dataType: food.dataType,
          matchConfidence: food.matchConfidence,
          nutrients: roundSet(ingNutrients),
        });
        if (food.matchConfidence === 'approx')
          notes.push('"' + ing.raw + '" was matched approximately to "' +
            food.name + '". Verify the food and preparation state.');
        if (ing.unitConverted)
          notes.push('"' + ing.raw + '" was converted from ' +
            ing.originalUnit + ' to approximate grams.');
      }

      if (!ingredients.length)
        return json({ error: 'No ingredients could be matched to usable nutrition data. Check quantities and food names.' }, 422);

      for (const key of NUTRIENT_KEYS) {
        if (totals[key] === null)
          notes.push('At least one matched ingredient has no usable ' + key +
            ' value; the full ' + key + ' total is unavailable, not zero.');
      }
      if (unmatched.length)
        notes.push(unmatched.length + ' ingredient(s) could not be analyzed and are excluded. ' +
          'Any reported values are matched-food contributions, not a complete recipe total.');

      const result: AnalyzeResponse = {
        perRecipe: roundSet(totals),
        perServing: divideBy(totals, servings),
        ingredients, unmatched, servings,
        notes: [...new Set(notes)],
      };
      return json(result);
    } catch {
      // Provider exceptions could echo sensitive recipe text or credentials;
      // never forward or log third-party exception bodies.
      return json({ error: 'Recipe analysis is temporarily unavailable. Please try again later.' }, 502);
    }
  },
};
