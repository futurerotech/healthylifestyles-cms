/**
 * VERSION-TABLE RESEED — fixes "No Results" in the admin for drafts-enabled
 * collections whose _v version tables are empty.
 *
 * Root cause (2026-07-15 diagnosis): _articles_v/_tools_v were empty in
 * production all along (verified in BOTH Supabase dumps, Jul 12 + Jul 14 —
 * Neon inherited the emptiness faithfully). Payload's admin list and every
 * draft=true read are served FROM the version tables, so published content is
 * invisible there while the public API (base tables) works perfectly.
 *
 * Repair mechanism — proven empirically: every payload.update() creates a
 * correct latest=true version row (full block trees + locales). The 11+5 rows
 * on the local DB are exactly the docs Phase-17 updated. So: one no-op update
 * per version-less document, via the official Local API. No SQL, no schema
 * changes, no migrations. Idempotent: docs that already have a latest version
 * are skipped.
 *
 * Hook safety (verified): push + IndexNow hooks fire only on draft→published
 * transitions (no-ops here); trackPendingChange dedupes one pending-deploy row
 * per doc (drain with the deploy button afterwards).
 *
 * Usage:  npx payload run scripts/recovery/reseed-versions.ts            # dry-run
 *         npx payload run scripts/recovery/reseed-versions.ts -- --apply # write
 */
import { getPayload } from 'payload';
import configPromise from '@payload-config';

const APPLY = process.argv.includes('--apply') || process.env.APPLY === 'true';
const COLLECTIONS = ['articles', 'tools', 'pages'] as const;

async function main(): Promise<void> {
  const payload = await getPayload({ config: configPromise });
  let created = 0, skipped = 0, failed = 0;

  for (const collection of COLLECTIONS) {
    const docs = await payload.find({
      collection, limit: 1000, depth: 0, draft: false,
      locale: 'en', overrideAccess: true,
    });
    console.log(`[INFO] ${collection}: ${docs.totalDocs} published doc(s)`);

    for (const doc of docs.docs) {
      const label = `${collection}/${doc.id} (${(doc as { slug?: string }).slug ?? ''})`;
      try {
        const existing = await payload.findVersions({
          collection,
          where: { and: [{ parent: { equals: doc.id } }, { latest: { equals: true } }] },
          limit: 1, depth: 0,
        });
        if (existing.totalDocs > 0) { skipped++; continue; }
        if (!APPLY) { console.log(`[INFO] DRY-RUN would reseed version: ${label}`); created++; continue; }
        await payload.update({
          collection, id: doc.id, data: {}, draft: false, depth: 0,
          locale: 'en', overrideAccess: true, context: { reseedVersions: true },
        });
        console.log(`[SUCCESS] reseeded ${label}`);
        created++;
      } catch (e) {
        failed++;
        console.error(`[ERROR] ${label}: ${(e as Error).message}`);
      }
    }
  }
  console.log(`[SUMMARY] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} reseeded=${created} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

const isDirect = process.argv.some((a) => a.replace(/\\/g, '/').includes('reseed-versions')) || process.env.RUN_RESEED === 'true';
if (isDirect) {
  await main();
}
