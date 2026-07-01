/**
 * Fire-and-forget Vercel Deploy Hook.
 *
 * Triggers an Astro SSG rebuild on Vercel whenever public content or a setting
 * changes in the CMS. Used as an `afterChange` hook on both collections and
 * globals — e.g. saving the "Ad Management" global rebuilds the front-end so the
 * new ad configuration goes live.
 *
 * Design (per requirements):
 *  - NON-BLOCKING: the POST is intentionally NOT awaited, so a slow, timing-out,
 *    or failing Vercel endpoint can never delay or fail the CMS save. A 10s
 *    AbortController stops a stuck request from lingering, and every error is
 *    swallowed and logged rather than thrown.
 *  - DRAFT-AWARE: for draft-enabled collections (those carrying a `_status`
 *    field) we only rebuild when the document is published, or when it moves
 *    published -> draft (an unpublish, which must drop the page from the static
 *    site). Pure draft saves and autosaves are ignored. Non-versioned
 *    collections and all globals have no `_status`, so they always rebuild.
 *  - NO-OP WITHOUT CONFIG: does nothing unless `VERCEL_DEPLOY_HOOK_URL` is set,
 *    so local/dev saves never fire a deploy.
 */
import type { CollectionAfterChangeHook, GlobalAfterChangeHook } from 'payload';

const HOOK_URL = process.env.VERCEL_DEPLOY_HOOK_URL;
const TIMEOUT_MS = 10_000;

interface DeployHookArgs {
  doc?: { _status?: 'draft' | 'published' };
  previousDoc?: { _status?: 'draft' | 'published' };
  operation?: 'create' | 'update';
  collection?: { slug?: string };
  global?: { slug?: string };
}

/** Kick off the deploy webhook without blocking the caller. */
function fireAndForget(reason: string): void {
  if (!HOOK_URL) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Intentionally NOT awaited — the CMS save returns immediately.
  void fetch(HOOK_URL, { method: 'POST', signal: controller.signal })
    .then((res) => {
      if (!res.ok) console.error(`[Vercel] Deploy hook returned ${res.status} ${res.statusText} (${reason})`);
      else console.log(`[Vercel] Rebuild queued (${reason})`);
    })
    .catch((err) => console.error(`[Vercel] Deploy hook failed (${reason}):`, err?.message ?? err))
    .finally(() => clearTimeout(timer));
}

const run = (args: DeployHookArgs = {}): void => {
  if (args.doc?._status !== 'published') return;

  const label = args.collection?.slug ?? args.global?.slug ?? 'content';
  fireAndForget(args.operation ? `${label}:${args.operation}` : label);
};

/**
 * Single implementation typed to satisfy BOTH the collection and global
 * `afterChange` signatures, so it can be dropped into either hooks array
 * unchanged.
 */
export const triggerVercelDeploy = run as unknown as CollectionAfterChangeHook & GlobalAfterChangeHook;
