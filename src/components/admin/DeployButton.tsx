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

const DeployButton: React.FC = () => {
  const { user } = useAuth();
  const role = (user as { role?: string } | null)?.role;
  const isAdmin = role === 'admin';

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<number | null>(null);

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

  // Only admins can deploy — hide the control entirely for everyone else.
  if (!isAdmin) return null;

  const deploy = async () => {
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
          `Deployment started on Vercel${n ? ` — ${n} change${n === 1 ? '' : 's'} published` : ''}.`,
          { id },
        );
        setPending(0);
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
    </div>
  );
};

export default DeployButton;
