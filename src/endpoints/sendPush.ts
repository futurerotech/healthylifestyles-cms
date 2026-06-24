import type { Endpoint, PayloadRequest } from 'payload';
import { broadcast, type PushConfig } from '../lib/push';

export const sendPush: Endpoint = {
  path: '/push/send',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ ok: false, message: 'Not authenticated.' }, { status: 401 });
    }

    const p = req.payload as any;

    try {
      let body: { title?: string; body?: string; articleId?: string; url?: string };
      try {
        body = req.json ? await req.json() : {};
      } catch {
        return Response.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
      }

      if (!body.title) {
        return Response.json({ ok: false, message: 'title is required.' }, { status: 400 });
      }

      // Fetch push config from audience global
      const audience = await p.findGlobal({ slug: 'audience', depth: 0 });
      if (!audience?.pushEnabled) {
        return Response.json({ ok: false, message: 'Push notifications are not enabled. Enable them in Settings → Audience.' }, { status: 400 });
      }

      const pushConfig: PushConfig = {
        vapidSubject: audience.vapidSubject || 'mailto:hello@healthylifestyles.com',
        vapidPublicKey: audience.vapidPublicKey || '',
        vapidPrivateKey: audience.vapidPrivateKey || '',
        defaultIcon: audience.defaultIcon || undefined,
      };

      if (!pushConfig.vapidPublicKey || !pushConfig.vapidPrivateKey) {
        return Response.json({ ok: false, message: 'VAPID keys not configured. Set them in Settings → Audience → Push Notifications.' }, { status: 400 });
      }

      const url = body.url || (body.articleId ? `/wellness-hub/${body.articleId}` : '/');
      const result = await broadcast(p, pushConfig, { title: body.title, body: body.body, url });

      // Log to push history
      if (body.articleId) {
        await p.create({
          collection: 'push-history',
          data: {
            title: body.title,
            body: body.body || '',
            article: body.articleId,
            url,
            sentCount: result.sent,
            failedCount: result.failed,
            errors: result.errors.length > 0 ? result.errors : undefined,
          },
        });
      }

      return Response.json({
        ok: true,
        sent: result.sent,
        failed: result.failed,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({ ok: false, message: msg }, { status: 500 });
    }
  },
};
