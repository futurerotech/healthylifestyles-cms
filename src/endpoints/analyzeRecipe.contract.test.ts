// @vitest-environment node
// Cross-repository contract with the Astro frontend (futurerotech/HealthyLifestyles,
// src/lib/recipeAnalysis.ts verifyRecipeResponse). The frontend pins the SAME JSON at
// scripts/seo/__tests__/fixtures/recipe-cms-contract.json. If this endpoint's response
// shape or wording changes, update both fixtures together.
// The USDA records are STUBS with synthetic FDC IDs (900001-900003): this is a contract
// test, not live USDA validation.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseRecipe } from '../lib/parseRecipe';
import { searchFood } from '../lib/usda';
import { analyzeRecipe } from './analyzeRecipe';

vi.mock('../lib/parseRecipe', () => ({ parseRecipe: vi.fn() }));
vi.mock('../lib/usda', () => ({ isUsdaConfigured: () => true, searchFood: vi.fn() }));

const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/recipe-frontend-contract.json', import.meta.url), 'utf8'));
const foods: Record<string, unknown> = {
  'white rice raw': { fdcId: 900001, name: 'Rice, white, long-grain, regular, raw, enriched', dataType: 'SR Legacy', matchConfidence: 'exact',
    nutrients: { calories: 365, protein: 7.1, fat: 0.7, carbs: 80, fiber: 1.3, sugar: null, sodium: 5 } },
  'olive oil': { fdcId: 900002, name: 'Oil, olive, salad or cooking', dataType: 'SR Legacy', matchConfidence: 'exact',
    nutrients: { calories: 884, protein: 0, fat: 100, carbs: 0, fiber: 0, sugar: 0, sodium: 2 } },
  onion: { fdcId: 900003, name: 'Onions, raw', dataType: 'Foundation', matchConfidence: 'approx',
    nutrients: { calories: 40, protein: 1.1, fat: 0.1, carbs: 9.3, fiber: 1.7, sugar: 4.2, sodium: 4 } },
};
const parsed = [
  { raw: '100 g white rice (raw)', name: 'white rice raw', quantity: 100, unit: 'g', originalQuantity: 100, originalUnit: 'g', unitConverted: false },
  { raw: '1 tbsp olive oil', name: 'olive oil', quantity: 13.5, unit: 'g', originalQuantity: 1, originalUnit: 'tbsp', unitConverted: true },
  { raw: '1 medium onion', name: 'onion', quantity: 110, unit: 'g', originalQuantity: 1, originalUnit: 'medium', unitConverted: true },
  { raw: 'a pinch of saffron', name: 'saffron', quantity: 0, unit: 'pinch', originalQuantity: 'a pinch', originalUnit: 'pinch', unitConverted: false },
];

describe('recipe analysis response contract with the frontend verifier', () => {
  it('returns exactly the pinned frontend contract (provenance, null nutrients, partial totals, notes)', async () => {
    vi.mocked(parseRecipe).mockResolvedValue(parsed as never);
    vi.mocked(searchFood).mockImplementation(async (name: string) => (foods[name] ?? null) as never);
    const res = await analyzeRecipe.handler({
      json: async () => ({ text: '100 g white rice (raw)\n1 tbsp olive oil\n1 medium onion\na pinch of saffron', servings: 2 }),
      headers: new Headers({ 'x-forwarded-for': 'contract-test' }),
    } as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual(fixture);
  });

  it('nothing matched is HTTP 422 with no totals, which the frontend maps to a fixed message', async () => {
    vi.mocked(parseRecipe).mockResolvedValue([parsed[3]] as never);
    const res = await analyzeRecipe.handler({
      json: async () => ({ text: 'a pinch of saffron', servings: 1 }),
      headers: new Headers({ 'x-forwarded-for': 'contract-test-422' }),
    } as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(['error']);
  });
});
