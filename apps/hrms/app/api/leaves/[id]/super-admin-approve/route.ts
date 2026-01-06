import { NextResponse } from 'next/server'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { z } from 'zod'
import { processSuperAdminLeaveApproval } from '@/lib/domain/leave/approval'

type RouteContext = { params: Promise<{ id: string }> }

const SuperAdminApproveSchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(2000).optional(),
})

/**
 * POST /api/leaves/[id]/super-admin-approve
 * Super Admin approves/rejects leave request (Level 3 - Final)
 * PENDING_SUPER_ADMIN → APPROVED (approved) or REJECTED (rejected)
 */
export async function POST(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validation = validateBody(SuperAdminApproveSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { approved, notes } = validation.data

    const result = await processSuperAdminLeaveApproval({
      leaveId: id,
      actorId: currentEmployeeId,
      approved,
      notes,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status })
    }

    return NextResponse.json(result.data)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to process Super Admin approval')
  }
}
