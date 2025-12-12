import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { UpdateLeavePolicySchema } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'

type LeavePolicyRouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: LeavePolicyRouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const p = await prisma.leavePolicy.findUnique({ where: { id } })

    if (!p) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(p)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch leave policy')
  }
}

export async function PATCH(req: Request, context: LeavePolicyRouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await req.json()

    const validation = validateBody(UpdateLeavePolicySchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    // Build update object with explicit field whitelist
    const updates: Record<string, unknown> = {}

    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.entitledDays !== undefined) updates.entitledDays = data.entitledDays
    if (data.isPaid !== undefined) updates.isPaid = data.isPaid
    if (data.carryoverMax !== undefined) updates.carryoverMax = data.carryoverMax
    if (data.minNoticeDays !== undefined) updates.minNoticeDays = data.minNoticeDays
    if (data.maxConsecutive !== undefined) updates.maxConsecutive = data.maxConsecutive
    if (data.rules !== undefined) updates.rules = data.rules
    if (data.effectiveFrom !== undefined) {
      updates.effectiveFrom = data.effectiveFrom ? new Date(data.effectiveFrom) : null
    }
    if (data.status !== undefined) updates.status = data.status

    const p = await prisma.leavePolicy.update({
      where: { id },
      data: updates,
    })

    return NextResponse.json(p)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update leave policy')
  }
}

export async function DELETE(req: Request, context: LeavePolicyRouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await prisma.leavePolicy.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete leave policy')
  }
}
