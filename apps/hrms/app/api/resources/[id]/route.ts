import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { UpdateResourceSchema } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'

type ResourceRouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: ResourceRouteContext) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const r = await prisma.resource.findUnique({ where: { id } })

    if (!r) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(r)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch resource')
  }
}

export async function PATCH(req: Request, context: ResourceRouteContext) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await req.json()

    // Validate input with whitelist schema
    const validation = validateBody(UpdateResourceSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    // Build update object with explicit field whitelist
    const updates: Record<string, unknown> = {}

    if (data.name !== undefined) updates.name = data.name
    if (data.category !== undefined) updates.category = data.category
    if (data.subcategory !== undefined) updates.subcategory = data.subcategory
    if (data.email !== undefined) updates.email = data.email
    if (data.phone !== undefined) updates.phone = data.phone
    if (data.website !== undefined) updates.website = data.website
    if (data.description !== undefined) updates.description = data.description
    if (data.rating !== undefined) updates.rating = data.rating

    const r = await prisma.resource.update({
      where: { id },
      data: updates,
    })

    return NextResponse.json(r)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update resource')
  }
}

export async function DELETE(req: Request, context: ResourceRouteContext) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await prisma.resource.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete resource')
  }
}
