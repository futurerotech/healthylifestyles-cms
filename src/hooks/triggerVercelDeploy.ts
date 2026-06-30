/**
 * Fire-and-forget Vercel deploy webhook.
 *
 * After any content change in the CMS, this triggers an Astro SSG rebuild via a
 * Vercel Deploy Hook URL. The POST is fire-and-forget — errors are logged but
 * never thrown, so the CMS save operation is never blocked.
 */

const HOOK_URL = process.env.VERCEL_DEPLOY_HOOK_URL;

export async function triggerVercelDeploy(): Promise<void> {
  if (!HOOK_URL) return;

  try {
    const res = await fetch(HOOK_URL, { method: 'POST' });
    if (!res.ok) {
      console.error(`[Vercel] Deploy hook returned ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error('[Vercel] Deploy hook failed:', err);
  }
}
