import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { getComplianceDashboardSnapshot } from '@/lib/domain/dashboards/compliance'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isHR = await isHROrAbove(actorId)
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const snapshot = await getComplianceDashboardSnapshot()
    return NextResponse.json(snapshot)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch compliance dashboard')
  }
}

