/**
 * Idempotent external-link fixer for article content (PHASE 2a / 2b).
 *
 *   OLD_URL="https://old" NEW_URL="https://new" npx payload run scripts/seo/fix-external-link.ts
 *   # dry run (report matches, write nothing):
 *   OLD_URL="https://old" NEW_URL="https://new" DRY=1 npx payload run scripts/seo/fix-external-link.ts
 *
 * Article bodies are stored as a `layout` blocks array; prose lives in text
 * blocks whose `text` field holds Markdown (links are `[label](url)`). URLs may
 * also appear in `sources`, `faq` and `excerpt`. This walks every PUBLISHED
 * article, string-replaces OLD_URL -> NEW_URL across those content fields, and
 * republishes ONLY the articles that actually changed.
 *
 * Safety:
 *  - Reads OLD_URL / NEW_URL and the DB connection from process.env only — no
 *    secrets or connection strings are ever hardcoded.
 *  - Idempotent: a run that matches nothing writes nothing (0 changes, exit 0).
 *  - Republishes with `_status: 'published'` so the fix goes live, and only
 *    touches the content fields (relationships are left untouched).
 */
import { getPayload } from 'payload';
import config from '@payload-config';

const OLD_URL = process.env.OLD_URL ?? '';
const NEW_URL = process.env.NEW_URL ?? '';
const DRY = process.env.DRY === '1' || process.env.DRY === 'true';

if (!OLD_URL || !NEW_URL) {
  console.error('Set OLD_URL and NEW_URL, e.g.\n  OLD_URL="https://a" NEW_URL="https://b" npx payload run scripts/seo/fix-external-link.ts');
  process.exit(1);
}

/** Recursively replace every occurrence of `oldU` with `newU` in string leaves. */
function deepReplace<T>(value: T, oldU: string, newU: string): [T, number] {
  let count = 0;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      if (!v.includes(oldU)) return v;
      count += v.split(oldU).length - 1;
      return v.split(oldU).join(newU);
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>)) out[k] = walk((v as Record<string, unknown>)[k]);
      return out;
    }
    return v;
  };
  return [walk(value) as T, count];
}

const CONTENT_FIELDS = ['layout', 'faq', 'sources', 'excerpt', 'semanticEntities'] as const;

const payload = await getPayload({ config });

const { docs } = await payload.find({
  collection: 'articles' as never,
  where: { _status: { equals: 'published' } } as never,
  limit: 1000,
  depth: 0,
});

let changedDocs = 0;
let totalReplacements = 0;

for (const article of docs as Array<Record<string, unknown>>) {
  const data: Record<string, unknown> = {};
  let docCount = 0;

  for (const field of CONTENT_FIELDS) {
    if (article[field] == null) continue;
    const [replaced, count] = deepReplace(article[field], OLD_URL, NEW_URL);
    if (count > 0) {
      data[field] = replaced;
      docCount += count;
    }
  }

  if (docCount === 0) continue;

  changedDocs++;
  totalReplacements += docCount;
  const slug = String(article.slug ?? article.id);

  if (DRY) {
    console.log(`[dry] ${slug}: ${docCount} occurrence(s) would be replaced`);
    continue;
  }

  data._status = 'published'; // republish so the fix goes live
  await payload.update({ collection: 'articles' as never, id: article.id as never, data: data as never });
  console.log(`fixed  ${slug}: ${docCount} occurrence(s) replaced and republished`);
}

console.log(
  `\n${DRY ? '[dry] ' : ''}done — ${totalReplacements} replacement(s) across ${changedDocs} article(s) ` +
    `(scanned ${docs.length} published).`,
);
process.exit(0);
