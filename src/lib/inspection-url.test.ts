/** HOTFIX 2 — unit fixtures for the inspection-URL boundary (H2-TASK 1). */
import { describe, it, expect } from 'vitest';
import { toAbsoluteInspectionUrl, LocalValidationError } from './inspection-url';

const ORIGIN = 'https://www.healthylifesstyles.com';

describe('toAbsoluteInspectionUrl', () => {
  it('resolves a relative path against the canonical origin', () => {
    expect(toAbsoluteInspectionUrl('/wellness-hub/some-article', ORIGIN)).toBe(
      'https://www.healthylifesstyles.com/wellness-hub/some-article',
    );
  });

  it('passes through an absolute URL on the canonical origin', () => {
    expect(toAbsoluteInspectionUrl('https://www.healthylifesstyles.com/tools/bmi-calculator', ORIGIN)).toBe(
      'https://www.healthylifesstyles.com/tools/bmi-calculator',
    );
  });

  it('keeps a trailing-slash variant intact (no silent slash edits)', () => {
    expect(toAbsoluteInspectionUrl('https://www.healthylifesstyles.com/', ORIGIN)).toBe(
      'https://www.healthylifesstyles.com/',
    );
  });

  it('rewrites the APEX host to the canonical www host (the live bug class)', () => {
    expect(toAbsoluteInspectionUrl('https://healthylifesstyles.com/wellness-hub/x', ORIGIN)).toBe(
      'https://www.healthylifesstyles.com/wellness-hub/x',
    );
  });

  it('throws a typed error on a foreign origin (cms. subdomain), naming it', () => {
    expect(() => toAbsoluteInspectionUrl('https://cms.healthylifesstyles.com/admin', ORIGIN)).toThrowError(
      LocalValidationError,
    );
    expect(() => toAbsoluteInspectionUrl('https://cms.healthylifesstyles.com/admin', ORIGIN)).toThrowError(
      /cms\.healthylifesstyles\.com/,
    );
  });

  it('throws a typed error on http:// (protocol downgrade)', () => {
    expect(() => toAbsoluteInspectionUrl('http://www.healthylifesstyles.com/x', ORIGIN)).toThrowError(
      LocalValidationError,
    );
  });

  it('throws a typed error on empty input', () => {
    expect(() => toAbsoluteInspectionUrl('   ', ORIGIN)).toThrowError(LocalValidationError);
  });

  it('throws a typed error on malformed input', () => {
    expect(() => toAbsoluteInspectionUrl('not a url', ORIGIN)).toThrowError(LocalValidationError);
  });

  it('collapses duplicate slashes and drops fragments', () => {
    expect(toAbsoluteInspectionUrl('https://www.healthylifesstyles.com//tools//bmi#frag', ORIGIN)).toBe(
      'https://www.healthylifesstyles.com/tools/bmi',
    );
  });
});
