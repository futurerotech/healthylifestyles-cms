/** STEP 1 audit (READ-ONLY): (a) articles missing a medical reviewer, (b) duplicate/near-duplicate tags. No writes. */
import { getPayload } from 'payload';
import config from '@payload-config';

const payload = await getPayload({ config });

// (a) All articles (drafts included), reviewer status.
const arts = await payload.find({ collection: 'articles' as never, limit: 200, depth: 0, draft: true, sort: 'id' });
console.log('=== ARTICLES ===');
for (const a of (arts as any).docs) {
  const rev = a.reviewer ? 'reviewer:SET' : 'reviewer:MISSING';
  console.log(`#${a.id} [${a._status}] ${rev} | ${a.slug}`);
}

// (b) Tags with usage counts + duplicate detection.
const tags = await payload.find({ collection: 'tags' as never, limit: 200, depth: 0, sort: 'id' });
const tagDocs = (tags as any).docs;
const counts = new Map<number | string, number>();
for (const a of (arts as any).docs) {
  for (const t of a.tags || []) {
    const id = typeof t === 'object' ? t.id : t;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
}
console.log('=== TAGS ===');
const bySlug = new Map<string, any[]>();
for (const t of tagDocs) {
  const norm = String(t.slug || t.name || '').trim().toLowerCase();
  bySlug.set(norm, [...(bySlug.get(norm) || []), t]);
  console.log(`#${t.id} "${t.name}" slug="${t.slug}" | used by ${counts.get(t.id) || 0} article(s)`);
}
console.log('=== DUPLICATE / NEAR-DUPLICATE CANDIDATES ===');
for (const [slug, list] of bySlug) {
  if (list.length > 1) console.log(`EXACT DUP slug "${slug}": ids ${list.map((t: any) => t.id).join(', ')}`);
}
// Near-duplicates: same alphanumeric skeleton (case/space/hyphen variants).
const skel = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const bySkel = new Map<string, any[]>();
for (const t of tagDocs) {
  const k = skel(String(t.name || t.slug || ''));
  bySkel.set(k, [...(bySkel.get(k) || []), t]);
}
for (const [k, list] of bySkel) {
  if (list.length > 1) console.log(`NEAR-DUP "${k}": ${list.map((t: any) => `#${t.id} "${t.name}"(${t.slug})`).join(' vs ')}`);
}
process.exit(0);
