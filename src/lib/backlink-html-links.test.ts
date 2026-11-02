// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hasRealBacklink } from './backlink-html-links';

const source = 'https://referrer.example/articles/one';
const target = '/tools/bmi-calculator';
const good = 'https://www.healthylifesstyles.com/tools/bmi-calculator';

describe('active backlink evidence', () => {
  it('rejects plain domain text and a link to another page', () => {
    expect(hasRealBacklink('<p>Visit healthylifesstyles.com today</p>', source, target)).toBe(false);
    expect(hasRealBacklink('<a href="https://www.healthylifesstyles.com/">Homepage</a>', source, target)).toBe(false);
  });

  it('rejects inert comments and scripts and a fake anchor nested in an attribute', () => {
    const html = '<!-- <a href="' + good + '"> -->' +
      '<script>const sample = "<a href=' + good + '>";</script>' +
      '<style>.fake:before{content:"<a href=' + good + '>"}</style>' +
      '<template><a href="' + good + '">Example</a></template>' +
      '<title><a href="' + good + '">Title sample</title>' +
      '<div data-example="<a href=' + good + '>">Not a link</div>';
    expect(hasRealBacklink(html, source, target)).toBe(false);
  });

  it('recognizes actual href values despite quoted > and ignores a fake href in another attribute', () => {
    expect(hasRealBacklink('<a data-note="1 > 0" href="' + good + '?utm_source=ref">Real link</a>', source, target)).toBe(true);
    expect(hasRealBacklink('<a data-note=" href=' + "'"+good+"'" + '" href="https://www.healthylifesstyles.com/">Other target</a>', source, target)).toBe(false);
  });

  it('accepts apex and protocol-relative links, preserving path-specific evidence', () => {
    expect(hasRealBacklink('<a href="//healthylifesstyles.com/tools/bmi-calculator/">Body</a>', source, target)).toBe(true);
    expect(hasRealBacklink('<a href="https://healthylifesstyles.com/tools/other">Other</a>', source, target)).toBe(false);
  });

  it('rejects lookalike hosts, external links and relative links to a third-party page', () => {
    expect(hasRealBacklink('<a href="https://healthylifesstyles.com.evil.example/tools/bmi-calculator">Fake</a>', source, target)).toBe(false);
    expect(hasRealBacklink('<a href="/tools/bmi-calculator">Relative on referrer</a>', source, target)).toBe(false);
    expect(hasRealBacklink('<a href="mailto:healthylifesstyles.com@example.org">Email</a>', source, target)).toBe(false);
  });


  it('rejects noncanonical ports instead of counting a different origin as an earned link', () => {
    const spoofed = 'https://www.healthylifesstyles.com:8443/tools/bmi-calculator';
    expect(hasRealBacklink('<a href="' + spoofed + '">Wrong port</a>', source, target)).toBe(false);
    expect(() => hasRealBacklink('<a href="' + good + '">Real link</a>', source, spoofed))
      .toThrow(/targetPage host/);
    expect(hasRealBacklink('<a href="' + good + '">Real link</a>', source, target)).toBe(true);
  });

  it('throws on a missing or external target rather than marking a record lost', () => {
    expect(() => hasRealBacklink('<a href="' + good + '">Link</a>', source, '')).toThrow(/required/);
    expect(() => hasRealBacklink('<a href="' + good + '">Link</a>', source, 'https://other.example/')).toThrow(/targetPage host/);
  });
});
