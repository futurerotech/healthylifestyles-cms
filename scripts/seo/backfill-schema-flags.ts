/**
 * backfill-schema-flags.ts  (Phase 8)
 *
 *   DRY=1 npx payload run scripts/seo/backfill-schema-flags.ts   # preview
 *   npx payload run scripts/seo/backfill-schema-flags.ts         # apply
 *
 * One-time seed of the new `isHowTo` / `isHealthTopic` booleans on existing
 * published articles, using the SAME heuristics the Astro frontend used before
 * Phase 8 (kept here as the seed so the render path can stop relying on them).
 * After this runs, the CMS booleans are authoritative for existing content.
 *
 * PREREQUISITE: the phase8_schema_flags migration must already be applied to the
 * target DB (it ships on the CMS deploy) — otherwise the columns don't exist yet.
 * Idempotent: only updates docs whose stored flags differ from the computed
 * value; a second run makes 0 changes. Republishes changed docs. Reads the DB
 * connection from process.env only.
 */
import { getPayload } from 'payload';
import config from '@payload-config';

type Block = { blockType?: string; style?: string; text?: string };

/** title starts with "how to", or a body heading looks like "Step 1 …". */
function computeIsHowTo(a: { title?: string; layout?: Block[] }): boolean {
  if (/^how\s+to\b/i.test(a.title || '')) return true;
  return (a.layout || []).some(
    (b) => b.blockType === 'text' && b.style === 'h2' && /^step\s+\d/i.test(b.text || ''),
  );
}

/** "what is …", "how do you know …", or signs/symptoms/explained/guide in the title. */
function computeIsHealthTopic(a: { title?: string }): boolean {
  const t = a.title || '';
  return (
    /^what is\b/i.test(t) ||
    /^how do you know\b/i.test(t) ||
    /\b(signs|symptoms|explained|guide)\b/i.test(t)
  );
}

const DRY = process.env.DRY === '1' || process.env.DRY === 'true';

const payload = await getPayload({ config });

const { docs } = await payload.find({
  collection: 'articles' as never,
  where: { _status: { equals: 'published' } } as never,
  limit: 1000,
  depth: 0,
});

let changed = 0;
for (const article of docs as Array<Record<string, unknown>>) {
  const a = article as { id: unknown; slug?: string; title?: string; layout?: Block[]; isHowTo?: boolean; isHealthTopic?: boolean };
  const isHowTo = computeIsHowTo(a);
  const isHealthTopic = computeIsHealthTopic(a);

  if (Boolean(a.isHowTo) === isHowTo && Boolean(a.isHealthTopic) === isHealthTopic) continue;

  changed++;
  const slug = String(a.slug ?? a.id);
  if (DRY) {
    console.log(`[dry] ${slug}: isHowTo ${Boolean(a.isHowTo)}→${isHowTo}, isHealthTopic ${Boolean(a.isHealthTopic)}→${isHealthTopic}`);
    continue;
  }
  await payload.update({
    collection: 'articles' as never,
    id: a.id as never,
    data: { isHowTo, isHealthTopic, _status: 'published' } as never,
  });
  console.log(`set  ${slug}: isHowTo=${isHowTo}, isHealthTopic=${isHealthTopic}`);
}

console.log(`\n${DRY ? '[dry] ' : ''}done — ${changed} article(s) ${DRY ? 'would change' : 'updated'} (scanned ${docs.length} published).`);
process.exit(0);
