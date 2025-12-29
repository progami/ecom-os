import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove, isManagerOf } from '@/lib/permissions'
import { calculateStanding, calculateCulturalHealth } from '@/lib/standing'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')

    // If employeeId is provided, get individual standing
    if (employeeId) {
      const actorId = await getCurrentEmployeeId()
      if (!actorId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const isHR = await isHROrAbove(actorId)
      if (!isHR && employeeId !== actorId) {
        const isManager = await isManagerOf(actorId, employeeId)
        if (!isManager) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
      const standing = await calculateStanding(employeeId)
      return NextResponse.json(standing)
    }

    // Otherwise, return cultural health metrics
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const isHR = await isHROrAbove(actorId)
    if (!isHR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const health = await calculateCulturalHealth()
    return NextResponse.json(health)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch standing data')
  }
}
