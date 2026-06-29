import { getPayload, type Payload } from 'payload';
import config from '@payload-config';

/**
 * Authorize an SEO API request: editor/admin only, via the Payload session
 * cookie on the incoming request. Returns the Payload instance for reuse.
 */
export async function authorizeSeoRequest(
  req: Request,
): Promise<{ ok: true; payload: Payload } | { ok: false; status: number; error: string }> {
  const payload = await getPayload({ config });
  try {
    const { user } = await payload.auth({ headers: req.headers });
    if (!user) return { ok: false, status: 401, error: 'Not authenticated.' };
    const role = (user as { role?: string }).role;
    if (role !== 'admin' && role !== 'editor') return { ok: false, status: 403, error: 'Editors only.' };
    return { ok: true, payload };
  } catch {
    return { ok: false, status: 401, error: 'Not authenticated.' };
  }
}
