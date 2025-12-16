import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { sendNotificationEmail } from '@/lib/email-service'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string }> }

const UpdateLeaveRequestSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
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

    // Check access
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: { isSuperAdmin: true, permissionLevel: true },
    })

    const canView = currentEmployee?.isSuperAdmin ||
                   (currentEmployee?.permissionLevel ?? 0) >= 50 ||
                   leaveRequest.employeeId === currentEmployeeId ||
                   leaveRequest.employee.reportsToId === currentEmployeeId

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(leaveRequest)
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

    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: { isSuperAdmin: true, permissionLevel: true },
    })

    const isOwner = leaveRequest.employeeId === currentEmployeeId
    const isManager = leaveRequest.employee.reportsToId === currentEmployeeId
    const isAdmin = currentEmployee?.isSuperAdmin || (currentEmployee?.permissionLevel ?? 0) >= 50

    // Determine what actions are allowed
    if (status === 'CANCELLED') {
      // Only the owner or admin can cancel
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Only the requester can cancel' }, { status: 403 })
      }
      // Can only cancel pending requests
      if (leaveRequest.status !== 'PENDING') {
        return NextResponse.json({ error: 'Can only cancel pending requests' }, { status: 400 })
      }
    } else if (status === 'APPROVED' || status === 'REJECTED') {
      // Only manager or admin can approve/reject
      if (!isManager && !isAdmin) {
        return NextResponse.json({ error: 'Only manager or HR can approve/reject' }, { status: 403 })
      }
      // Can only approve/reject pending requests
      if (leaveRequest.status !== 'PENDING') {
        return NextResponse.json({ error: 'Can only approve/reject pending requests' }, { status: 400 })
      }
    }

    // Build update data
    const updateData: any = {}
    if (reason !== undefined) updateData.reason = reason
    if (status) {
      updateData.status = status
      if (status === 'APPROVED' || status === 'REJECTED') {
        updateData.reviewedById = currentEmployeeId
        updateData.reviewedAt = new Date()
        if (reviewNotes) updateData.reviewNotes = reviewNotes
      }
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

    // Update leave balance based on status change
    const year = new Date(leaveRequest.startDate).getFullYear()
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveType_year: {
          employeeId: leaveRequest.employeeId,
          leaveType: leaveRequest.leaveType,
          year,
        },
      },
    })

    if (balance) {
      if (status === 'APPROVED' && leaveRequest.status === 'PENDING') {
        // Move from pending to used
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pending: { decrement: Math.ceil(leaveRequest.totalDays) },
            used: { increment: Math.ceil(leaveRequest.totalDays) },
          },
        })
      } else if (status === 'REJECTED' || status === 'CANCELLED') {
        if (leaveRequest.status === 'PENDING') {
          // Remove from pending
          await prisma.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pending: { decrement: Math.ceil(leaveRequest.totalDays) },
            },
          })
        } else if (leaveRequest.status === 'APPROVED' && status === 'CANCELLED') {
          // Return to available (decrease used)
          await prisma.leaveBalance.update({
            where: { id: balance.id },
            data: {
              used: { decrement: Math.ceil(leaveRequest.totalDays) },
            },
          })
        }
      }
    }

    // Send notifications based on status change
    const startDateStr = new Date(leaveRequest.startDate).toLocaleDateString()
    const endDateStr = new Date(leaveRequest.endDate).toLocaleDateString()

    if (status === 'APPROVED') {
      // Notify the employee that their leave was approved
      await prisma.notification.create({
        data: {
          type: 'LEAVE_APPROVED',
          title: 'Leave Request Approved',
          message: `Your ${leaveRequest.leaveType.replace(/_/g, ' ')} leave request from ${startDateStr} to ${endDateStr} has been approved.`,
          link: `/leaves/${id}`,
          employeeId: leaveRequest.employeeId,
          relatedId: id,
          relatedType: 'LEAVE',
        },
      })

      // Send email
      if (leaveRequest.employee.email) {
        await sendNotificationEmail(
          leaveRequest.employee.email,
          leaveRequest.employee.firstName,
          'LEAVE_APPROVED',
          `/leaves/${id}`
        )
      }
    } else if (status === 'REJECTED') {
      // Notify the employee that their leave was rejected
      await prisma.notification.create({
        data: {
          type: 'LEAVE_REJECTED',
          title: 'Leave Request Rejected',
          message: `Your ${leaveRequest.leaveType.replace(/_/g, ' ')} leave request from ${startDateStr} to ${endDateStr} has been rejected.${reviewNotes ? ` Reason: ${reviewNotes}` : ''}`,
          link: `/leaves/${id}`,
          employeeId: leaveRequest.employeeId,
          relatedId: id,
          relatedType: 'LEAVE',
        },
      })

      // Send email
      if (leaveRequest.employee.email) {
        await sendNotificationEmail(
          leaveRequest.employee.email,
          leaveRequest.employee.firstName,
          'LEAVE_REJECTED',
          `/leaves/${id}`
        )
      }
    } else if (status === 'CANCELLED' && leaveRequest.employee.reportsToId) {
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

    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: { isSuperAdmin: true, permissionLevel: true },
    })

    if (!currentEmployee?.isSuperAdmin && (currentEmployee?.permissionLevel ?? 0) < 50) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Update balance if pending
    if (leaveRequest.status === 'PENDING') {
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
