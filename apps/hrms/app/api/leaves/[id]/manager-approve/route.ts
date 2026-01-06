import { NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { z } from 'zod'
import { isManagerOf, isHROrAbove, getHREmployees } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

const ManagerApproveSchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(2000).optional(),
})

/**
 * POST /api/leaves/[id]/manager-approve
 * Manager approves/rejects leave request (Level 1)
 * PENDING_MANAGER → PENDING_HR (approved) or REJECTED (rejected)
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
    const validation = validateBody(ManagerApproveSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { approved, notes } = validation.data

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            reportsToId: true,
          },
        },
      },
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Check if request is in correct state
    if (leaveRequest.status !== 'PENDING_MANAGER' && leaveRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Leave request is not pending manager approval' },
        { status: 400 }
      )
    }

    // Check if user is the employee's manager or HR
    const isManager = await isManagerOf(currentEmployeeId, leaveRequest.employeeId)
    const isHR = await isHROrAbove(currentEmployeeId)

    if (!isManager && !isHR) {
      return NextResponse.json(
        { error: 'Only the employee\'s manager or HR can approve at this stage' },
        { status: 403 }
      )
    }

    const startDateStr = new Date(leaveRequest.startDate).toLocaleDateString()
    const endDateStr = new Date(leaveRequest.endDate).toLocaleDateString()

    if (approved) {
      // Approve → move to PENDING_HR
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: 'PENDING_HR',
          managerApprovedById: currentEmployeeId,
          managerApprovedAt: new Date(),
          managerNotes: notes,
        },
      })

      // Notify HR about pending approval
      const hrEmployees = await getHREmployees()
      for (const hr of hrEmployees) {
        await prisma.notification.create({
          data: {
            type: 'LEAVE_PENDING_HR',
            title: 'Leave Request Pending HR Approval',
            message: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}'s ${leaveRequest.leaveType.replace(/_/g, ' ')} leave request (${startDateStr} - ${endDateStr}) has been approved by manager and needs HR approval.`,
            link: `/leaves/${id}`,
            employeeId: hr.id,
            relatedId: id,
            relatedType: 'LEAVE',
          },
        })
      }

      return NextResponse.json(updated)
    } else {
      // Reject → move to REJECTED
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          managerApprovedById: currentEmployeeId,
          managerApprovedAt: new Date(),
          managerNotes: notes,
          reviewedById: currentEmployeeId,
          reviewedAt: new Date(),
          reviewNotes: notes,
        },
      })

      // Update leave balance (remove from pending)
      const year = new Date(leaveRequest.startDate).getFullYear()
      await prisma.leaveBalance.updateMany({
        where: {
          employeeId: leaveRequest.employeeId,
          leaveType: leaveRequest.leaveType,
          year,
        },
        data: {
          pending: { decrement: Math.ceil(leaveRequest.totalDays) },
        },
      })

      // Notify employee of rejection
      await prisma.notification.create({
        data: {
          type: 'LEAVE_REJECTED',
          title: 'Leave Request Rejected',
          message: `Your ${leaveRequest.leaveType.replace(/_/g, ' ')} leave request (${startDateStr} - ${endDateStr}) has been rejected by your manager.${notes ? ` Reason: ${notes}` : ''}`,
          link: `/leaves/${id}`,
          employeeId: leaveRequest.employeeId,
          relatedId: id,
          relatedType: 'LEAVE',
        },
      })

      return NextResponse.json(updated)
    }
  } catch (e) {
    return safeErrorResponse(e, 'Failed to process manager approval')
  }
}
