import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { decryptField } from '../../../../lib/crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/test — test connection to each enabled AI provider.
 *
 * Sends a 1-token ping through each provider and returns per-provider
 * status + latency. Admin-only.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const payload = await getPayload({ config })

  // Auth: admin only
  try {
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    if ((user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admin only.' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  // Get settings with decrypted keys
  const raw = await payload.findGlobal({ slug: 'ai-settings', context: { internal: true } }) as any
  const providers = (raw.providers || []).filter((p: any) => p.enabled !== false)

  if (providers.length === 0) {
    return NextResponse.json({ results: [], error: 'No enabled providers configured.' })
  }

  const model = raw.defaultModel || 'glm-5.2-plan'
  const results: { label: string; ok: boolean; ms?: number; error?: string }[] = []

  for (const p of providers) {
    const start = Date.now()
    try {
      const apiKey = decryptField(p.apiKey || '')
      const url = `${(p.providerUrl || '').replace(/\/$/, '')}/chat/completions`

      const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      })

      const ms = Date.now() - start
      if (res.ok) {
        results.push({ label: p.label, ok: true, ms })
      } else {
        results.push({ label: p.label, ok: false, ms, error: `HTTP ${res.status}` })
      }
    } catch (err) {
      results.push({ label: p.label, ok: false, error: (err as Error).name })
    }
  }

  return NextResponse.json({ results })
}
