/**
 * reconcile-schema-flags.ts  (Phase 10, Priority 2)
 *
 *   npm run audit:schema-flags
 *   JSON=1 npx payload run scripts/seo/reconcile-schema-flags.ts   # machine output
 *   STRICT=1 npx payload run scripts/seo/reconcile-schema-flags.ts # exit 1 on drift
 *
 * READ-ONLY drift report between the stored `isHowTo` / `isHealthTopic` flags
 * on published articles and what the current heuristics (src/lib/schemaFlags.ts)
 * would derive. It NEVER writes — a mismatch is a signal for a human, not a bug
 * to auto-fix, because drift has two legitimate causes that look identical to
 * a machine:
 *
 *   heuristic ON  / stored OFF → a missed flag … or a deliberate editor OPT-OUT
 *   heuristic OFF / stored ON  → a stale flag  … or a deliberate editor OPT-IN
 *
 * Auto-overwriting would destroy explicit human overrides, so this only reports.
 * Cron-ready: exit 0 always (report-only) unless STRICT=1 and drift exists.
 * DB connection comes from process.env only.
 */
import { getPayload } from 'payload';
import config from '@payload-config';
import { computeIsHowTo, computeIsHealthTopic } from '../../src/lib/schemaFlags';

const JSON_OUT = process.env.JSON === '1' || process.env.JSON === 'true';
const STRICT = process.env.STRICT === '1' || process.env.STRICT === 'true';

interface DriftRow {
  slug: string;
  id: number | string;
  field: 'isHowTo' | 'isHealthTopic';
  stored: boolean;
  heuristic: boolean;
  reading: string;
}

const payload = await getPayload({ config });

const { docs } = await payload.find({
  collection: 'articles' as never,
  where: { _status: { equals: 'published' } } as never,
  limit: 1000,
  depth: 0,
});

const drift: DriftRow[] = [];
for (const doc of docs as Array<Record<string, unknown>>) {
  const a = doc as {
    id: number | string; slug?: string; title?: string;
    layout?: unknown[]; semanticEntities?: unknown[];
    isHowTo?: boolean; isHealthTopic?: boolean;
  };
  const checks: Array<[DriftRow['field'], boolean, boolean]> = [
    ['isHowTo', Boolean(a.isHowTo), computeIsHowTo(a.title, a.layout)],
    ['isHealthTopic', Boolean(a.isHealthTopic), computeIsHealthTopic(a.title, a.semanticEntities)],
  ];
  for (const [field, stored, heuristic] of checks) {
    if (stored === heuristic) continue;
    drift.push({
      slug: String(a.slug ?? a.id),
      id: a.id,
      field,
      stored,
      heuristic,
      reading: heuristic
        ? 'heuristic suggests ON — missed flag, or a deliberate editor opt-OUT'
        : 'stored ON without heuristic support — deliberate editor opt-IN, or a stale flag',
    });
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ scanned: docs.length, driftCount: drift.length, drift }, null, 2));
} else {
  console.log('Schema-flag reconciliation (read-only — never writes)');
  console.log('====================================================');
  console.log(`Published articles scanned: ${docs.length}`);
  if (drift.length === 0) {
    console.log('No drift: stored flags match the current heuristics everywhere.');
  } else {
    console.log(`DRIFT on ${drift.length} flag(s):\n`);
    for (const d of drift) {
      console.log(`  ${d.slug} · ${d.field}: stored=${d.stored} heuristic=${d.heuristic}`);
      console.log(`    → ${d.reading}`);
      console.log(`    review: /admin/collections/articles/${d.id}`);
    }
    console.log('\nNothing was changed. Review each item in the admin and set the flag deliberately.');
  }
}

process.exit(STRICT && drift.length > 0 ? 1 : 0);
