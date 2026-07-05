/**
 * AI recipe parser — NaraRouter gateway edition.
 *
 * Calls NaraRouter (router.bynara.id/v1, OpenAI-compatible) with the model
 * specified by AI_PARSE_MODEL (default: claude-sonnet-4.6, fallback:
 * deepseek-v4-flash). On provider error or timeout, retries once with the
 * fallback model, then falls back to a regex parser for well-formatted lines.
 *
 * The AI's ONLY jobs: (1) split ingredients, (2) extract quantity,
 * (3) convert household units to grams using the provided conversion tables,
 * (4) flag unconvertible items. It must NEVER output calories or macros.
 */

export interface ParsedIngredient {
  raw: string;
  name: string;
  quantity: number;       // grams
  unit: string;            // 'g' after conversion
  originalQuantity: number | string;
  originalUnit: string;
  unitConverted: boolean;
}

const NARA_BASE = process.env.NARAROUTER_BASE_URL || 'https://router.bynara.id/v1';
const NARA_KEY = process.env.NARAROUTER_API_KEY || '';
const PRIMARY_MODEL = process.env.AI_PARSE_MODEL || 'claude-sonnet-4.6';
const FALLBACK_MODEL = 'deepseek-v4-flash';
const TIMEOUT_MS = 30_000;

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

OUTPUT FORMAT — strict JSON array, no markdown fences, no prose:
[{"raw":"1 cup white rice","name":"white rice, raw","quantity":185,"unit":"g","originalQuantity":1,"originalUnit":"cup","unitConverted":true}]`;

/* ── NaraRouter call (OpenAI-compatible) ────────────────────────────── */

async function callNaraRouter(prompt: string, model: string): Promise<string> {
  if (!NARA_KEY) {
    throw new Error('NaraRouter API key is not configured. Set NARAROUTER_API_KEY in .env');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${NARA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NARA_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`NaraRouter error ${res.status}: ${body.slice(0, 200)}`);
    }

    const json: any = await res.json().catch(() => ({}));
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text) {
      throw new Error('NaraRouter returned an empty response');
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

/* ── JSON extraction ────────────────────────────────────────────────── */

function extractJsonArray(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, '').trim();
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

function toIngredients(parsed: unknown): ParsedIngredient[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(validateIngredient);
}

/* ── Regex fallback parser ──────────────────────────────────────────── */
/**
 * Handles well-formatted lines like:
 *   "200g chicken breast"  →  {raw, name:"chicken breast", quantity:200, unit:"g", ...}
 *   "1 cup white rice"     →  {raw, name:"white rice", quantity:185, unit:"g", converted}
 *   "2 large eggs"         →  {raw, name:"eggs", quantity:100, unit:"g", converted}
 *   "1 tbsp olive oil"     →  {raw, name:"olive oil", quantity:14, unit:"g", converted}
 */

const VOLUME_GRAMS: Record<string, { default: number; fats?: number; liquids?: number; powders?: number }> = {
  tsp: { default: 5, fats: 5, liquids: 5 },
  tbsp: { default: 8, fats: 14, liquids: 15 },
  'tablespoon': { default: 8, fats: 14, liquids: 15 },
  cup: { default: 200, fats: 224, liquids: 240, powders: 120 },
  'cups': { default: 200, fats: 224, liquids: 240, powders: 120 },
  ml: { default: 1 },
  l: { default: 1000 },
};

// Count-based foods: key = user's word, value = grams per unit.
// The SEARCH_NAME override helps USDA find the right item (e.g. "eggs whole"
// instead of "egg white").
const COUNT_GRAMS: Record<string, number> = {
  egg: 50, eggs: 50,
  'garlic': 3, 'clove': 3, 'cloves': 3,
  'onion': 110, 'onions': 110,
  'banana': 118, 'bananas': 118,
  'apple': 182, 'apples': 182,
  'potato': 173, 'potatoes': 173,
};

// Override the name sent to USDA for count-based items that would otherwise
// match the wrong variant (e.g. "eggs" → "egg white" instead of "egg whole").
const COUNT_SEARCH_NAME: Record<string, string> = {
  egg: 'egg whole', eggs: 'eggs whole',
};

/**
 * Clean ingredient name: strip parentheses but keep their content.
 * "white rice (raw)" → "white rice raw"
 * "chicken breast (boneless, skinless)" → "chicken breast boneless skinless"
 */
function cleanName(raw: string): string {
  return raw.replace(/\(|\)/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

const FAT_WORDS = ['oil', 'butter', 'margarine', 'mayo', 'lard', 'ghee'];
const LIQUID_WORDS = ['water', 'milk', 'broth', 'stock', 'juice', 'wine', 'vinegar', 'cream'];
const POWDER_WORDS = ['flour', 'cocoa', 'sugar', 'salt', 'baking', 'powder', 'spice'];

function classifyIngredient(name: string): 'fats' | 'liquids' | 'powders' | 'default' {
  const lower = name.toLowerCase();
  if (FAT_WORDS.some((w) => lower.includes(w))) return 'fats';
  if (LIQUID_WORDS.some((w) => lower.includes(w))) return 'liquids';
  if (POWDER_WORDS.some((w) => lower.includes(w))) return 'powders';
  return 'default';
}

function regexParse(text: string): ParsedIngredient[] {
  const lines = text.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);
  const results: ParsedIngredient[] = [];

  for (const line of lines) {
    // Pattern 1: "200g chicken breast" or "200 g chicken breast"
    let m = line.match(/^(\d+(?:\.\d+)?)\s*(g|kg|mg)\s+(.+)$/i);
    if (m) {
      const qty = parseFloat(m[1]);
      const unit = m[2].toLowerCase();
      const grams = unit === 'kg' ? qty * 1000 : unit === 'mg' ? qty / 1000 : qty;
      results.push({ raw: line, name: cleanName(m[3]), quantity: grams, unit: 'g', originalQuantity: qty, originalUnit: unit, unitConverted: false });
      continue;
    }

    // Pattern 2: "1 cup white rice" or "2 tbsp olive oil"
    m = line.match(/^(\d+(?:\.\d+)?)\s*(tsp|tbsp|tablespoon|cup|cups|ml|l)\s+(.+)$/i);
    if (m) {
      const qty = parseFloat(m[1]);
      const unit = m[2].toLowerCase();
      const name = cleanName(m[3]);
      const category = classifyIngredient(name);
      const unitDef = VOLUME_GRAMS[unit];
      if (unitDef) {
        const gramsPer = unitDef[category] ?? unitDef.default;
        const grams = qty * gramsPer;
        results.push({ raw: line, name, quantity: grams, unit: 'g', originalQuantity: qty, originalUnit: unit, unitConverted: true });
        continue;
      }
    }

    // Pattern 3: "2 large eggs" or "1 medium onion" (count + countable food)
    m = line.match(/^(\d+)\s+(?:large\s+|medium\s+|small\s+)?(.+)$/i);
    if (m) {
      const qty = parseInt(m[1], 10);
      const name = cleanName(m[2]);
      const gramsPer = COUNT_GRAMS[name];
      if (gramsPer) {
        // Use a better search name for USDA (e.g. "eggs whole" not "eggs")
        const searchName = COUNT_SEARCH_NAME[name] ?? name;
        results.push({ raw: line, name: searchName, quantity: qty * gramsPer, unit: 'g', originalQuantity: qty, originalUnit: 'count', unitConverted: true });
        continue;
      }
    }

    // Could not parse — push as unknown
    results.push({ raw: line, name: cleanName(line), quantity: 0, unit: 'unknown', originalQuantity: '', originalUnit: '', unitConverted: false });
  }

  return results;
}

/* ── Main entry: parseRecipe ────────────────────────────────────────── */

class ParseError extends Error {
  constructor(public userMessage: string) {
    super(userMessage);
  }
}

export async function parseRecipe(text: string): Promise<ParsedIngredient[]> {
  // If NaraRouter is not configured, go straight to regex fallback.
  if (!NARA_KEY) {
    console.warn('[parseRecipe] NARAROUTER_API_KEY not set — using regex fallback parser');
    return regexParse(text);
  }

  const userPrompt = `Recipe text to parse:\n${text}`;
  let lastError = '';

  // Try primary model
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      console.log(`[parseRecipe] Calling NaraRouter with model: ${model}`);
      const response = await callNaraRouter(userPrompt, model);
      const parsed = extractJsonArray(response);
      const ingredients = toIngredients(parsed);

      if (ingredients.length > 0) {
        console.log(`[parseRecipe] Successfully parsed ${ingredients.length} ingredients with ${model}`);
        return ingredients;
      }

      // AI responded but JSON was invalid or empty — try regex fallback
      console.warn(`[parseRecipe] ${model} returned unparseable JSON — trying regex fallback`);
      return regexParse(text);
    } catch (err) {
      lastError = (err as Error).message;
      console.warn(`[parseRecipe] ${model} failed: ${lastError}`);
      // Continue to next model (fallback)
    }
  }

  // Both AI models failed — use regex fallback
  console.warn(`[parseRecipe] All AI models failed (${lastError}) — using regex fallback parser`);
  const fallback = regexParse(text);

  if (fallback.length === 0) {
    throw new ParseError(
      'We could not parse your recipe. Please format ingredients with quantities and units (e.g. "200g chicken breast, 1 cup rice, 2 eggs") and try again.'
    );
  }

  return fallback;
}

export function isParseConfigured(): boolean {
  return !!NARA_KEY;
}
