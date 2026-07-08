import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    return Response.json({ success: true, message: 'Database schema pushed successfully!' })
  } catch (error: any) {
    // Removed error.message to prevent server info leakage
    return Response.json({ success: false, error: 'Service temporarily unavailable' }, { status: 503 })
  }
}