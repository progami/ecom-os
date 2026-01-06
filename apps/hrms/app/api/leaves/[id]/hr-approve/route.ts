import { NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { z } from 'zod'
import { isHROrAbove, getSuperAdminEmployees } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

const HRApproveSchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(2000).optional(),
})

/**
 * POST /api/leaves/[id]/hr-approve
 * HR approves/rejects leave request (Level 2)
 * PENDING_HR → PENDING_SUPER_ADMIN (approved) or REJECTED (rejected)
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
    const validation = validateBody(HRApproveSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { approved, notes } = validation.data

    // Check if user is HR
    const isHR = await isHROrAbove(currentEmployeeId)
    if (!isHR) {
      return NextResponse.json({ error: 'Only HR can approve at this stage' }, { status: 403 })
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Check if request is in correct state
    if (leaveRequest.status !== 'PENDING_HR') {
      return NextResponse.json(
        { error: 'Leave request is not pending HR approval' },
        { status: 400 }
      )
    }

    const startDateStr = new Date(leaveRequest.startDate).toLocaleDateString()
    const endDateStr = new Date(leaveRequest.endDate).toLocaleDateString()

    if (approved) {
      // Approve → move to PENDING_SUPER_ADMIN
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: 'PENDING_SUPER_ADMIN',
          hrApprovedById: currentEmployeeId,
          hrApprovedAt: new Date(),
          hrNotes: notes,
        },
      })

      // Notify Super Admins about pending approval
      const superAdmins = await getSuperAdminEmployees()
      for (const admin of superAdmins) {
        await prisma.notification.create({
          data: {
            type: 'LEAVE_PENDING_SUPER_ADMIN',
            title: 'Leave Request Pending Final Approval',
            message: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}'s ${leaveRequest.leaveType.replace(/_/g, ' ')} leave request (${startDateStr} - ${endDateStr}) has been approved by HR and needs your final approval.`,
            link: `/leaves/${id}`,
            employeeId: admin.id,
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
          hrApprovedById: currentEmployeeId,
          hrApprovedAt: new Date(),
          hrNotes: notes,
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
          message: `Your ${leaveRequest.leaveType.replace(/_/g, ' ')} leave request (${startDateStr} - ${endDateStr}) has been rejected by HR.${notes ? ` Reason: ${notes}` : ''}`,
          link: `/leaves/${id}`,
          employeeId: leaveRequest.employeeId,
          relatedId: id,
          relatedType: 'LEAVE',
        },
      })

      return NextResponse.json(updated)
    }
  } catch (e) {
    return safeErrorResponse(e, 'Failed to process HR approval')
  }
}
