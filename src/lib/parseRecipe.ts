/**
 * AI recipe parser.
 *
 * Input: raw recipe text (free-form ingredients list).
 * Output: structured JSON array of ingredients with quantities in grams.
 *
 * The AI's ONLY jobs: (1) split ingredients, (2) extract quantity,
 * (3) convert household units to grams using the provided conversion tables,
 * (4) flag unconvertible items. It must NEVER output calories or macros.
 *
 * Uses the existing generateWithProvider() from services/ai.ts, which
 * routes to whichever AI provider is configured (DeepSeek by default).
 */

import { generateWithProvider, type AIProvider, coerceProvider } from '../services/ai';

export interface ParsedIngredient {
  raw: string;
  name: string;
  quantity: number;       // grams
  unit: string;            // 'g' after conversion
  originalQuantity: number | string;
  originalUnit: string;
  unitConverted: boolean;
}

const SYSTEM_PROMPT = `You are a recipe ingredient parser. Your ONLY job is to split a recipe's ingredient list into individual ingredients and convert quantities to grams.

YOU MUST NOT:
- Estimate or output any calories, macros, or nutrition values
- Add prose, explanations, or markdown
- Include anything outside the JSON array

YOU MUST:
- Split the text into individual ingredients
- Extract the quantity and unit for each
- Convert household units to grams using the tables below
- Set unitConverted:true whenever you convert a volume (tsp/tbsp/cup) or count to grams
- Keep the user's original words in "raw" for transparency
- Use a clear, generic ingredient name in "name" (e.g. "chicken breast, raw", "white rice, raw", "olive oil")

CONVERSION TABLES (use these as fallbacks; use specific density when you know it):

Liquids (water, milk, broth, juice ~1 g/ml):
  1 tsp = 5g, 1 tbsp = 15g, 1 cup = 240g, 1 ml = 1g

Fats/oils (olive oil, butter, mayo):
  1 tsp = 5g, 1 tbsp = 14g, 1 cup = 224g

Dry powders (flour, cocoa, baking soda):
  1 tbsp = 8g, 1 cup = 120g

Dense sugars/salt:
  1 tsp = 5g (range 4-6), 1 cup sugar = 200g, 1 cup flour = 120g

Count-based:
  1 large egg (no shell) = 50g, 1 garlic clove = 3g, 1 medium onion = 110g, 1 pinch = 0.5g

Specific solids (use these, set unitConverted:true):
  1 cup chopped walnuts = 117g, 1 cup white rice (raw) = 185g, 1 cup cooked rice = 158g,
  1 cup rolled oats = 90g, 1 cup Greek yogurt = 245g, 1 cup chopped onion = 160g,
  1 banana (medium) = 118g, 1 apple (medium) = 182g, 1 potato (medium) = 173g,
  1 chicken breast (boneless, raw) = 174g, 1 salmon fillet = 170g

If an ingredient truly cannot be converted to grams (e.g. "to taste", "a pinch of love"), set quantity to 0, unit to "unknown", and unitConverted to false.

OUTPUT FORMAT — strict JSON array, no markdown fences:
[{"raw":"1 cup white rice","name":"white rice, raw","quantity":185,"unit":"g","originalQuantity":1,"originalUnit":"cup","unitConverted":true}]`;

function extractJsonArray(text: string): unknown {
  // Strip markdown code fences if present.
  const stripped = text.replace(/```(?:json)?/gi, '').trim();
  // Find the JSON array.
  const start = stripped.indexOf('[');
  const end = stripped.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

function validateIngredient(obj: any): obj is ParsedIngredient {
  return (
    obj &&
    typeof obj.raw === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.quantity === 'number' &&
    typeof obj.unit === 'string' &&
    (typeof obj.originalQuantity === 'number' || typeof obj.originalQuantity === 'string') &&
    typeof obj.originalUnit === 'string' &&
    typeof obj.unitConverted === 'boolean'
  );
}

export async function parseRecipe(text: string): Promise<ParsedIngredient[]> {
  const provider: AIProvider = coerceProvider(process.env.RECIPE_AI_PROVIDER || 'deepseek');

  const prompt = `${SYSTEM_PROMPT}\n\nRecipe text to parse:\n${text}`;

  const response = await generateWithProvider(provider, prompt);
  const parsed = extractJsonArray(response);

  if (!Array.isArray(parsed)) {
    throw new Error('AI returned an invalid response — expected a JSON array of ingredients.');
  }

  const ingredients: ParsedIngredient[] = [];
  for (const item of parsed) {
    if (validateIngredient(item)) {
      ingredients.push(item);
    }
  }

  if (ingredients.length === 0) {
    throw new Error('AI could not parse any ingredients from the provided text.');
  }

  return ingredients;
}

export function isParseConfigured(): boolean {
  try {
    coerceProvider(process.env.RECIPE_AI_PROVIDER || 'deepseek');
    return !!process.env.DEEPSEEK_API_KEY || !!process.env.ANTHROPIC_API_KEY;
  } catch {
    return false;
  }
}
