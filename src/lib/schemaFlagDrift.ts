/**
 * Phase 11 — shared, READ-ONLY schema-flag drift computation.
 *
 * Compares the stored `isHowTo` / `isHealthTopic` booleans on PUBLISHED
 * articles against what the current heuristics (src/lib/schemaFlags.ts) would
 * derive. Used by the reconciliation script (scripts/seo/reconcile-schema-flags.ts),
 * the dashboard drift panel's API route, and the weekly cron endpoint — one
 * implementation, so the three surfaces can never disagree.
 *
 * NEVER writes: drift is a signal for a human (a mismatch may be a missed flag
 * OR a deliberate editor override — indistinguishable to a machine).
 */
import type { Payload } from 'payload';
import { computeIsHowTo, computeIsHealthTopic } from './schemaFlags';

export interface DriftRow {
  slug: string;
  id: number | string;
  title: string;
  field: 'isHowTo' | 'isHealthTopic';
  stored: boolean;
  heuristic: boolean;
  reading: string;
}

export interface DriftReport {
  scanned: number;
  drift: DriftRow[];
}

export async function computeSchemaFlagDrift(payload: Payload): Promise<DriftReport> {
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
        title: String(a.title ?? a.slug ?? a.id),
        field,
        stored,
        heuristic,
        reading: heuristic
          ? 'heuristic suggests ON — missed flag, or a deliberate editor opt-OUT'
          : 'stored ON without heuristic support — deliberate editor opt-IN, or a stale flag',
      });
    }
  }

  return { scanned: docs.length, drift };
}
