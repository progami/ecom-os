import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { UpdateLeaveRequestSchema } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'

type LeaveRequestRouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: LeaveRequestRouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const request = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            region: true,
          },
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!request) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(request)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch leave request')
  }
}

export async function PATCH(req: Request, context: LeaveRequestRouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await req.json()

    const validation = validateBody(UpdateLeaveRequestSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    // Get the current request
    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Only pending requests can be updated
    if (existing.status !== 'PENDING' && data.status) {
      return NextResponse.json(
        { error: 'Only pending requests can be approved/rejected' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {}

    if (data.status !== undefined) {
      updates.status = data.status

      if (data.status === 'APPROVED') {
        updates.approvedAt = new Date()

        // Update leave balance
        const currentYear = new Date().getFullYear()
        await prisma.leaveBalance.update({
          where: {
            employeeId_leaveType_year: {
              employeeId: existing.employeeId,
              leaveType: existing.leaveType,
              year: currentYear,
            },
          },
          data: {
            used: { increment: existing.workingDays },
          },
        })
      } else if (data.status === 'REJECTED') {
        updates.rejectedAt = new Date()
      }
    }

    if (data.comments !== undefined) {
      updates.comments = data.comments
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: updates,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approver: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update leave request')
  }
}

export async function DELETE(req: Request, context: LeaveRequestRouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // Get the request to check status
    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Only pending or cancelled requests can be deleted
    if (existing.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Cannot delete approved leave requests' },
        { status: 400 }
      )
    }

    await prisma.leaveRequest.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete leave request')
  }
}
