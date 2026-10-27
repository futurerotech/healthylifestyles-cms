import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { validateDraftInput, type DraftObject } from '@/lib/chatgptDraftPolicy';
import { draftBridgeAuth } from '@/lib/chatgptDraftAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 180_000;
const NO_CACHE = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
const send = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: NO_CACHE });


function gate(req: Request): NextResponse | null {
  const state = draftBridgeAuth(req.headers, process.env.CHATGPT_DRAFT_BRIDGE_TOKEN);
  if (state === 'ok') return null;
  return send({ error: state === 'unconfigured' ? 'Draft bridge is disabled.' : 'Unauthorized.' }, state === 'unconfigured' ? 503 : 401);
}

async function bodyLimited(req: Request): Promise<unknown> {
  const length = req.headers.get('content-length');
  if (length && Number(length) > MAX_BYTES) throw new Error('BODY_TOO_LARGE');
  if (!req.body) throw new Error('INVALID_BODY');
  const reader = req.body.getReader();
  const pieces: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error('BODY_TOO_LARGE');
      pieces.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const piece of pieces) { bytes.set(piece, offset); offset += piece.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error('INVALID_JSON'); }
}

const numeric = (v: unknown): number | null => typeof v === 'number' && Number.isSafeInteger(v) ? v : null;
const isPublished = (v: unknown) => v === 'published';

async function verifyRelationships(payload: Awaited<ReturnType<typeof getPayload>>, article: DraftObject): Promise<string[]> {
  const errors: string[] = [];
  const checks: Array<[string, 'tools' | 'categories' | 'authors' | 'tags' | 'articles', number]> = [
    ['category', 'categories', article.category as number],
    ['author', 'authors', article.author as number],
    ['primaryTool', 'tools', article.primaryTool as number],
    ...((article.tags as number[]) || []).map((id): [string, 'tags', number] => ['tag', 'tags', id]),
    ...((article.relatedTools as number[]) || []).map((id): [string, 'tools', number] => ['relatedTool', 'tools', id]),
    ...((article.relatedArticles as number[]) || []).map((id): [string, 'articles', number] => ['relatedArticle', 'articles', id]),
  ];
  // Concurrent reads only; never writes to related entities.
  await Promise.all(checks.map(async ([label, collection, id]) => {
    if (numeric(id) === null) { errors.push('Invalid relationship ' + label); return; }
    try {
      const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true });
      if (collection === 'categories' && (doc as { kind?: string }).kind !== 'section') errors.push('Category is not an article section.');
      if (collection === 'authors' && ((doc as { schemaType?: string }).schemaType !== 'Organization' || (doc as { slug?: string }).slug !== 'editorial-team')) errors.push('Author must be the verified HealthyLifeStyles Editorial Team.');
      if (collection === 'tools' && ((doc as { enabled?: boolean }).enabled === false || (doc as { _status?: string })._status === 'draft')) errors.push('Tool not public: ' + label);
      if (collection === 'articles' && !isPublished((doc as { _status?: string })._status)) errors.push('Related article not published.');
    } catch { errors.push('Unknown relationship: ' + label); }
  }));
  return errors;
}

export async function GET(req: Request): Promise<NextResponse> {
  const deny = gate(req);
  if (deny) return deny;
  const u = new URL(req.url);
  const kind = u.searchParams.get('kind');
  try {
    const payload = await getPayload({ config });
    if (kind === 'article') {
      const slug = u.searchParams.get('slug') || '';
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return send({ error: 'Invalid slug.' }, 400);
      const result = await payload.find({ collection: 'articles', draft: true, overrideAccess: true, depth: 0,
        where: { slug: { equals: slug } }, limit: 25 });
      return send({ matches: result.docs.map(d => ({ id: d.id, title: d.title, slug: d.slug, status: d._status })), count: result.totalDocs });
    }
    if (kind !== 'references') return send({ error: 'Invalid kind.' }, 400);
    const [tools, articles, categories, authors, tags] = await Promise.all([
      payload.find({ collection: 'tools', limit: 300, depth: 0, overrideAccess: true, where: { _status: { equals: 'published' } } }),
      payload.find({ collection: 'articles', limit: 400, depth: 0, overrideAccess: true, where: { _status: { equals: 'published' } } }),
      payload.find({ collection: 'categories', limit: 100, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'authors', limit: 100, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'tags', limit: 100, depth: 0, overrideAccess: true }),
    ]);
    return send({
      tools: tools.docs.filter(d => d.enabled !== false).map(d => ({ id: d.id, slug: d.slug, name: d.name })),
      publishedArticles: articles.docs.map(d => ({ id: d.id, slug: d.slug, title: d.title })),
      categories: categories.docs.filter(d => d.kind === 'section').map(d => ({ id: d.id, slug: d.slug, name: d.name })),
      authors: authors.docs.filter(d => d.schemaType === 'Organization').map(d => ({ id: d.id, name: d.name, slug: d.slug })),
      tags: tags.docs.map(d => ({ id: d.id, slug: d.slug, name: d.name })),
    });
  } catch { return send({ error: 'CMS references lookup failed.' }, 503); }
}

export async function POST(req: Request): Promise<NextResponse> {
  const deny = gate(req);
  if (deny) return deny;
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return send({ error: 'Expected application/json.' }, 415);
  let data: unknown;
  try { data = await bodyLimited(req); }
  catch (e) { return send({ error: (e as Error).message === 'BODY_TOO_LARGE' ? 'Article exceeds 180KB limit.' : 'Invalid JSON body.' }, 400); }
  const checked = validateDraftInput(data);
  if (!checked.ok) return send({ error: 'Draft validation failed.', details: checked.errors }, 422);
  try {
    const payload = await getPayload({ config });
    const relatedErrors = await verifyRelationships(payload, checked.data);
    if (relatedErrors.length) return send({ error: 'Relationships must reference valid existing records.', details: relatedErrors }, 422);
    const slug = checked.data.slug as string;
    const exists = await payload.find({ collection: 'articles', draft: true, overrideAccess: true, depth: 0,
      limit: 25, where: { slug: { equals: slug } } });
    if (exists.totalDocs > 0) return send({ error: 'Article already exists; no duplicate created.', existingIds: exists.docs.map(d => d.id) }, 409);
    // A second public version check covers published rows when draft joins are stale.
    const publicExists = await payload.find({ collection: 'articles', overrideAccess: true, depth: 0, limit: 25,
      where: { slug: { equals: slug } } });
    if (publicExists.totalDocs > 0) return send({ error: 'Article already exists; no duplicate created.' }, 409);
    const sameTitle = await payload.find({ collection: 'articles', draft: true, overrideAccess: true, depth: 0, limit: 25,
      where: { title: { equals: checked.data.title as string } } });
    if (sameTitle.totalDocs > 0) return send({ error: 'An article with this title already exists; no duplicate created.' }, 409);
    const created = await payload.create({ collection: 'articles', draft: true, overrideAccess: true, locale: 'en', depth: 0,
      data: checked.data as never });
    if (created._status !== 'draft') {
      // Report an unexpected state instead of claiming success or publishing.
      return send({ error: 'Unexpected article status; inspect CMS. No automatic retry.', id: created.id }, 500);
    }
    return send({ ok: true, id: created.id, slug: created.slug, status: 'draft',
      adminUrl: `https://cms.healthylifesstyles.com/admin/collections/articles/${created.id}` }, 201);
  } catch { return send({ error: 'CMS draft creation uncertain. Inspect Articles before retrying; no automatic retry.' }, 502); }
}
