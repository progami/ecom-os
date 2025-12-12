import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { UpdatePolicySchema, bumpVersion } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'

type PolicyRouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: PolicyRouteContext) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const p = await prisma.policy.findUnique({ where: { id } })

    if (!p) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(p)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch policy')
  }
}

export async function PATCH(req: Request, context: PolicyRouteContext) {
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
    const validation = validateBody(UpdatePolicySchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    // Build update object with explicit field whitelist
    const updates: Record<string, unknown> = {}

    if (data.title !== undefined) updates.title = data.title
    if (data.category !== undefined) updates.category = data.category
    if (data.region !== undefined) updates.region = data.region
    if (data.summary !== undefined) updates.summary = data.summary
    if (data.content !== undefined) updates.content = data.content
    if (data.fileUrl !== undefined) updates.fileUrl = data.fileUrl

    // Handle version: explicit version takes precedence, then bumpVersion
    if (data.version !== undefined) {
      updates.version = data.version
    } else if (data.bumpVersion) {
      const existing = await prisma.policy.findUnique({ where: { id }, select: { version: true } })
      updates.version = bumpVersion(existing?.version || '1.0', data.bumpVersion)
    }

    if (data.effectiveDate !== undefined) {
      if (data.effectiveDate) {
        const newDate = new Date(data.effectiveDate)
        // Check if another policy has this effective date
        const existing = await prisma.policy.findFirst({
          where: {
            effectiveDate: newDate,
            id: { not: id },
          },
        })
        if (existing) {
          return NextResponse.json(
            { error: `Another policy already has effective date ${data.effectiveDate}` },
            { status: 400 }
          )
        }
        updates.effectiveDate = newDate
      } else {
        updates.effectiveDate = null
      }
    }
    if (data.status !== undefined) updates.status = data.status

    const p = await prisma.policy.update({
      where: { id },
      data: updates,
    })

    return NextResponse.json(p)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update policy')
  }
}

export async function DELETE(req: Request, context: PolicyRouteContext) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await prisma.policy.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete policy')
  }
}
