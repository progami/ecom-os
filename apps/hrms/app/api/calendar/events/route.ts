import { NextResponse } from 'next/server'
import { isCalendarConfigured, listUpcomingEvents, createEvent } from '@/lib/google-calendar'
import { CreateCalendarEventSchema } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    if (!isCalendarConfigured()) {
      return NextResponse.json({ items: [], note: 'Google Calendar not configured' }, { status: 200 })
    }

    const items = await listUpcomingEvents({ maxResults: 25 })

    // Normalize minimal fields for client - only expose safe fields
    const normalized = items.map((e: Record<string, unknown>) => ({
      id: e.id,
      summary: e.summary,
      description: e.description,
      location: e.location,
      start: e.start,
      end: e.end,
      htmlLink: e.htmlLink,
    }))

    return NextResponse.json({ items: normalized })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to load events')
  }
}

export async function POST(req: Request) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    if (!isCalendarConfigured()) {
      return NextResponse.json({ error: 'Google Calendar not configured' }, { status: 400 })
    }

    const body = await req.json()

    // Validate input
    const validation = validateBody(CreateCalendarEventSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    const event = await createEvent({
      summary: data.summary,
      description: data.description,
      location: data.location,
      start: data.start,
      end: data.end,
    })

    return NextResponse.json(event, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create event')
  }
}
