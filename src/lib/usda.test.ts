// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeQuery, assessConfidence, extractNutrients, selectBestFood,
} from './usda';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const food = (
  fdcId: number, description: string, dataType: string,
  foodNutrients: unknown[],
) => ({ fdcId, description, dataType, foodNutrients });

const nutrient = (nutrientId: number, value: number | null, unitName?: string) =>
  ({ nutrientId, value, unitName });

describe('USDA nutrient data provenance and preparation', () => {
  it('preserves raw/cooked after commas and parentheses', () => {
    expect(normalizeQuery('  White rice (raw), washed ')).toBe('white rice raw washed');
    expect(normalizeQuery('White rice, cooked')).toBe('white rice cooked');
    expect(normalizeQuery('Egg, whole; raw')).toBe('egg whole raw');
  });
  it('never presents an explicitly cooked food as an exact raw-food match', () => {
    expect(assessConfidence('rice, raw','Rice white long-grain cooked')).toBe('none');
    expect(assessConfidence('rice, cooked','Rice, raw')).toBe('none');
    expect(assessConfidence('rice, cooked','Rice, boiled')).toBe('approx');
    expect(assessConfidence('rice, raw','Rice, white, raw')).toBe('exact');
    expect(assessConfidence('rice, cooked','Rice, white, cooked')).toBe('exact');
  });
  it('uses 2048 then 2047 for Foundation kcal, not kJ or false 1008 preference', () => {
    const f = extractNutrients([
      nutrient(1008, 220, 'KCAL'),
      nutrient(2047, 235, 'KCAL'),
      nutrient(2048, 240, 'KCAL'),
      nutrient(1003, 11, 'G'),
    ], 'Foundation');
    expect(f.calories).toBe(240);
    expect(f.protein).toBe(11);
  });
  it('uses 2047 in Foundation when 2048 missing, 1008 for legacy data', () => {
    const values = [nutrient(1008, 200, 'KCAL'), nutrient(2047, 185, 'KCAL')];
    expect(extractNutrients(values, 'Foundation').calories).toBe(185);
    expect(extractNutrients(values, 'SR Legacy').calories).toBe(200);
  });
  it('distinguishes zero from null and excludes kJ-only or negative values', () => {
    const values = [
      nutrient(2048, 240, 'KJ'),
      nutrient(2047, 0, 'KCAL'),
      nutrient(1003, -1, 'G'),
      nutrient(1093, 0, 'MG'),
    ];
    const n = extractNutrients(values,'Foundation');
    expect(n.calories).toBe(0);
    expect(n.protein).toBeNull();
    expect(n.sodium).toBe(0);
    expect(extractNutrients([nutrient(2048, 100, 'KJ')], 'Foundation').calories).toBeNull();
  });
  it('supports nested detail nutrient IDs and amount fields', () => {
    const n = extractNutrients([{ nutrient: { id: 1003 }, amount: 9.8 }],'SR Legacy');
    expect(n.protein).toBe(9.8);
    expect(n.fiber).toBeNull();
  });
  it('prefers actual food text fit over merely having calorie data', () => {
    const list = [
      food(1, 'Rice, cooked, long-grain', 'SR Legacy', [nutrient(1008, 135)]),
      food(2, 'Rice, white, long-grain, raw', 'Foundation', [nutrient(1003, 6.8)]),
    ];
    expect(selectBestFood(list,'rice white raw')?.fdcId).toBe(2);
  });
  it('ignores candidates without a usable USDA ID or a comparable description', () => {
    expect(selectBestFood([
      food(-1, 'Rice, white, raw', 'Foundation', [nutrient(2047, 353)]),
      food(12, 'Water, bottled', 'Foundation', [nutrient(2047, 0)]),
    ],'rice raw')).toBeNull();
  });
});

describe('mocked USDA API search — no credential or external call', () => {
  const api = async () => {
    vi.resetModules();
    vi.stubEnv('USDA_FDC_API_KEY', 'test-fixture-no-real-key');
    return await import('./usda');
  };
  it('queries USDA with raw/cooked intact and returns its actual ID and data type', async () => {
    const requested: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const u=new URL(input); requested.push(u.searchParams.get('query')||'');
      return new Response(JSON.stringify({
        foods: [
          food(321, 'Rice, white, cooked', 'SR Legacy', [nutrient(1008, 130,'KCAL')]),
          food(322, 'Rice, white, raw', 'Foundation', [nutrient(2048, 355,'KCAL')]),
        ],
      }), {status:200});
    }));
    const u=await api();
    const result=await u.searchFood('Rice, white (raw)');
    expect(result).toMatchObject({
      fdcId:322, dataType:'Foundation', name:'Rice, white, raw',
      matchConfidence:'exact', nutrients:{calories:355},
    });
    expect(requested).toEqual(['rice white raw']);
  });
  it('caches distinct raw and cooked matches independently', async () => {
    const fetchStub = vi.fn(async (input:string) => {
      const query=new URL(input).searchParams.get('query')||'';
      const raw=query.includes('raw');
      return new Response(JSON.stringify({
        foods: [raw
          ? food(17,'Rice, raw','Foundation',[nutrient(2047,345)])
          : food(18,'Rice, cooked','Foundation',[nutrient(2047,128)])],
      }),{status:200});
    });
    vi.stubGlobal('fetch',fetchStub);
    const u=await api();
    const raw=await u.searchFood('Rice, raw');
    const cooked=await u.searchFood('Rice, cooked');
    const again=await u.searchFood('Rice, raw');
    expect(raw?.fdcId).toBe(17);
    expect(cooked?.fdcId).toBe(18);
    expect(again?.fdcId).toBe(17);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
  it('tries Branded only when no compatible generic match exists', async () => {
    const kinds:string[]=[];
    vi.stubGlobal('fetch', vi.fn(async (input:string) => {
      const kind=new URL(input).searchParams.get('dataType')||'';
      kinds.push(kind);
      return new Response(JSON.stringify({
        foods: kind==='Branded'
          ? [food(9001,'Yogurt plain','Branded',[nutrient(1008,65)])] : [],
      }),{status:200});
    }));
    const u=await api();
    const r=await u.searchFood('Yogurt plain');
    expect(r?.fdcId).toBe(9001);
    expect(r?.dataType).toBe('Branded');
    expect(kinds).toEqual(['SR Legacy,Foundation','Branded']);
  });
  it('returns no false match for raw request with only cooked records', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({foods:[
        food(18,'Rice, white, cooked','SR Legacy',[nutrient(1008,130)]),
      ]}),{status:200})));
    const u=await api();
    expect(await u.searchFood('Rice white raw')).toBeNull();
  });
});