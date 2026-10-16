import contract from './site-contract.json' with { type: 'json' };

/** Mirrored in the CMS; contract tests prevent independent routing rules. */
export const SITE_ORIGIN = contract.origin;
export const STATIC_PAGE_SLUGS = new Set(contract.staticPages);
export const SUPPORTED_TOOL_SLUGS = new Set(contract.tools);
export const TOOL_ALIASES: Record<string, string> = contract.toolAliases;

export function canonicalToolSlug(slug: string): string {
  return TOOL_ALIASES[slug] ?? slug;
}

export function toolPath(slug: string): string {
  return `/tools/${canonicalToolSlug(slug)}`;
}

export function articlePath(slug: string): string {
  return `/wellness-hub/${slug}`;
}

export function categoryPath(slug: string, kind: string): string {
  return kind === 'section' ? articlePath(slug) : `/${slug}`;
}

/** Normalize legacy links, preserving query strings and fragments. */
export function normalizeInternalHref(href: string): string {
  let url: URL;
  try { url = new URL(href, SITE_ORIGIN); } catch { return href; }
  if (url.origin !== SITE_ORIGIN) return href;
  const match = url.pathname.match(/^\/tools\/([^/]+)\/?$/);
  if (match && TOOL_ALIASES[match[1]]) {
    return `${toolPath(match[1])}${url.search}${url.hash}`;
  }
  return href;
}

export function publicContentPath(collection: string, doc: { slug?: unknown; kind?: unknown }): string | null {
  const slug = typeof doc.slug === 'string' ? doc.slug : '';
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null;
  switch (collection) {
    case 'tools': return SUPPORTED_TOOL_SLUGS.has(canonicalToolSlug(slug)) ? toolPath(slug) : null;
    case 'articles': return articlePath(slug);
    case 'pages': return `/${slug}`;
    case 'categories': return categoryPath(slug, String(doc.kind));
    case 'authors': return `/author/${slug}`;
    case 'tags': return `/wellness-hub/tag/${slug}`;
    case 'pseo-pages': return `/tools/pseo/${slug}`;
    default: return null;
  }
}

export function assertUniquePublicPaths(entries: { collection: string; slug: string; kind?: string }[]): void {
  const seen = new Set([...STATIC_PAGE_SLUGS].map((s) => s === 'index' ? '/' : `/${s}`));
  seen.add('/tools'); seen.add('/wellness-hub');
  for (const entry of entries) {
    const path = publicContentPath(entry.collection, entry);
    if (!path) throw new Error(`Invalid public route: ${entry.collection}/${entry.slug}`);
    if (seen.has(path)) throw new Error(`Duplicate public route: ${path}`);
    seen.add(path);
  }
}
