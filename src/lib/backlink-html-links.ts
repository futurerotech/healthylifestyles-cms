/**
 * Backlink evidence must be an active anchor to the recorded target page.
 * A bare domain mention, an HTML comment, or a quoted data attribute is not
 * an earned backlink. This is a pure HTML check; network URL safety is
 * handled separately by the caller's outbound-request policy.
 */
const inertElements = /<(script|style|template|noscript|textarea|title)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>/gi;
const openingTags = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const attributes = /\s+([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'\x60=<>]+)))?/g;

function anchorHref(tag: string): string | null {
  if (!/^<a(?=[\s/>])/i.test(tag)) return null;
  for (const match of tag.slice(2, -1).matchAll(attributes)) {
    if (match[1].toLowerCase() === 'href') return match[2] ?? match[3] ?? match[4] ?? null;
  }
  return null;
}

function normalizedPath(path: string): string {
  return path.replace(/\/+$/, '') || '/';
}

export function hasRealBacklink(
  html: string,
  sourceUrl: string,
  targetPage: string,
  siteUrl = process.env.SITE_BASE_URL || 'https://www.healthylifesstyles.com',
): boolean {
  if (!targetPage?.trim()) throw new TypeError('Backlink targetPage is required');
  const site = new URL(siteUrl);
  const source = new URL(sourceUrl);
  const expected = new URL(targetPage, site);
  const apex = site.hostname.replace(/^www\./i, '');
  const allowedHosts = new Set([apex, 'www.' + apex]);
  const isSiteUrl = (url: URL): boolean =>
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    !url.username && !url.password &&
    allowedHosts.has(url.hostname);

  // Malformed or cross-site target configuration is inconclusive; the caller
  // catches this and preserves the backlink's current live/lost state.
  if (!isSiteUrl(expected)) throw new TypeError('Invalid backlink targetPage host');
  const expectedPath = normalizedPath(expected.pathname);
  const active = html.replace(/<!--[\s\S]*?-->/g, '').replace(inertElements, '');

  for (const match of active.matchAll(openingTags)) {
    const href = anchorHref(match[0]);
    if (!href) continue;
    try {
      const url = new URL(href, source);
      if (isSiteUrl(url) && normalizedPath(url.pathname) === expectedPath) return true;
    } catch {
      // Ignore malformed href; it is not proof of a backlink.
    }
  }
  return false;
}
