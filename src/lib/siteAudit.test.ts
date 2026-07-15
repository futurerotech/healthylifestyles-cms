/**
 * P17 — Site Audit @type extraction. Immunizes the array-form bug: the old
 * string-only regex could not see `"@type":["MedicalWebPage","Article"]` and
 * false-flagged every article page as missing Article schema (second scanner
 * bitten by this class — discover-audit was the first).
 */
import { describe, it, expect } from 'vitest';
import { collectJsonLdTypes } from './siteAudit';

const collect = (json: unknown): Set<string> => {
  const s = new Set<string>();
  collectJsonLdTypes(json, s);
  return s;
};

describe('collectJsonLdTypes', () => {
  it('string form: "@type":"Organization"', () => {
    expect(collect({ '@context': 'https://schema.org', '@type': 'Organization' })).toContain('Organization');
  });

  it('ARRAY form (the P17 bug): "@type":["MedicalWebPage","Article"]', () => {
    const types = collect({ '@context': 'https://schema.org', '@type': ['MedicalWebPage', 'Article'], headline: 'x' });
    expect(types).toContain('Article');
    expect(types).toContain('MedicalWebPage');
  });

  it('exact production article-page shape is detected as Article', () => {
    // Mirrors the live page that the scanner false-flagged.
    const node = {
      '@context': 'https://schema.org',
      '@type': ['MedicalWebPage', 'Article'],
      '@id': 'https://www.healthylifesstyles.com/wellness-hub/healthy-bmi-by-age',
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.wh-article__lead'] },
      audience: { '@type': 'MedicalAudience', audienceType: 'Patient' },
    };
    const types = collect(node);
    expect(types).toContain('Article');
    expect(types).toContain('SpeakableSpecification'); // nested walk preserved
  });

  it('nested types still collected (FAQPage → Question → Answer)', () => {
    const types = collect({
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'q', acceptedAnswer: { '@type': 'Answer', text: 'a' } }],
    });
    expect(types).toContain('FAQPage');
    expect(types).toContain('Question');
    expect(types).toContain('Answer');
  });

  it('top-level array of nodes (multiple JSON-LD objects in one block)', () => {
    const types = collect([{ '@type': 'WebSite' }, { '@type': ['Article'] }]);
    expect(types).toContain('WebSite');
    expect(types).toContain('Article');
  });

  it('non-string junk inside @type arrays is ignored safely', () => {
    const types = collect({ '@type': ['Article', 42, null, { bad: true }] });
    expect(types).toContain('Article');
    expect(types.size).toBe(1);
  });

  it('null/primitive inputs are no-ops', () => {
    expect(collect(null).size).toBe(0);
    expect(collect('string').size).toBe(0);
    expect(collect(42).size).toBe(0);
  });
});
