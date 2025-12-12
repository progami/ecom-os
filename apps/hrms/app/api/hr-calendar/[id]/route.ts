import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { UpdateHRCalendarEventSchema } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const item = await prisma.hRCalendarEvent.findUnique({
      where: { id },
    })

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch HR calendar event')
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await req.json()

    const validation = validateBody(UpdateHRCalendarEventSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data
    const updates: Record<string, unknown> = {}

    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.eventType !== undefined) updates.eventType = data.eventType
    if (data.startDate !== undefined) updates.startDate = new Date(data.startDate)
    if (data.endDate !== undefined) updates.endDate = data.endDate ? new Date(data.endDate) : null
    if (data.allDay !== undefined) updates.allDay = data.allDay
    if (data.employeeId !== undefined) updates.employeeId = data.employeeId
    if (data.relatedRecordId !== undefined) updates.relatedRecordId = data.relatedRecordId
    if (data.relatedRecordType !== undefined) updates.relatedRecordType = data.relatedRecordType

    const item = await prisma.hRCalendarEvent.update({
      where: { id },
      data: updates,
    })

    return NextResponse.json(item)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update HR calendar event')
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await prisma.hRCalendarEvent.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete HR calendar event')
  }
}
