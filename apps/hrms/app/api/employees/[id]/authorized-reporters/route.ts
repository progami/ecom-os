import { NextRequest, NextResponse } from 'next/server'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { getAuthorizedReporters } from '@/lib/permissions'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitError = withRateLimit(request)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: targetEmployeeId } = await params

    const reporters = await getAuthorizedReporters(targetEmployeeId)

    return NextResponse.json({
      items: reporters,
      total: reporters.length,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch authorized reporters')
  }
}
