import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { getCompletedWorkItems } from '@/lib/work-items'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const employeeId = await getCurrentEmployeeId()
    if (!employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await getCompletedWorkItems(employeeId)
    return NextResponse.json(result)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch completed work items')
  }
}
