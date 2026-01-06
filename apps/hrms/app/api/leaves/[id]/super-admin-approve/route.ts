import { NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/permissions'

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

    // Check if user is Super Admin
    const isAdmin = await isSuperAdmin(currentEmployeeId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only Super Admin can give final approval' }, { status: 403 })
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
            reportsToId: true,
          },
        },
      },
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Check if request is in correct state
    if (leaveRequest.status !== 'PENDING_SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Leave request is not pending Super Admin approval' },
        { status: 400 }
      )
    }

    const startDateStr = new Date(leaveRequest.startDate).toLocaleDateString()
    const endDateStr = new Date(leaveRequest.endDate).toLocaleDateString()

    if (approved) {
      // Approve → move to APPROVED (final)
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          superAdminApprovedById: currentEmployeeId,
          superAdminApprovedAt: new Date(),
          superAdminNotes: notes,
          reviewedById: currentEmployeeId,
          reviewedAt: new Date(),
          reviewNotes: notes,
        },
      })

      // Update leave balance (move from pending to used)
      const year = new Date(leaveRequest.startDate).getFullYear()
      await prisma.leaveBalance.updateMany({
        where: {
          employeeId: leaveRequest.employeeId,
          leaveType: leaveRequest.leaveType,
          year,
        },
        data: {
          pending: { decrement: Math.ceil(leaveRequest.totalDays) },
          used: { increment: Math.ceil(leaveRequest.totalDays) },
        },
      })

      // Notify employee of approval
      await prisma.notification.create({
        data: {
          type: 'LEAVE_APPROVED',
          title: 'Leave Request Approved',
          message: `Your ${leaveRequest.leaveType.replace(/_/g, ' ')} leave request (${startDateStr} - ${endDateStr}) has been fully approved.`,
          link: `/leaves/${id}`,
          employeeId: leaveRequest.employeeId,
          relatedId: id,
          relatedType: 'LEAVE',
        },
      })

      // Notify manager as well
      if (leaveRequest.employee.reportsToId) {
        await prisma.notification.create({
          data: {
            type: 'LEAVE_APPROVED',
            title: 'Leave Request Approved',
            message: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}'s ${leaveRequest.leaveType.replace(/_/g, ' ')} leave request (${startDateStr} - ${endDateStr}) has been approved.`,
            link: `/leaves/${id}`,
            employeeId: leaveRequest.employee.reportsToId,
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
          superAdminApprovedById: currentEmployeeId,
          superAdminApprovedAt: new Date(),
          superAdminNotes: notes,
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
          message: `Your ${leaveRequest.leaveType.replace(/_/g, ' ')} leave request (${startDateStr} - ${endDateStr}) has been rejected by Super Admin.${notes ? ` Reason: ${notes}` : ''}`,
          link: `/leaves/${id}`,
          employeeId: leaveRequest.employeeId,
          relatedId: id,
          relatedType: 'LEAVE',
        },
      })

      return NextResponse.json(updated)
    }
  } catch (e) {
    return safeErrorResponse(e, 'Failed to process Super Admin approval')
  }
}
