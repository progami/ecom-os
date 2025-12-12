import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { UpdateLeaveBalanceSchema } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'

type LeaveBalanceRouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: LeaveBalanceRouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const balance = await prisma.leaveBalance.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            region: true,
          },
        },
      },
    })

    if (!balance) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...balance,
      remaining: balance.entitled + balance.carryover + balance.adjustment - balance.used,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch leave balance')
  }
}

// Admin endpoint to adjust leave balance
export async function PATCH(req: Request, context: LeaveBalanceRouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await req.json()

    const validation = validateBody(UpdateLeaveBalanceSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    // Get current balance
    const existing = await prisma.leaveBalance.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Update adjustment (adds to existing adjustment)
    const updated = await prisma.leaveBalance.update({
      where: { id },
      data: {
        adjustment: existing.adjustment + data.adjustment,
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      ...updated,
      remaining: updated.entitled + updated.carryover + updated.adjustment - updated.used,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update leave balance')
  }
}
