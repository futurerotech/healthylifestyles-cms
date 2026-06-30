import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    return Response.json({ success: true, message: 'Database schema pushed successfully!' })
  } catch (error: any) {
    return Response.json({ success: false, error: error.message })
  }
}
