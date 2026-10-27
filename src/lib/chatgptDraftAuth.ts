import { timingSafeEqual } from 'node:crypto';

/** A server-to-server authorization gate. Never accepts browser cookies. */
export type DraftBridgeAuthResult = 'ok' | 'unconfigured' | 'denied';

export function draftBridgeAuth(headers: Headers, secret: string | undefined): DraftBridgeAuthResult {
  if (!secret || secret.length < 43 || secret.length > 1024 || /\s/.test(secret)) return 'unconfigured';
  // The Worker uses a bearer token only. Browser requests are not permitted.
  if (headers.has('origin') || headers.has('cookie')) return 'denied';
  const authorization = headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return 'denied';
  const presented = Buffer.from(authorization.slice(7), 'utf8');
  const expected = Buffer.from(secret, 'utf8');
  return presented.length === expected.length && timingSafeEqual(presented, expected) ? 'ok' : 'denied';
}
