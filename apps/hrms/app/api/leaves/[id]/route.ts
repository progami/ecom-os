import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { z } from 'zod'
import { isHR, isHROrAbove, isSuperAdmin } from '@/lib/permissions'
import { getViewerContext } from '@/lib/domain/workflow/viewer'
import { leaveToWorkflowRecordDTO } from '@/lib/domain/leave/workflow-record'

type RouteContext = { params: Promise<{ id: string }> }

const UpdateLeaveRequestSchema = z.object({
  status: z.enum(['CANCELLED']).optional(), // Only cancel allowed via PATCH now
  reviewNotes: z.string().max(2000).optional(),
  reason: z.string().max(2000).optional(),
})

/**
 * GET /api/leaves/[id]
 * Get a specific leave request
 */
export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format')
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            position: true,
            avatar: true,
            reportsToId: true,
            region: true,
          },
        },
      },
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [isHrOrAbove, isAdmin, isHrOnly] = await Promise.all([
      isHROrAbove(currentEmployeeId),
      isSuperAdmin(currentEmployeeId),
      isHR(currentEmployeeId),
    ])
    const isOwner = leaveRequest.employeeId === currentEmployeeId
    const isManager = leaveRequest.employee.reportsToId === currentEmployeeId
    const canView = isHrOrAbove || isAdmin || isOwner || isManager

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (format === 'workflow') {
      const viewer = await getViewerContext(currentEmployeeId)
      const dto = await leaveToWorkflowRecordDTO(leaveRequest as any, viewer)
      return NextResponse.json(dto)
    }

    // Fetch manager info if exists
    let reportsTo = null
    if (leaveRequest.employee.reportsToId) {
      const manager = await prisma.employee.findUnique({
        where: { id: leaveRequest.employee.reportsToId },
        select: { id: true, firstName: true, lastName: true },
      })
      reportsTo = manager
    }

    // Fetch approvers info
    const approverIds = [
      leaveRequest.managerApprovedById,
      leaveRequest.hrApprovedById,
      leaveRequest.superAdminApprovedById,
    ].filter((id): id is string => id !== null)

    const approvers = approverIds.length > 0
      ? await prisma.employee.findMany({
          where: { id: { in: approverIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : []

    const approverMap = Object.fromEntries(approvers.map(a => [a.id, a]))

    // Determine permissions based on role and status
    const pendingStatuses = ['PENDING', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_SUPER_ADMIN']
    const canCancel = isOwner && pendingStatuses.includes(leaveRequest.status)
    const canManagerApprove = isManager && (leaveRequest.status === 'PENDING_MANAGER' || leaveRequest.status === 'PENDING')
    const canHRApprove = isHrOnly && leaveRequest.status === 'PENDING_HR'
    const canSuperAdminApprove = isAdmin && leaveRequest.status === 'PENDING_SUPER_ADMIN'

    return NextResponse.json({
      ...leaveRequest,
      employee: {
        ...leaveRequest.employee,
        reportsTo,
      },
      // Approvers
      managerApprovedBy: leaveRequest.managerApprovedById ? approverMap[leaveRequest.managerApprovedById] : null,
      hrApprovedBy: leaveRequest.hrApprovedById ? approverMap[leaveRequest.hrApprovedById] : null,
      superAdminApprovedBy: leaveRequest.superAdminApprovedById ? approverMap[leaveRequest.superAdminApprovedById] : null,
      // Permissions
      permissions: {
        canCancel,
        canManagerApprove,
        canHRApprove,
        canSuperAdminApprove,
      },
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch leave request')
  }
}

/**
 * PATCH /api/leaves/[id]
 * Update a leave request (approve, reject, cancel)
 */
export async function PATCH(req: Request, context: RouteContext) {
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
    const validation = validateBody(UpdateLeaveRequestSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { status, reviewNotes, reason } = validation.data

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
            region: true,
          },
        },
      },
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isHrOrAbove = await isHROrAbove(currentEmployeeId)
    const isOwner = leaveRequest.employeeId === currentEmployeeId
    const isManager = leaveRequest.employee.reportsToId === currentEmployeeId
    const isAdmin = isHrOrAbove

    // Determine what actions are allowed
    if (status === 'CANCELLED') {
      // Only the owner or admin can cancel
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Only the requester can cancel' }, { status: 403 })
      }
      // Can only cancel pending requests (any pending status)
      const pendingStatuses = ['PENDING', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_SUPER_ADMIN']
      if (!pendingStatuses.includes(leaveRequest.status)) {
        return NextResponse.json({ error: 'Can only cancel pending requests' }, { status: 400 })
      }
    }

    // Build update data
    const updateData: any = {}
    if (reason !== undefined) updateData.reason = reason
    if (status) {
      updateData.status = status
    }

    // Update the request
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            position: true,
          },
        },
      },
    })

    // Update leave balance based on status change (cancellation only now)
    if (status === 'CANCELLED') {
      const year = new Date(leaveRequest.startDate).getFullYear()
      const pendingStatuses = ['PENDING', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_SUPER_ADMIN']

      if (pendingStatuses.includes(leaveRequest.status)) {
        // Remove from pending
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
      } else if (leaveRequest.status === 'APPROVED') {
        // Return to available (decrease used)
        await prisma.leaveBalance.updateMany({
          where: {
            employeeId: leaveRequest.employeeId,
            leaveType: leaveRequest.leaveType,
            year,
          },
          data: {
            used: { decrement: Math.ceil(leaveRequest.totalDays) },
          },
        })
      }
    }

    // Send notifications based on status change (cancellation only)
    if (status === 'CANCELLED' && leaveRequest.employee.reportsToId) {
      const startDateStr = new Date(leaveRequest.startDate).toLocaleDateString()
      const endDateStr = new Date(leaveRequest.endDate).toLocaleDateString()
      // Notify the manager that the employee cancelled their leave
      await prisma.notification.create({
        data: {
          type: 'LEAVE_CANCELLED',
          title: 'Leave Request Cancelled',
          message: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName} has cancelled their ${leaveRequest.leaveType.replace(/_/g, ' ')} leave request from ${startDateStr} to ${endDateStr}.`,
          link: `/leaves/${id}`,
          employeeId: leaveRequest.employee.reportsToId,
          relatedId: id,
          relatedType: 'LEAVE',
        },
      })
    }

    return NextResponse.json(updated)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update leave request')
  }
}

/**
 * DELETE /api/leaves/[id]
 * Delete a leave request (admin only)
 */
export async function DELETE(req: Request, context: RouteContext) {
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

    const isHrOrAbove = await isHROrAbove(currentEmployeeId)
    if (!isHrOrAbove) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Update balance if pending (any pending status)
    const pendingStatuses = ['PENDING', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_SUPER_ADMIN']
    if (pendingStatuses.includes(leaveRequest.status)) {
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
    }

    await prisma.leaveRequest.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete leave request')
  }
}
