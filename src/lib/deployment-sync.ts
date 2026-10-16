import type { Payload } from 'payload';
import { SITE_BASE_URL } from './site-config';
import { queueIndexNowPing } from './indexnow';
import { CMS_ORIGIN } from './allowedOrigins';

export interface ManifestRecord {
  collection: string;
  docId: string;
  updatedAt: string;
  path: string | null;
  noIndex: boolean;
}
export interface ContentManifest {
  version: number;
  source: string;
  cmsOrigin?: string;
  buildStartedAt: string;
  collections: string[];
  records: ManifestRecord[];
}
export interface PendingChange { id: number | string; collectionSlug: string; docId: string; changedAt: string }

export function acknowledgedChanges(manifest: ContentManifest, pending: PendingChange[]): PendingChange[] {
  if (manifest.version !== 1 || manifest.source !== 'cms' || !Number.isFinite(Date.parse(manifest.buildStartedAt))) return [];
  const records = new Map(manifest.records.map((r) => [`${r.collection}:${r.docId}`, r]));
  return pending.filter((entry) => {
    if (!manifest.collections.includes(entry.collectionSlug) || !Number.isFinite(Date.parse(entry.changedAt))) return false;
    const record = records.get(`${entry.collectionSlug}:${entry.docId}`);
    // A later rendered revision also includes an earlier queued edit.
    if (record) return Date.parse(record.updatedAt) >= Date.parse(entry.changedAt);
    // Removal is proven only by a complete snapshot that began after the change.
    return Date.parse(manifest.buildStartedAt) >= Date.parse(entry.changedAt);
  });
}

export async function readDeployedManifest(): Promise<ContentManifest> {
  const response = await fetch(`${SITE_BASE_URL}/content-manifest.json`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Published content manifest unavailable (${response.status}).`);
  const data = await response.json();
  const expectedOrigin = new URL(process.env.SERVER_URL || CMS_ORIGIN).origin;
  if (data.version !== 1 || data.source !== 'cms' || data.cmsOrigin !== expectedOrigin || !Array.isArray(data.collections) || !Array.isArray(data.records)) throw new Error('Published content manifest is not a build from this CMS.');
  return data as ContentManifest;
}

export async function reconcileDeployedChanges(payload: Payload): Promise<{ acknowledged: number; verified: boolean }> {
  let manifest: ContentManifest;
  try { manifest = await readDeployedManifest(); } catch { return { acknowledged: 0, verified: false }; }
  const result = await payload.find({ collection: 'pending-deploys' as any, pagination: false, depth: 0, overrideAccess: true });
  const entries = acknowledgedChanges(manifest, result.docs as unknown as PendingChange[]);
  for (const entry of entries) {
    // Match the exact entry so an edit arriving during verification is never lost.
    await payload.delete({ collection: 'pending-deploys' as any, where: { and: [{ id: { equals: entry.id } }, { changedAt: { equals: entry.changedAt } }] }, overrideAccess: true });
  }
  const keys = new Set(entries.map((e) => `${e.collectionSlug}:${e.docId}`));
  queueIndexNowPing(manifest.records.filter((r) => keys.has(`${r.collection}:${r.docId}`) && r.path && !r.noIndex).map((r) => r.path!));
  return { acknowledged: entries.length, verified: true };
}
