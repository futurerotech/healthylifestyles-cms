/* ---------------------------------------------------------------------------
 * Programmatic SEO (pSEO) engine
 *
 * CSV parsing, template rendering, slug generation, and batch page creation.
 * ------------------------------------------------------------------------- */

export interface CsvRow {
  [column: string]: string;
}

export interface PseoTemplate {
  headlineTemplate: string;
  subheadlineTemplate?: string | null;
  bodyTemplate: string;
  ctaTemplate?: string | null;
  ctaLink?: string | null;
  metaTitleTemplate: string;
  metaDescTemplate: string;
  h1Template?: string | null;
  slugTemplate: string;
}

/* -------------------------------------------------------------------------- */
/*  CSV parsing                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Parse raw CSV text into header + rows.
 * Handles quoted fields with commas and newlines.
 */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    if (vals.length === 0) continue;
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = (vals[idx] || '').trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Template rendering                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Replace {{variable}} placeholders with row data.
 * Supports optional filters: {{var|slugify}}, {{var|uppercase}}, {{var|lowercase}}, {{var|year}}.
 */
export function renderTemplate(template: string, vars: CsvRow): string {
  return template.replace(/\{\{(\w+)(\|(\w+))?\}\}/g, (match, key: string, _, filter: string) => {
    let val = vars[key] !== undefined ? vars[key] : match;
    if (filter === 'slugify') val = slugify(val);
    else if (filter === 'uppercase') val = val.toUpperCase();
    else if (filter === 'lowercase') val = val.toLowerCase();
    else if (filter === 'year') val = String(new Date().getFullYear());
    return val;
  });
}

/* -------------------------------------------------------------------------- */
/*  Slug generation                                                           */
/* -------------------------------------------------------------------------- */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function generateSlug(slugTemplate: string, vars: CsvRow): string {
  const raw = renderTemplate(slugTemplate, vars);
  return slugify(raw);
}

/* -------------------------------------------------------------------------- */
/*  Full page generation                                                      */
/* -------------------------------------------------------------------------- */

export interface GeneratedPage {
  slug: string;
  keyword: string;
  variables: CsvRow;
  headline: string;
  subheadline: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  metaTitle: string;
  metaDescription: string;
}

export function generatePage(template: PseoTemplate, row: CsvRow): GeneratedPage {
  const slug = generateSlug(template.slugTemplate, row);
  const keyword = row.keyword || row.Keyword || row.Keyword || '';

  return {
    slug,
    keyword,
    variables: row,
    headline: renderTemplate(template.headlineTemplate, row),
    subheadline: template.subheadlineTemplate ? renderTemplate(template.subheadlineTemplate, row) : '',
    bodyHtml: renderTemplate(template.bodyTemplate, row),
    ctaText: template.ctaTemplate ? renderTemplate(template.ctaTemplate, row) : '',
    ctaUrl: template.ctaLink ? renderTemplate(template.ctaLink, row).replace('{{slug}}', slug) : '',
    metaTitle: renderTemplate(template.metaTitleTemplate, row),
    metaDescription: renderTemplate(template.metaDescTemplate, row),
  };
}

export function generateAllPages(template: PseoTemplate, rows: CsvRow[]): GeneratedPage[] {
  return rows.map((row) => generatePage(template, row));
}
