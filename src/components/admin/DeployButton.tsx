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
 stagingPreviewOnly?: boolean;
 ready: string[];
 readyVersions: {url:string;changedAt:string}[];
 deferred: {id:string|number;reason:string}[];
 buildStartedAt: string;
 page: number;
 totalPages: number;
}
interface IndexAttempt {
 id: string; state: string; provider_status: number | null; approved_build: string; created_at: string;
 items: { id: number; changedAt: string; url: string; current: boolean }[];
 reviews?: { decision: string; reasonCode: string; actorId: string; createdAt: string }[];
}

const DeployButton: React.FC = () => {
  const { user } = useAuth();
  const role = (user as { role?: string } | null)?.role;
  const isAdmin = role === 'admin';

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [pendingError, setPendingError] = useState(false);
  const [stagingPreviewOnly, setStagingPreviewOnly] = useState(false);
  const [indexPreview, setIndexPreview] = useState<IndexPreview | null>(null);
  const [indexBusy, setIndexBusy] = useState(false);
  const [indexPage, setIndexPage] = useState(1);
  const [attempts, setAttempts] = useState<IndexAttempt[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/deploy/pending', { credentials: 'include' });
      if (!res.ok) throw new Error('Pending queue unavailable');
      const data = (await res.json()) as { count?: unknown; stagingPreviewOnly?: unknown };
      if (typeof data.count !== 'number' || !Number.isSafeInteger(data.count) || data.count < 0) {
        throw new Error('Invalid pending queue count');
      }
      setPending(data.count);
      setStagingPreviewOnly(data.stagingPreviewOnly === true);
      setPendingError(false);
    } catch {
      setPending(null);
      setPendingError(true);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [isAdmin, refresh]);

  async function previewIndexNow(page = indexPage) {
    setIndexBusy(true); setIndexPreview(null);
    try {
      const res = await fetch('/api/seo/reconcile-indexnow', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: false, page }),
      });
      const body = await res.json().catch(() => ({})) as Partial<IndexPreview> & {error?:string};
      if (!res.ok || !Array.isArray(body.ready) || !Array.isArray(body.readyVersions) ||
          !Array.isArray(body.deferred) || !body.buildStartedAt) {
        throw new Error(body.error || 'Unable to verify deployed URLs.');
      }
      setIndexPreview(body as IndexPreview);
      if (body.stagingPreviewOnly === true) setStagingPreviewOnly(true);
      setIndexPage(page);
      toast.success('IndexNow preview complete. Nothing sent to IndexNow.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed.');
    } finally { setIndexBusy(false); }
  }

  async function submitIndexNow() {
    const preview = indexPreview;
    if (!preview?.ready.length || indexBusy || stagingPreviewOnly || preview.stagingPreviewOnly) return;
    if (!window.confirm('Send precisely ' + preview.ready.length +
      ' verified URLs to IndexNow? This is a real submission to participating engines.')) return;
    setIndexPreview(null); setIndexBusy(true);
    try {
      const res = await fetch('/api/seo/reconcile-indexnow', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, approvedUrls: preview.ready,
          approvedVersions: preview.readyVersions,
          approvedBuildStartedAt: preview.buildStartedAt, page: preview.page || indexPage }),
      });
      const body = await res.json().catch(() => ({})) as { error?:string; acknowledged?:string[]; simulation?: boolean; message?: string };
      if (!res.ok) throw new Error(body.error || 'Submission outcome is unknown. Review before retrying.');
      if (body.simulation) {
        toast.success(body.message || 'IndexNow simulation only; no URLs submitted.');
      } else {
        // Provider acceptance and our local queue acknowledgement are separate
        // operations. A missing/partial acknowledgement needs operator review,
        // never a misleading success toast or an automatic retry.
        const acknowledged = body.acknowledged;
        if (!Array.isArray(acknowledged) ||
            acknowledged.some(url => typeof url !== 'string' || !preview.ready.includes(url)) ||
            new Set(acknowledged).size !== acknowledged.length) {
          toast.error('IndexNow acknowledgement could not be verified. Inspect the queue before another submission.');
        } else if (acknowledged.length !== preview.ready.length) {
          toast.error('IndexNow accepted the request, but only ' + acknowledged.length +
            ' of ' + preview.ready.length + ' queue entry/entries were cleared. Review pending changes.');
        } else {
          toast.success(acknowledged.length + ' URL(s) acknowledged by IndexNow. Indexing is not guaranteed.');
        }
      }
      void refresh();
    } catch (e) {
      toast.error(e instanceof TypeError ? 'Submission outcome is unknown. Review before retrying.' :
        e instanceof Error ? e.message : 'Submission outcome is unknown. Review before retrying.');
    } finally { setIndexBusy(false); }
  }

  async function reviewAttempts() {
    setIndexBusy(true);
    try {
      const res = await fetch('/api/seo/indexnow-attempts', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) });
      const body = await res.json() as { attempts?: IndexAttempt[]; error?: string };
      if (!res.ok || !Array.isArray(body.attempts)) throw new Error(body.error || 'Attempt review unavailable.');
      setAttempts(body.attempts);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Attempt review unavailable.'); }
    finally { setIndexBusy(false); }
  }

  async function authorizeRetry(attempt: IndexAttempt, resolveChanged = false) {
    if (!window.confirm('The provider may already have received these URLs. Authorizing a retry can create a duplicate. Continue after reviewing the exact revisions?')) return;
    setIndexBusy(true);
    try {
      const res = await fetch('/api/seo/indexnow-attempts', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: resolveChanged ? 'resolve_changed' : 'authorize_retry',
          attemptId: attempt.id, confirmRisk: true, items: attempt.items.map(({ id, changedAt, url }) => ({ id, changedAt, url })) }) });
      const body = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(body.error || 'Review could not be recorded.');
      setAttempts(null); setIndexPreview(null);
      toast.success(body.message || 'Retry authorized; run a fresh preview.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Review could not be recorded.'); }
    finally { setIndexBusy(false); }
  }

  async function cancelReservation(attempt: IndexAttempt) {
    if (!window.confirm('Cancel this not-yet-dispatched reservation? If dispatch has begun, cancellation will be refused.')) return;
    setIndexBusy(true);
    try {
      const res = await fetch('/api/seo/indexnow-attempts', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel_reserved', attemptId: attempt.id, confirm: true }) });
      const body = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(body.error || 'Reservation could not be cancelled.');
      setAttempts(null); setIndexPreview(null); toast.success(body.message || 'Reservation cancelled.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Reservation could not be cancelled.'); }
    finally { setIndexBusy(false); }
  }

  // Only admins can deploy — hide the control entirely for everyone else.
  if (!isAdmin) return null;

  const deploy = async () => {
    if (stagingPreviewOnly) return;
    setIndexPreview(null);
    setIndexPage(1);
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
  const nothingToDo = !pendingError && pending === 0;

  return (
    <div style={{ padding: '0.5rem 0.75rem 1rem' }}>
      <Button
        onClick={() => void deploy()}
        disabled={busy || pendingError || pending === null || nothingToDo || stagingPreviewOnly}
        buttonStyle={nothingToDo ? 'secondary' : 'primary'}
        size="small"
        icon={busy ? undefined : ['plus']}
        aria-label="Deploy site to Vercel"
      >
        {busy
          ? 'Deploying…'
          : pendingError || pending === null
            ? 'Deploy status unavailable'
          : nothingToDo
            ? 'Site up to date'
            : `Deploy site (${count} pending)`}
      </Button>
      {pendingError && <p role="alert">Pending deploy queue unavailable. Check CMS database before deploying.</p>}
      {stagingPreviewOnly && <p role="status">Isolated staging: Vercel deployment and IndexNow submission are disabled. Preview only.</p>}
      <section aria-label="IndexNow post-deploy verification" style={{ marginTop: 12 }}>
        <p style={{ fontSize: 12 }}>IndexNow: verify production pages after Vercel is ready. Google uses Search Console.</p>
        <Button onClick={() => void previewIndexNow()} disabled={busy || indexBusy}
          buttonStyle="secondary" size="small" aria-label="Preview IndexNow URLs">
          {indexBusy ? 'Checking…' : 'Preview IndexNow'}
        </Button>
        <Button onClick={() => void reviewAttempts()} disabled={busy || indexBusy}
          buttonStyle="secondary" size="small" aria-label="Review IndexNow attempts">Review attempts</Button>
        {attempts && <div role="region" aria-label="IndexNow attempt review" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
          {attempts.length === 0 && <p>No recorded attempts.</p>}
          {attempts.map(attempt => <div key={attempt.id}>
            <p>Attempt {attempt.id}: {attempt.state}; provider status {attempt.provider_status ?? 'unknown'}; build {attempt.approved_build}.</p>
            <p>Provider receipt does not establish indexing. An interrupted in-flight request may have reached the provider and requires separately verified recovery.</p>
            <ul>{attempt.items.map(item => <li key={String(item.id)}>{item.url} — revision {item.changedAt} — {item.current ? 'current' : 'changed or missing'}</li>)}</ul>
            {(attempt.reviews?.length ?? 0) > 0 && <ul>{attempt.reviews!.map((review, i) =>
              <li key={i}>Review {review.decision} ({review.reasonCode}) by administrator {review.actorId} at {review.createdAt}</li>)}</ul>}
            {attempt.state === 'reserved' && !stagingPreviewOnly && <Button onClick={() => void cancelReservation(attempt)}
              disabled={indexBusy} buttonStyle="secondary" size="small" aria-label={'Cancel reservation for ' + attempt.id}>Cancel unsent reservation</Button>}
            {['unknown', 'pending', 'rejected', 'received'].includes(attempt.state) && attempt.items.length > 0 && attempt.items.every(item => item.current) && !stagingPreviewOnly &&
              <Button onClick={() => void authorizeRetry(attempt)} disabled={indexBusy} buttonStyle="secondary" size="small"
                aria-label={'Authorize retry for ' + attempt.id}>Authorize reviewed retry</Button>}
            {['unknown', 'pending', 'rejected', 'received'].includes(attempt.state) && attempt.items.some(item => !item.current) && !stagingPreviewOnly &&
              <Button onClick={() => void authorizeRetry(attempt, true)} disabled={indexBusy} buttonStyle="secondary" size="small"
                aria-label={'Review changed attempt ' + attempt.id}>Resolve old changed attempt</Button>}
          </div>)}
        </div>}
        {indexPreview && <div role="region" aria-label="IndexNow preview" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
          <p>{indexPreview.ready.length} verified URL(s), {indexPreview.deferred.length} deferred. No URLs submitted.</p>
          <p>Queue page {indexPreview.page || indexPage} of {indexPreview.totalPages || 1}.</p>
          <div>
            <Button onClick={() => void previewIndexNow((indexPreview.page || indexPage) - 1)}
              disabled={indexBusy || (indexPreview.page || indexPage) <= 1}
              buttonStyle="secondary" size="small" aria-label="Previous IndexNow page">Previous</Button>
            <Button onClick={() => void previewIndexNow((indexPreview.page || indexPage) + 1)}
              disabled={indexBusy || (indexPreview.page || indexPage) >= (indexPreview.totalPages || 1)}
              buttonStyle="secondary" size="small" aria-label="Next IndexNow page">Next</Button>
          </div>
          <ul style={{ maxHeight: 160, overflowY: 'auto', paddingLeft: 18 }}>
            {indexPreview.ready.map(url => <li key={url}>{url}</li>)}
          </ul>
          {indexPreview.deferred.length > 0 && (
            <details aria-label="Deferred IndexNow queue entries">
              <summary>Review {indexPreview.deferred.length} deferred queue item(s) and reasons</summary>
              <ul style={{ maxHeight: 200, overflowY: 'auto', paddingLeft: 18 }}>
                {indexPreview.deferred.map((item, i) => (
                  <li key={String(item.id) + ':' + i}>
                    Queue entry {String(item.id)}: {item.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {indexPreview.ready.length > 0 && !stagingPreviewOnly && !indexPreview.stagingPreviewOnly &&
          <Button onClick={() => void submitIndexNow()}
            disabled={indexBusy} buttonStyle="primary" size="small" aria-label="Submit approved IndexNow URLs">
            Submit verified URLs to IndexNow
          </Button>}
        </div>}
      </section>
    </div>
  );
};

export default DeployButton;
