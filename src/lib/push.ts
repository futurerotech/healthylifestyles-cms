import type { CollectionAfterChangeHook } from 'payload';
import webPush from 'web-push';

export interface PushConfig {
  vapidSubject: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  defaultIcon?: string;
}

export interface SubscriptionData {
  endpoint: string;
  authKey: string;
  p256dhKey: string;
}

/** Initialise web-push with VAPID details from config. */
export function initPush(config: PushConfig): void {
  webPush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey,
  );
}

/** Send a push notification to a single subscription. */
export async function sendToOne(
  sub: SubscriptionData,
  payload: { title: string; body?: string; icon?: string; url?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { auth: sub.authKey, p256dh: sub.p256dhKey },
    };

    await webPush.sendNotification(
      pushSub,
      JSON.stringify({
        title: payload.title,
        body: payload.body || '',
        icon: payload.icon || '',
        data: { url: payload.url || '/' },
      }),
    );
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('410') || msg.includes('gone')) {
      return { ok: false, error: 'subscription_gone' };
    }
    return { ok: false, error: msg };
  }
}

/** Broadcast a push notification to ALL active subscriptions in the database. */
export async function broadcast(
  payloadApi: any,
  pushConfig: PushConfig,
  notification: { title: string; body?: string; url?: string },
): Promise<{ sent: number; failed: number; errors: unknown[] }> {
  initPush(pushConfig);

  const subs = await payloadApi.find({
    collection: 'push-subscriptions',
    limit: 10000,
  });

  let sent = 0;
  let failed = 0;
  const errors: unknown[] = [];

  for (const sub of subs.docs) {
    const result = await sendToOne(
      { endpoint: sub.endpoint, authKey: sub.authKey as string, p256dhKey: sub.p256dhKey as string },
      {
        title: notification.title,
        body: notification.body,
        icon: pushConfig.defaultIcon,
        url: notification.url,
      },
    );

    if (result.ok) {
      sent++;
    } else {
      failed++;
      errors.push({ endpoint: sub.endpoint.slice(0, 40) + '...', error: result.error });
      if (result.error === 'subscription_gone') {
        await payloadApi.delete({ collection: 'push-subscriptions', id: sub.id });
      }
    }
  }

  return { sent, failed, errors };
}

/** After-publish hook that auto-sends a push notification when an article is published. */
export const afterPublishPushHook: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req: { payload: p },
}) => {
  const payload = p as any;
  const wasPublished = previousDoc?._status === 'published';
  const isPublished = doc._status === 'published';
  if (wasPublished || !isPublished) return;

  const audience = await payload.findGlobal({ slug: 'audience', depth: 0 });
  if (!audience?.pushEnabled || !audience?.autoPushOnPublish) return;

  const pushConfig: PushConfig = {
    vapidSubject: audience.vapidSubject || 'mailto:hello@healthylifestyles.com',
    vapidPublicKey: audience.vapidPublicKey || '',
    vapidPrivateKey: audience.vapidPrivateKey || '',
    defaultIcon: audience.defaultIcon || undefined,
  };

  if (!pushConfig.vapidPublicKey || !pushConfig.vapidPrivateKey) return;

  const title = doc.title || 'New article';
  const body = doc.excerpt || 'Check out our latest wellness guide.';
  const url = `https://www.healthylifestyles.com/wellness-hub/${doc.slug}`;

  const result = await broadcast(payload, pushConfig, { title, body, url });

  await payload.create({
    collection: 'push-history',
    data: {
      title,
      body,
      article: doc.id,
      url,
      sentCount: result.sent,
      failedCount: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined,
    },
  });
};
