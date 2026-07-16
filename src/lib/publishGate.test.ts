/** SEO Quality Gate Phase 2 — publish gate unit + e2e-shape tests. */
import { describe, it, expect } from 'vitest';
import { runPublishGate, extractInternalLinks, findBrokenInternalLinks, type GateContext } from './publishGate';

const ctx = (over: Partial<GateContext> = {}): GateContext => ({
  toolSlugs: new Set(['bmi-calculator', 'macro-calculator']),
  articleSlugs: new Set(['healthy-bmi-by-age']),
  categorySlugs: new Set(['nutrition', 'fitness']),
  ...over,
});

/** A doc that passes every check. */
const healthy = () => ({
  title: 'How Many Calories Should I Eat to Lose Weight?',
  seo: { noIndex: false, metaDescription: 'A realistic, evidence-based way to set your daily calorie target for safe weight loss — from your own body, activity level, and goals.' },
  layout: [
    { blockType: 'text', content: 'Use the [BMI calculator](/tools/bmi-calculator) and read [BMI by age](/wellness-hub/healthy-bmi-by-age). Also [macros](/tools/macro-calculator), [nutrition hub](/wellness-hub/nutrition), and [fitness](/wellness-hub/fitness).' },
  ],
  sources: [{ label: 'CDC' }, { label: 'WHO' }],
  reviewer: 7,
});

describe('publish gate — BLOCK set (narrow, deterministic)', () => {
  it('E2E CASE A (spec): a broken internal link BLOCKS publish', () => {
    const doc = healthy();
    doc.layout.push({ blockType: 'text', content: 'See [this](/tools/does-not-exist).' } as never);
    const r = runPublishGate(doc, ctx());
    expect(r.blocks.map((b) => b.code)).toContain('B4');
    expect(r.blocks.find((b) => b.code === 'B4')?.message).toContain('/tools/does-not-exist');
  });

  it('missing title blocks (B1); 61-char title blocks (B2)', () => {
    expect(runPublishGate({ ...healthy(), title: '  ' }, ctx()).blocks.map((b) => b.code)).toContain('B1');
    expect(runPublishGate({ ...healthy(), title: 'x'.repeat(61) }, ctx()).blocks.map((b) => b.code)).toContain('B2');
    expect(runPublishGate({ ...healthy(), title: 'x'.repeat(60) }, ctx()).blocks).toHaveLength(0);
  });

  it('noindex on a real article blocks (B3)', () => {
    const doc = healthy();
    doc.seo.noIndex = true as never;
    expect(runPublishGate(doc, ctx()).blocks.map((b) => b.code)).toContain('B3');
  });

  it('healthy doc: zero blocks, zero warns', () => {
    const r = runPublishGate(healthy(), ctx());
    expect(r.blocks).toHaveLength(0);
    expect(r.warns).toHaveLength(0);
  });
});

describe('publish gate — WARN set (never blocks)', () => {
  it('E2E CASE B (spec): a short meta description only WARNS', () => {
    const doc = healthy();
    doc.seo.metaDescription = 'Too short.';
    const r = runPublishGate(doc, ctx());
    expect(r.blocks).toHaveLength(0); // must not block
    expect(r.warns.map((w) => w.code)).toContain('W1');
  });

  it('few internal links (W2), few sources (W3), no reviewer (W4)', () => {
    const doc = { ...healthy(), layout: [{ blockType: 'text', content: 'no links here' }], sources: [], reviewer: null };
    const codes = runPublishGate(doc, ctx()).warns.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(['W2', 'W3', 'W4']));
    expect(runPublishGate(doc, ctx()).blocks).toHaveLength(0);
  });

  it('hero alt: null/empty warns; UNKNOWN is fail-safe silent', () => {
    expect(runPublishGate(healthy(), ctx({ heroImageAlt: null })).warns.map((w) => w.code)).toContain('W5');
    expect(runPublishGate(healthy(), ctx({ heroImageAlt: '' })).warns.map((w) => w.code)).toContain('W5');
    expect(runPublishGate(healthy(), ctx({ heroImageAlt: 'A plate of food' })).warns.map((w) => w.code)).not.toContain('W5');
    expect(runPublishGate(healthy(), ctx()).warns.map((w) => w.code)).not.toContain('W5'); // undefined = unknown
  });
});

describe('link extraction + broken detection (deterministic, fail-safe)', () => {
  it('extracts markdown internal links from nested layout', () => {
    const links = extractInternalLinks([{ a: { b: 'x [y](/tools/bmi-calculator) z' } }, 'plain [q](/wellness-hub/nutrition)']);
    expect(links).toEqual(['/tools/bmi-calculator', '/wellness-hub/nutrition']);
  });

  it('external and non-scoped internal links are never judged', () => {
    const links = ['/about', '/wellness-hub/nutrition/2', 'https://cdc.gov/x'];
    expect(findBrokenInternalLinks(links, ctx())).toHaveLength(0);
  });

  it('category slugs count as valid wellness-hub targets', () => {
    expect(findBrokenInternalLinks(['/wellness-hub/nutrition'], ctx())).toHaveLength(0);
  });

  it('fragment/query variants resolve to the base target', () => {
    expect(findBrokenInternalLinks(['/tools/bmi-calculator#how', '/tools/bmi-calculator?x=1'], ctx())).toHaveLength(0);
    expect(findBrokenInternalLinks(['/tools/nope#how'], ctx())).toEqual(['/tools/nope']);
  });

  it('dedupes repeated broken targets', () => {
    expect(findBrokenInternalLinks(['/tools/nope', '/tools/nope/'], ctx())).toEqual(['/tools/nope']);
  });
});
