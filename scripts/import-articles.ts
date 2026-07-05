/**
 * Import AI-drafted articles from scripts/articles-batch.json into the
 * `articles` collection as DRAFTS (never published — a human reviews first).
 *
 *   npx payload run scripts/import-articles.ts
 *
 * Maps the writing schema to the CMS shape:
 *  - layoutBlocks → layout blocks (paragraph/heading→text, list→list,
 *    table→table with {cells} rows, toolEmbed→toolEmbed with resolved tool id,
 *    disclaimer→callout)
 *  - category/author/reviewer/primaryTool/relatedTools slugs → relation ids
 *  - seo + og/twitter fields → the seo group (noIndex casing handled)
 * Idempotent: skips any article whose slug already exists.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '@payload-config';

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level?: number; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'toolEmbed'; toolSlug: string }
  | { type: 'disclaimer'; text: string };

const batch = JSON.parse(readFileSync(path.resolve(process.cwd(), 'scripts/articles-batch.json'), 'utf8')) as any[];
const payload = await getPayload({ config });

/* ---- resolve relation ids by slug ---- */
const find = async (collection: string, where: unknown) =>
  ((await payload.find({ collection: collection as never, where: where as never, limit: 200, depth: 0 })) as any).docs;

const authors = await find('authors', {});
const authorId = (slug: string) => authors.find((a: any) => a.slug === slug)?.id;

const cats = await find('categories', { kind: { equals: 'section' } });
const catId = (slug: string) => cats.find((c: any) => c.slug === slug)?.id;

const toolSlugs = [...new Set(batch.flatMap((a) => [a.primaryTool, ...(a.relatedTools || []), ...a.layoutBlocks.filter((b: Block) => b.type === 'toolEmbed').map((b: any) => b.toolSlug)]))];
const tools = await find('tools', { slug: { in: toolSlugs.join(',') } });
const toolId = (slug: string) => tools.find((t: any) => t.slug === slug)?.id;

/* ---- block mapping ---- */
function mapBlocks(blocks: Block[], articleTitle: string) {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'paragraph':
          return { blockType: 'text', style: 'p', text: b.text };
        case 'heading':
          return { blockType: 'text', style: b.level === 3 ? 'h3' : 'h2', text: b.text };
        case 'list':
          return { blockType: 'list', style: b.ordered ? 'ordered' : 'unordered', items: b.items.map((text) => ({ text })) };
        case 'table':
          return { blockType: 'table', caption: '', headers: b.headers, rows: b.rows.map((cells) => ({ cells })) };
        case 'toolEmbed': {
          const id = toolId(b.toolSlug);
          if (!id) {
            console.warn(`  [${articleTitle}] toolEmbed skipped — unknown slug "${b.toolSlug}"`);
            return null;
          }
          return { blockType: 'toolEmbed', tool: id, label: '' };
        }
        case 'disclaimer':
          return { blockType: 'callout', tone: 'info', title: 'Medical disclaimer', text: b.text };
        default:
          console.warn(`  [${articleTitle}] unknown block type skipped:`, (b as any).type);
          return null;
      }
    })
    .filter(Boolean);
}

/* ---- import ---- */
let created = 0;
let skipped = 0;
for (const a of batch) {
  const slug = a.seo.slug;
  const existing = await payload.find({ collection: 'articles' as never, where: { slug: { equals: slug } } as never, limit: 1, depth: 0, draft: true });
  if ((existing as any).totalDocs > 0) {
    console.log(`skip (exists): ${slug}`);
    skipped++;
    continue;
  }

  const category = catId(a.category);
  const author = authorId(a.author);
  if (!category || !author) throw new Error(`Missing relation for ${slug}: category=${category} author=${author}`);

  const doc = await payload.create({
    collection: 'articles' as never,
    draft: true, // saved as a draft version…
    data: {
      _status: 'draft', // …and never marked published
      title: a.title,
      slug,
      excerpt: a.excerpt,
      category,
      author,
      ...(a.reviewer ? { reviewer: authorId(a.reviewer) } : {}),
      featured: false,
      primaryTool: toolId(a.primaryTool) ?? undefined,
      relatedTools: (a.relatedTools || []).map(toolId).filter(Boolean),
      layout: mapBlocks(a.layoutBlocks, a.title),
      faq: a.faq,
      sources: a.sources,
      semanticEntities: a.semanticEntities,
      seo: {
        metaTitle: a.seo.metaTitle,
        metaDescription: a.seo.metaDescription,
        canonical: a.seo.canonical || '',
        noIndex: Boolean(a.seo.noindex),
        keywords: a.seo.keywords,
        ogTitle: a.ogTitle,
        ogDescription: a.ogDescription,
        twitterTitle: a.twitterTitle,
        twitterDescription: a.twitterDescription,
      },
      aiGenerated: true,
      reviewedByHuman: false,
    } as never,
  });
  console.log(`created DRAFT: ${slug} → /admin/collections/articles/${(doc as any).id} (_status=${(doc as any)._status})`);
  created++;
}
console.log(`done — ${created} created, ${skipped} skipped`);
process.exit(0);
