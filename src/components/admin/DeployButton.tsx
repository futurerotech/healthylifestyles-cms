'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, toast, useAuth } from '@payloadcms/ui';

/**
 * Admin "Deploy" control — rendered via admin.components.afterNavLinks.
 *
 * Shows how many content changes are queued in `pending-deploys` and lets an
 * ADMIN trigger a single manual Vercel build through the secure server endpoint
 * (POST /api/deploy). The browser never sees VERCEL_DEPLOY_HOOK_URL — the hook
 * URL stays server-side.
 *
 * Built entirely on @payloadcms/ui primitives so it inherits the admin theme
 * (incl. dark mode) and toast container:
 *  - <Button>   — action + built-in disabled/loading affordance
 *  - toast      — success / error / in-flight notifications
 *  - useAuth    — gate the control to admins (editors can't deploy, so we hide
 *                 it rather than show a button that always 403s)
 */
const POLL_MS = 30_000;
interface IndexPreview {
 ready: string[];
 readyVersions: {url:string;changedAt:string}[];
 deferred: {id:string|number;reason:string}[];
 buildStartedAt: string;
}

const DeployButton: React.FC = () => {
  const { user } = useAuth();
  const role = (user as { role?: string } | null)?.role;
  const isAdmin = role === 'admin';

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [indexPreview, setIndexPreview] = useState<IndexPreview | null>(null);
  const [indexBusy, setIndexBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/deploy/pending', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { count?: number };
        setPending(data.count ?? 0);
      }
    } catch {
      /* transient network error — keep the last known count */
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [isAdmin, refresh]);

  async function previewIndexNow() {
    setIndexBusy(true); setIndexPreview(null);
    try {
      const res = await fetch('/api/seo/reconcile-indexnow', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: false }),
      });
      const body = await res.json().catch(() => ({})) as Partial<IndexPreview> & {error?:string};
      if (!res.ok || !Array.isArray(body.ready) || !Array.isArray(body.readyVersions) ||
          !Array.isArray(body.deferred) || !body.buildStartedAt) {
        throw new Error(body.error || 'Unable to verify deployed URLs.');
      }
      setIndexPreview(body as IndexPreview);
      toast.success('Verified preview ready. Nothing sent to IndexNow.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed.');
    } finally { setIndexBusy(false); }
  }

  async function submitIndexNow() {
    const preview = indexPreview;
    if (!preview?.ready.length || indexBusy) return;
    if (!window.confirm('Send precisely ' + preview.ready.length +
      ' verified URLs to IndexNow? This is a real submission to participating engines.')) return;
    setIndexPreview(null); setIndexBusy(true);
    try {
      const res = await fetch('/api/seo/reconcile-indexnow', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, approvedUrls: preview.ready,
          approvedVersions: preview.readyVersions,
          approvedBuildStartedAt: preview.buildStartedAt }),
      });
      const body = await res.json().catch(() => ({})) as { error?:string; acknowledged?:string[]; simulation?: boolean; message?: string };
      if (!res.ok) throw new Error(body.error || 'IndexNow rejected the submission.');
      if (body.simulation) toast.success(body.message || 'IndexNow simulation only; no URLs submitted.');
      else toast.success((body.acknowledged?.length ?? 0) + ' URL(s) acknowledged by IndexNow. Indexing is not guaranteed.');
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submission failed; queue preserved.');
    } finally { setIndexBusy(false); }
  }

  // Only admins can deploy — hide the control entirely for everyone else.
  if (!isAdmin) return null;

  const deploy = async () => {
    setIndexPreview(null);
    setBusy(true);
    // sonner (what @payloadcms/ui re-exports): toast.loading returns an id;
    // passing that same { id } to toast.success/error replaces the toast in place.
    const id = toast.loading('Triggering deployment…');
    try {
      const res = await fetch('/api/deploy', { method: 'POST', credentials: 'include' });
      const data = (await res.json().catch(() => ({}))) as { pendingCount?: number; error?: string };
      if (res.ok) {
        const n = data.pendingCount ?? 0;
        toast.success(
          `Deployment started on Vercel${n ? ` — ${n} change${n === 1 ? '' : 's'} awaiting verification` : ''}.`,
          { id },
        );
      } else {
        toast.error(data.error || `Deploy failed (${res.status}).`, { id });
      }
    } catch {
      toast.error('Network error — deploy not triggered.', { id });
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const count = pending ?? 0;
  const nothingToDo = count === 0;

  return (
    <div style={{ padding: '0.5rem 0.75rem 1rem' }}>
      <Button
        onClick={() => void deploy()}
        disabled={busy || nothingToDo}
        buttonStyle={nothingToDo ? 'secondary' : 'primary'}
        size="small"
        icon={busy ? undefined : ['plus']}
        aria-label="Deploy site to Vercel"
      >
        {busy
          ? 'Deploying…'
          : nothingToDo
            ? 'Site up to date'
            : `Deploy site (${count} pending)`}
      </Button>
      <section aria-label="IndexNow post-deploy verification" style={{ marginTop: 12 }}>
        <p style={{ fontSize: 12 }}>IndexNow: verify production pages after Vercel is ready. Google uses Search Console.</p>
        <Button onClick={() => void previewIndexNow()} disabled={busy || indexBusy}
          buttonStyle="secondary" size="small" aria-label="Preview IndexNow URLs">
          {indexBusy ? 'Checking…' : 'Preview IndexNow'}
        </Button>
        {indexPreview && <div role="region" aria-label="IndexNow preview" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
          <p>{indexPreview.ready.length} verified URL(s), {indexPreview.deferred.length} deferred. No URLs submitted.</p>
          <ul style={{ maxHeight: 160, overflowY: 'auto', paddingLeft: 18 }}>
            {indexPreview.ready.map(url => <li key={url}>{url}</li>)}
          </ul>
          {indexPreview.ready.length > 0 && <Button onClick={() => void submitIndexNow()}
            disabled={indexBusy} buttonStyle="primary" size="small" aria-label="Submit approved IndexNow URLs">
            Submit verified URLs to IndexNow
          </Button>}
        </div>}
      </section>
    </div>
  );
};

export default DeployButton;
