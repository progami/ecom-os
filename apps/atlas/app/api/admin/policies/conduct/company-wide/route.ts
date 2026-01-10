import { NextRequest, NextResponse } from 'next/server'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { ensureConductPolicyCompanyWide } from '@/lib/domain/policies/conduct-company-wide'

/**
 * POST /api/admin/policies/conduct/company-wide
 * Consolidate CONDUCT policies into a single company-wide (Region=ALL) policy.
 */
export async function POST(request: NextRequest) {
  const rateLimitError = withRateLimit(request)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await isHROrAbove(actorId)
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await ensureConductPolicyCompanyWide()
    return NextResponse.json(result)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to consolidate conduct policy')
  }
}

