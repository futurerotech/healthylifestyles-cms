import { NextResponse } from 'next/server';
import { authorizeSeoRequest } from '../../../../lib/seo-guard';
import { SITE_BASE_URL } from '../../../../lib/site-config';
import { publicContentPath } from '../../../../lib/site-routes';
import { readDeployedManifest } from '../../../../lib/deployment-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ContentUrl {
  id: string;
  title: string;
  url: string;
  updatedAt: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await authorizeSeoRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const payload = auth.payload;

  // HOTFIX 2: the CANONICAL origin from validated site-config — never
  // NEXT_PUBLIC_SITE_URL, which on prod is the apex domain (no www.) and put
  // all 90 scan URLs on the wrong origin (the real Permission-denied source).
  // site-config guarantees no trailing slash.
  const site = SITE_BASE_URL;
  let deployed: Set<string>;
  try { deployed = new Set((await readDeployedManifest()).records.filter((r) => r.path && !r.noIndex).map((r) => r.path!)); }
  catch { return NextResponse.json({ error: 'Deploy the frontend content manifest before scanning URLs.' }, { status: 503 }); }

  const safeDocs = async (fn: () => Promise<{ docs: unknown[] }>): Promise<Record<string, unknown>[]> => {
    try {
      return (await fn()).docs as Record<string, unknown>[];
    } catch {
      return [];
    }
  };

  const [articleDocs, pageDocs, toolDocs] = await Promise.all([
    safeDocs(() => payload.find({ collection: 'articles', where: { _status: { equals: 'published' } }, limit: 1000, depth: 0, sort: '-updatedAt', pagination: false }) as any),
    safeDocs(() => payload.find({ collection: 'pages', where: { _status: { equals: 'published' } }, limit: 1000, depth: 0, sort: '-updatedAt', pagination: false }) as any),
    safeDocs(() => payload.find({ collection: 'tools', where: { _status: { equals: 'published' }, enabled: { equals: true } }, limit: 1000, depth: 0, sort: '-updatedAt', pagination: false }) as any),
  ]);

  const articles: ContentUrl[] = articleDocs
    .filter((d) => str(d.slug))
    .map((d) => ({ id: str(d.id), title: str(d.title), url: `${site}/wellness-hub/${str(d.slug)}`, updatedAt: str(d.updatedAt) }));
  const pages: ContentUrl[] = pageDocs
    .filter((d) => str(d.slug))
    .map((d) => ({ id: str(d.id), title: str(d.title), url: `${site}/${str(d.slug)}`, updatedAt: str(d.updatedAt) }));
  const tools: ContentUrl[] = toolDocs
    .filter((d) => str(d.slug))
    .map((d) => ({ id: str(d.id), title: str(d.name), url: `${site}/tools/${str(d.slug)}`, updatedAt: str(d.updatedAt) }));

  const live = (items: ContentUrl[], collection: string) => [...new Map(items.map((item) => {
    const slug = new URL(item.url).pathname.split('/').pop();
    const path = publicContentPath(collection, { slug });
    return [path, { ...item, url: `${site}${path}` }] as const;
  }).filter(([path]) => path && deployed.has(path))).values()];
  const catalogue = { articles: live(articles, 'articles'), pages: live(pages, 'pages'), tools: live(tools, 'tools') };
  return NextResponse.json({ ...catalogue, total: Object.values(catalogue).reduce((n, list) => n + list.length, 0) });
}
