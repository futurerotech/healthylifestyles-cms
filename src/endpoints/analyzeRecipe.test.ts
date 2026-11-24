// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseRecipe } from '../lib/parseRecipe';
import { searchFood } from '../lib/usda';
import { analyzeRecipe } from './analyzeRecipe';

vi.mock('../lib/parseRecipe', () => ({ parseRecipe: vi.fn() }));
vi.mock('../lib/usda', () => ({
  isUsdaConfigured: () => true,
  searchFood: vi.fn(),
}));

let index = 0;
const invoke = async (body: unknown) =>
  analyzeRecipe.handler({
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': 'offline-test-' + (++index) }),
  } as never);
const parsed = [
  { raw:'100 g white rice (raw)', name:'white rice raw', quantity:100,
    unit:'g', originalQuantity:100, originalUnit:'g', unitConverted:false },
  { raw:'200 g olive oil', name:'olive oil', quantity:200,
    unit:'g', originalQuantity:200, originalUnit:'g', unitConverted:false },
];
const nutrients = {
  calories:100, protein:4, fat:1, carbs:20, fiber:2, sugar:0, sodium:0,
};
const usda = (name: string, fdcId = 101, nutrientValues = nutrients) => ({
  fdcId, name, dataType:'Foundation', matchConfidence:'exact' as const,
  nutrients:nutrientValues,
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(parseRecipe).mockResolvedValue(parsed);
  vi.mocked(searchFood).mockImplementation(async (name: string) =>
    name.includes('rice')
      ? usda('Rice, raw',111)
      : usda('Oil, olive',222, {
        calories:400, protein:0, fat:40, carbs:0, fiber:0,sugar:0,sodium:0,
      }));
});

describe('Payload recipe analysis endpoint: isolated input and USDA fixtures', () => {
  it('returns correct recipe and portion totals, with real FDC identifiers and type', async () => {
    const result=await invoke({text:'100 g rice raw, 200 g olive oil',servings:4});
    const body=await result.json();
    expect(result.status).toBe(200);
    expect(body.perRecipe.calories).toBe(900);
    expect(body.perServing.calories).toBe(225);
    expect(body.perRecipe.protein).toBe(4);
    expect(body.perServing.protein).toBe(1);
    expect(body.ingredients.map((x: {fdcId:number})=>x.fdcId)).toEqual([111,222]);
    expect(body.ingredients[0].dataType).toBe('Foundation');
    expect(body.ingredients[0].usedFood).toBe('Rice, raw');
    expect(result.headers.get('Cache-Control')).toBe('no-store');
  });
  it('propagates missing per-ingredient nutrient into NULL recipe and per-serving totals', async () => {
    vi.mocked(searchFood).mockImplementation(async (name: string) =>
      name.includes('rice') ? usda('Rice, raw',111) :
        usda('Oil, olive',222, { ...nutrients, calories:null as never, protein:null as never }));
    const res=await invoke({text:'100 g rice raw, 200 g olive oil',servings:2});
    const body=await res.json();
    expect(res.status).toBe(200);
    expect(body.perRecipe.calories).toBeNull();
    expect(body.perServing.calories).toBeNull();
    expect(body.perRecipe.protein).toBeNull();
    expect(body.perRecipe.sodium).toBe(0);
    expect(body.notes.join(' ')).toMatch(/unavailable, not zero/);
  });
  it('one valid match and one unmatched ingredient is explicitly incomplete', async () => {
    vi.mocked(searchFood).mockResolvedValueOnce(usda('Rice, raw',111))
      .mockResolvedValueOnce(null);
    const res=await invoke({text:'100 g rice raw, 200 g olive oil',servings:4});
    const body=await res.json();
    expect(res.status).toBe(200);
    expect(body.perRecipe.calories).toBe(100);
    expect(body.unmatched).toHaveLength(1);
    expect(body.notes.join(' ')).toMatch(/matched-food contributions/);
  });
  it('all unmatched results cannot be misrepresented as a 0 kcal recipe', async () => {
    vi.mocked(searchFood).mockResolvedValue(null);
    const res=await invoke({text:'100 g rice raw, 200 g olive oil',servings:4});
    expect(res.status).toBe(422);
    const body=await res.json();
    expect(body.perRecipe).toBeUndefined();
    expect(body.error).toMatch(/No ingredients could be matched/);
  });
  it('rejects invalid and fractional servings before invoking any third-party services', async () => {
    for (const servings of [0, 1.5, 101, '4', null, NaN]) {
      const res=await invoke({text:'100 g rice, 200 g oil',servings});
      expect(res.status).toBe(400);
    }
    expect(parseRecipe).not.toHaveBeenCalled();
    expect(searchFood).not.toHaveBeenCalled();
  });
  it('rejects invalid and oversized input without provider calls', async () => {
    for (const text of [null, '', 'hi', 'x'.repeat(5001)]) {
      const res=await invoke({text,servings:1});
      expect(res.status).toBe(400);
    }
    expect(parseRecipe).not.toHaveBeenCalled();
    expect(searchFood).not.toHaveBeenCalled();
  });
  it('treats malformed parsed ingredient quantities as unmatched without NaN sums', async () => {
    vi.mocked(parseRecipe).mockResolvedValue([
      {...parsed[0],quantity:Infinity},parsed[1],
    ]);
    const res=await invoke({text:'100 g rice raw, 200 g olive oil',servings:4});
    const body=await res.json();
    expect(res.status).toBe(200);
    expect(body.unmatched).toHaveLength(1);
    expect(body.perRecipe.calories).toBe(800);
  });
  it('safely handles zero-ingredient parser output without invented nutrition', async () => {
    vi.mocked(parseRecipe).mockResolvedValue([]);
    const res=await invoke({text:'100 g rice raw',servings:2});
    expect(res.status).toBe(422);
    expect((await res.json()).perRecipe).toBeUndefined();
  });
  it('does not relay provider error text, secret material or submitted recipe on failure', async () => {
    vi.mocked(parseRecipe).mockRejectedValue(
      new Error('secret token / patient-text / raw provider response'));
    const res=await invoke({text:'100 g rice raw',servings:1});
    expect(res.status).toBe(502);
    const payload=JSON.stringify(await res.json());
    expect(payload).not.toMatch(/secret token|patient-text|provider response/);
    expect(payload).toMatch(/temporarily unavailable/);
  });
});
describe('isolated staging', () => {
  it('refuses before any paid AI parse or external USDA request', async () => {
    vi.stubEnv('HLS_ISOLATED_STAGING', 'true');
    try {
      const res = await invoke({ text: '100 g white rice (raw)', servings: 1 });
      expect(res.status).toBe(503);
      expect(parseRecipe).not.toHaveBeenCalled();
      expect(searchFood).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
