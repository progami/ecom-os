import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import {
  CreateHRCalendarEventSchema,
  PaginationSchema,
  MAX_PAGINATION_LIMIT,
  HREventTypeEnum,
} from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)

    const paginationResult = PaginationSchema.safeParse({
      take: searchParams.get('take') || undefined,
      skip: searchParams.get('skip') || undefined,
      q: searchParams.get('q') || undefined,
    })

    const take = paginationResult.success ? paginationResult.data.take : 50
    const skip = paginationResult.success ? paginationResult.data.skip : 0
    const q = paginationResult.success ? paginationResult.data.q?.toLowerCase() : ''

    const where: Record<string, unknown> = {}

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }

    const eventTypeParam = searchParams.get('eventType')
    if (eventTypeParam) {
      const typeValidation = HREventTypeEnum.safeParse(eventTypeParam.toUpperCase())
      if (typeValidation.success) {
        where.eventType = typeValidation.data
      }
    }

    const employeeIdParam = searchParams.get('employeeId')
    if (employeeIdParam) {
      where.employeeId = employeeIdParam
    }

    // Date range filtering
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    if (startDateParam || endDateParam) {
      where.startDate = {}
      if (startDateParam) {
        (where.startDate as Record<string, unknown>).gte = new Date(startDateParam)
      }
      if (endDateParam) {
        (where.startDate as Record<string, unknown>).lte = new Date(endDateParam)
      }
    }

    const [items, total] = await Promise.all([
      prisma.hRCalendarEvent.findMany({
        where,
        take: Math.min(take, MAX_PAGINATION_LIMIT),
        skip,
        orderBy: { startDate: 'asc' },
      }),
      prisma.hRCalendarEvent.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch HR calendar events')
  }
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const body = await req.json()

    const validation = validateBody(CreateHRCalendarEventSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    const item = await prisma.hRCalendarEvent.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        eventType: data.eventType,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        allDay: data.allDay,
        employeeId: data.employeeId ?? null,
        relatedRecordId: data.relatedRecordId ?? null,
        relatedRecordType: data.relatedRecordType ?? null,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create HR calendar event')
  }
}
