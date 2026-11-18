/**
 * Deterministic, provider-free recipe math. All USDA values are per 100 g.
 * Do not replace an unknown nutrient with 0, even if other foods report it.
 */
export const NUTRIENT_KEYS = [
  'calories', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'sodium',
] as const;
export type NutrientKey = typeof NUTRIENT_KEYS[number];
export type NutrientSet = Record<NutrientKey, number | null>;

export const emptyNutrients = (): NutrientSet => ({
  calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0,
});

export function scaleNutrients(
  per100g: Record<string, number | null>,
  grams: number,
): NutrientSet {
  if (!Number.isFinite(grams) || grams <= 0)
    throw new Error('Invalid ingredient weight');
  const factor = grams / 100;
  if (!Number.isFinite(factor))
    throw new Error('Invalid ingredient weight');

  const result = emptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    const value = per100g[key];
    const scaled = typeof value === 'number' ? value * factor : null;
    result[key] = typeof value === 'number' && Number.isFinite(value) &&
      value >= 0 && scaled !== null && Number.isFinite(scaled) && scaled >= 0
      ? scaled : null;
  }
  return result;
}

/** One missing ingredient value makes the total for THAT nutrient unknown. */
export function addInto(totals: NutrientSet, ingredient: NutrientSet): void {
  for (const key of NUTRIENT_KEYS) {
    const next = ingredient[key];
    const current = totals[key];
    if (next === null || current === null ||
        !Number.isFinite(next) || !Number.isFinite(current) ||
        next < 0 || current < 0 || !Number.isFinite(next + current)) {
      totals[key] = null;
    } else {
      totals[key] = current + next;
    }
  }
}
const roundTenth = (value: number): number => Math.round(value * 10) / 10;

export function roundSet(values: NutrientSet): NutrientSet {
  const result = emptyNutrients();
  for (const key of NUTRIENT_KEYS)
    result[key] = values[key] === null ? null : roundTenth(values[key]!);
  return result;
}

/** Divide unrounded recipe totals, then round once; servings must be whole. */
export function divideBy(values: NutrientSet, servings: number): NutrientSet {
  if (!Number.isInteger(servings) || servings < 1 || servings > 100)
    throw new Error('Invalid serving count');
  const result = emptyNutrients();
  for (const key of NUTRIENT_KEYS)
    result[key] = values[key] === null ? null : roundTenth(values[key]! / servings);
  return result;
}

export type RecipeRequestResult =
  | { ok: true; value: { text: string; servings: number } }
  | { ok: false; error: string };

export function validateRecipeRequest(body: unknown): RecipeRequestResult {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return { ok: false, error: 'Provide a recipe and a whole-number serving count.' };
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.text !== 'string' || candidate.text.trim().length < 5)
    return { ok: false, error: 'Provide an ingredient list of at least 5 characters.' };
  if (candidate.text.length > 5000 || candidate.text.trim().length > 5000)
    return { ok: false, error: 'Recipe text is too long (max 5000 characters).' };
  if (typeof candidate.servings !== 'number' || !Number.isInteger(candidate.servings) ||
      candidate.servings < 1 || candidate.servings > 100)
    return { ok: false, error: 'Servings must be a whole number from 1 to 100.' };
  return { ok: true, value: { text: candidate.text.trim(), servings: candidate.servings } };
}
