// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  NUTRIENT_KEYS, emptyNutrients, scaleNutrients, addInto,
  divideBy, roundSet, validateRecipeRequest,
} from './recipeNutrition';

describe('recipe input contract', () => {
  it('preserves legitimate 1–100 whole-number servings without silent clamping', () => {
    for (const servings of [1, 2, 100]) {
      expect(validateRecipeRequest({ text: '200 g cooked rice', servings }))
        .toEqual({ ok: true, value: { text: '200 g cooked rice', servings } });
    }
    for (const servings of [0, -1, 101, 2.5, NaN, Infinity, -Infinity, '4', null, undefined])
      expect(validateRecipeRequest({ text: '200 g cooked rice', servings }).ok)
        .toBe(false);
  });
  it('rejects invalid, short and oversized recipe text rather than truncating', () => {
    for (const text of ['', '   ', 'xyz', 23, null, 'a'.repeat(5001)])
      expect(validateRecipeRequest({ text, servings: 1 }).ok).toBe(false);
    expect(validateRecipeRequest({ text: 'x'.repeat(5000), servings: 1 }).ok).toBe(true);
    expect(validateRecipeRequest({ text: '  100 g rice  ', servings: 3 }))
      .toEqual({ ok: true, value: { text: '100 g rice', servings: 3 } });
  });
});

describe('per-100g nutrition scaling and arithmetic', () => {
  const base = () => ({
    calories: 100, protein: 3, fat: 0, carbs: 21,
    fiber: 2, sugar: 1, sodium: 0,
  });
  it('scales amounts exactly before rounding with legitimate zero nutrients', () => {
    expect(scaleNutrients(base(), 250)).toEqual({
      calories: 250, protein: 7.5, fat: 0, carbs: 52.5,
      fiber: 5, sugar: 2.5, sodium: 0,
    });
  });
  it('rejects negative, nonfinite and zero gram weights', () => {
    for (const weight of [0, -1, Infinity, NaN])
      expect(() => scaleNutrients(base(), weight)).toThrow('Invalid ingredient weight');
  });
  it('keeps missing values unknown at an ingredient level; never treats them as zero', () => {
    const data = scaleNutrients({ ...base(), calories: null, sugar: null, fat: NaN }, 100);
    expect(data.calories).toBeNull();
    expect(data.sugar).toBeNull();
    expect(data.fat).toBeNull();
    expect(data.sodium).toBe(0);
  });
  it('propagates one null to a whole nutrient subtotal even if other foods have values', () => {
    const totals = emptyNutrients();
    addInto(totals, scaleNutrients(base(), 100));
    addInto(totals, scaleNutrients({ ...base(), protein: null }, 200));
    expect(totals.protein).toBeNull();
    expect(totals.calories).toBe(300);
    expect(totals.fat).toBe(0);
    expect(totals.sodium).toBe(0);
  });
  it('stays unknown after additional known values are added', () => {
    const totals = emptyNutrients();
    addInto(totals, scaleNutrients({ ...base(), calories: null }, 100));
    addInto(totals, scaleNutrients(base(), 100));
    expect(totals.calories).toBeNull();
  });
  it('reports null for all seven nutrient keys when USDA reports nothing', () => {
    const nutrient = scaleNutrients(
      Object.fromEntries(NUTRIENT_KEYS.map(k => [k, null])), 100);
    const total = emptyNutrients();
    addInto(total, nutrient);
    for (const key of NUTRIENT_KEYS)
      expect(total[key]).toBeNull();
  });
  it('divides the unrounded recipe sum before one-decimal output rounding', () => {
    const total = { ...emptyNutrients(), calories: 100, protein: 7.7 };
    expect(divideBy(total, 3).calories).toBe(33.3);
    expect(divideBy(total, 3).protein).toBe(2.6);
    expect(roundSet(total).calories).toBe(100);
    expect(divideBy({ ...total, protein: null }, 3).protein).toBeNull();
    for (const servings of [0, 1.25, -1, 101])
      expect(() => divideBy(total, servings)).toThrow('Invalid serving count');
  });
  it('distinguishes missing calorie data from a legitimately reported zero', () => {
    const totals = emptyNutrients();
    addInto(totals, scaleNutrients({ ...base(), calories: 0 }, 100));
    expect(totals.calories).toBe(0);
    addInto(totals, scaleNutrients({ ...base(), calories: null }, 100));
    expect(totals.calories).toBeNull();
  });
});