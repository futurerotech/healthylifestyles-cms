import { NextResponse } from 'next/server';
import { authorizeSeoRequest } from '../../../../lib/seo-guard';

export const runtime = 'nodejs';
export const revalidate = 60; // stale-while-revalidate

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

  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.healthylifesstyles.com').replace(/\/$/, '');

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
    safeDocs(() => payload.find({ collection: 'tools', limit: 1000, depth: 0, sort: '-updatedAt', pagination: false }) as any),
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

  return NextResponse.json({ articles, pages, tools, total: articles.length + pages.length + tools.length });
}
