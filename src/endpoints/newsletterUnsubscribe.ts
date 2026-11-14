import type { Endpoint, PayloadRequest } from 'payload';
import { timingSafeEqual } from 'node:crypto';
import {
  createUnsubscribeToken, isSendable, tokenSecret, unsubscribeUrl, verifyUnsubscribeToken,
} from '../lib/newsletter-suppression';
import { CMS_ORIGIN } from '../lib/allowedOrigins';

/** Minimal data access used by the handlers, so the logic is testable without a database. */
export interface SubscriberStore {
  findById(id: string): Promise<{ id: string | number; unsubscribedAt?: string | null } | null>;
  findByEmail(email: string): Promise<{ id: string | number; unsubscribedAt?: string | null } | null>;
  markUnsubscribed(id: string | number, at: string): Promise<void>;
}

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

/**
 * Applies an unsubscribe token. It is idempotent: an already-unsubscribed or deleted
 * subscriber gets the same answer as a fresh one, so the response never reveals
 * whether an address is or was subscribed.
 */
export async function applyUnsubscribe(token: unknown, store: SubscriberStore, secret: string | null, now = Date.now()) {
  const v = verifyUnsubscribeToken(token, secret, { now });
  if (!v.ok) return { status: 400, body: { ok: false, message: 'This unsubscribe link is invalid or has expired.' } };
  const sub = await store.findById(v.subscriberId);
  if (sub && !sub.unsubscribedAt) await store.markUnsubscribed(sub.id, new Date(now).toISOString());
  return { status: 200, body: { ok: true, message: 'You are unsubscribed. You will not receive further newsletter emails.' } };
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Pre-send check for any email provider: returns a fresh unsubscribe link only when the
 * address may be emailed. Authenticated with the existing SYNC_SHARED_SECRET, which is
 * held only by the email automation (n8n). Unknown and suppressed addresses get the same
 * answer.
 */
export async function sendCheck(email: unknown, providedSecret: string | null, store: SubscriberStore, env: NodeJS.ProcessEnv = process.env, now = Date.now()) {
  const shared = env.SYNC_SHARED_SECRET?.trim();
  const secret = tokenSecret(env);
  if (!shared || !secret) return { status: 503, body: { ok: false, message: 'Unsubscribe links are not configured.' } };
  if (!providedSecret || !safeEqual(providedSecret, shared)) return { status: 401, body: { ok: false, message: 'Unauthorized.' } };
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 400, body: { ok: false, message: 'Valid email is required.' } };
  }
  const sub = await store.findByEmail(email.toLowerCase().trim());
  if (!isSendable(sub)) return { status: 200, body: { ok: true, sendable: false } };
  const token = createUnsubscribeToken(sub!.id, secret, { now });
  const base = (env.SERVER_URL || CMS_ORIGIN).replace(/\/$/, '');
  return {
    status: 200,
    body: {
      ok: true,
      sendable: true,
      // Visible link for the email body (confirmation page on the site).
      unsubscribeUrl: unsubscribeUrl(token, env.SITE_BASE_URL || env.NEXT_PUBLIC_SITE_URL || undefined),
      // RFC 8058 one-click target for the List-Unsubscribe header, used with
      // "List-Unsubscribe-Post: List-Unsubscribe=One-Click".
      oneClickUrl: `${base}/api/subscribers/unsubscribe?t=${encodeURIComponent(token)}`,
    },
  };
}

const payloadStore = (req: PayloadRequest): SubscriberStore => {
  const p = req.payload as any;
  return {
    async findById(id) {
      try { return await p.findByID({ collection: 'subscribers', id, depth: 0, overrideAccess: true }); } catch { return null; }
    },
    async findByEmail(email) {
      const r = await p.find({ collection: 'subscribers', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true });
      return r?.docs?.[0] ?? null;
    },
    async markUnsubscribed(id, at) {
      await p.update({ collection: 'subscribers', id, data: { unsubscribedAt: at }, depth: 0, overrideAccess: true });
    },
  };
};

async function readToken(req: PayloadRequest): Promise<unknown> {
  const url = new URL(req.url || '', 'http://local');
  const fromQuery = url.searchParams.get('t');
  if (fromQuery) return fromQuery; // RFC 8058 one-click: token in the URL, body is "List-Unsubscribe=One-Click"
  const type = req.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) return (await (req as any).json())?.token;
    if (type.includes('application/x-www-form-urlencoded')) return new URLSearchParams(await (req as any).text()).get('t');
  } catch { /* fall through */ }
  return undefined;
}

/** POST /api/subscribers/unsubscribe — public; the signed token is the only credential. */
export const newsletterUnsubscribe: Endpoint = {
  path: '/subscribers/unsubscribe',
  method: 'post',
  handler: async (req) => {
    const r = await applyUnsubscribe(await readToken(req), payloadStore(req), tokenSecret());
    return Response.json(r.body, { status: r.status, headers: NO_STORE });
  },
};

/** POST /api/subscribers/send-check — server-to-server, x-sync-secret required. */
export const newsletterSendCheck: Endpoint = {
  path: '/subscribers/send-check',
  method: 'post',
  handler: async (req) => {
    let email: unknown;
    try { email = (await (req as any).json())?.email; } catch { email = undefined; }
    const r = await sendCheck(email, req.headers.get('x-sync-secret'), payloadStore(req));
    return Response.json(r.body, { status: r.status, headers: NO_STORE });
  },
};
