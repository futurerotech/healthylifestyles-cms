import type { CollectionBeforeChangeHook } from 'payload';
import { STATIC_PAGE_SLUGS, TOOL_ALIASES, SUPPORTED_TOOL_SLUGS } from './site-routes';

/** Check the actual frontend namespace, not merely a document's existence. */
export const validatePublicRoute: CollectionBeforeChangeHook = async ({ data, originalDoc, collection, req }) => {
  const doc = { ...originalDoc, ...data };
  const slug = doc.slug;
  if (!slug) throw new Error('A non-empty URL slug is required.');
  if (collection.slug === 'tools' && doc._status === 'published' && doc.enabled !== false) {
    if (TOOL_ALIASES[slug] && originalDoc?.slug !== slug) throw new Error(`This is a legacy URL. Use ${TOOL_ALIASES[slug]}.`);
    if (!SUPPORTED_TOOL_SLUGS.has(TOOL_ALIASES[slug] || slug)) throw new Error('Implement this tool on the frontend before publishing it.');
  }
  const rootPage = collection.slug === 'pages' || collection.slug === 'categories' && doc.kind === 'tool';
  if (rootPage && (STATIC_PAGE_SLUGS.has(slug) || ['tools', 'wellness-hub', 'author', 'api', 'og', 'embed', '404', 'home'].includes(slug))) throw new Error(`/${slug} is reserved by the frontend.`);
  const other = collection.slug === 'articles' ? 'categories' : collection.slug === 'pages' ? 'categories' : collection.slug === 'categories' ? doc.kind === 'section' ? 'articles' : 'pages' : null;
  if (other) {
    const where: any = { slug: { equals: slug } };
    if (other === 'categories') where.kind = { equals: collection.slug === 'articles' ? 'section' : 'tool' };
    const conflict = await req.payload.find({ collection: other as any, where, limit: 1, depth: 0, req, overrideAccess: true });
    if (conflict.totalDocs) throw new Error(`This URL is already used by ${other}. Choose another slug.`);
  }
  return data;
};
