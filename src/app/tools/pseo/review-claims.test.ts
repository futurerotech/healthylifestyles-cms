// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// pSEO pages have no assigned medical reviewer. Their structured data must not
// claim one, and must not present an update timestamp as a review date.
const source = readFileSync(resolve(process.cwd(), 'src/app/tools/pseo/[slug]/page.tsx'), 'utf8');

describe('pSEO structured data makes no medical-review claim', () => {
  it('emits no reviewedBy or lastReviewed', () => {
    expect(source).not.toMatch(/reviewedBy\s*:/);
    expect(source).not.toMatch(/lastReviewed\s*:/);
    expect(source).not.toMatch(/Medical Review (Team|Board)/i);
  });

  it('keeps the MedicalWebPage, publisher and breadcrumb', () => {
    expect(source).toMatch(/'@type': 'MedicalWebPage'/);
    expect(source).toMatch(/publisher:/);
    expect(source).toMatch(/'@type': 'BreadcrumbList'/);
  });
});
