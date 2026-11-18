// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseRecipeFallback } from './parseRecipe';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('regex fallback ingredient and unit parsing (offline)', () => {
  it('preserves both raw and cooked rice states, and uses existing cup assumptions', () => {
    const [raw, cooked] = parseRecipeFallback(
      '1 cup white rice (raw)\n1 cup white rice, cooked');
    expect(raw).toMatchObject({ quantity: 185, unit: 'g', originalUnit: 'cup', unitConverted: true });
    expect(raw.name).toContain('raw');
    expect(cooked).toMatchObject({ quantity: 158, unit: 'g', originalUnit: 'cup', unitConverted: true });
    expect(cooked.name).toContain('cooked');
  });
  it('parses common fractions without changing a written amount', () => {
    const [half, mixed, quarter] = parseRecipeFallback(
      '1/2 cup white rice (cooked)\n1 1/2 cup rolled oats\n1/4 cup sugar');
    expect(half.quantity).toBe(79);
    expect(mixed.quantity).toBe(135);
    expect(quarter.quantity).toBe(50);
  });
  it('parses mass conversions and count conversions with provenance', () => {
    const list = parseRecipeFallback(
      '200 g chicken breast (raw)\n1 kg potatoes\n500 mg salt\n2 large eggs');
    expect(list.map(x => x.quantity)).toEqual([200, 1000, 0.5, 100]);
    expect(list.map(x => x.unitConverted)).toEqual([false, true, true, true]);
    expect(list[0].name).toContain('raw');
    expect(list[3].name).toContain('whole');
  });
  it('does not split preparation qualifiers or parenthetical commas', () => {
    const entries = parseRecipeFallback(
      '200g chicken breast (boneless, skinless), 2 eggs\n100 g rice, cooked');
    expect(entries).toHaveLength(3);
    expect(entries[0].name).toContain('boneless');
    expect(entries[0].name).toContain('skinless');
    expect(entries[2].name).toContain('cooked');
  });
  it('never invents weights for invalid, negative or unrecognized quantities', () => {
    for (const item of ['0 g rice','3/0 cup rice','-1 cup rice','salt to taste']) {
      const result = parseRecipeFallback(item);
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe('unknown');
      expect(result[0].quantity).toBe(0);
    }
  });
});

describe('AI parser response validation (no real AI calls)', () => {
  const parser = async (content: string) => {
    vi.resetModules();
    vi.stubEnv('NARAROUTER_API_KEY','test-fixture-no-real-secret');
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        choices: [{ message: { content } }],
      }),{status:200})));
    return (await import('./parseRecipe')).parseRecipe;
  };
  it('retains raw state when external AI omits it from the search name', async () => {
    const body = JSON.stringify([{
      raw:'200 g white rice (raw)',name:'white rice',quantity:200,unit:'g',
      originalQuantity:200,originalUnit:'g',unitConverted:false,
    }]);
    const parse = await parser(body);
    const value = await parse('200 g white rice (raw)');
    expect(value[0].name).toBe('white rice raw');
  });
  it('rejects a mixed valid-and-corrupt AI array instead of silently dropping lines', async () => {
    const body = JSON.stringify([
      {raw:'200 g rice raw',name:'rice raw',quantity:200,unit:'g',
        originalQuantity:200,originalUnit:'g',unitConverted:false},
      {raw:'1 tbsp oil',name:'oil',quantity:'NaN',unit:'g',
        originalQuantity:1,originalUnit:'tbsp',unitConverted:true},
    ]);
    const parse = await parser(body);
    const result = await parse('200 g rice raw\n1 tbsp olive oil');
    expect(result).toHaveLength(2);
    expect(result[1].quantity).toBe(14);
  });
});