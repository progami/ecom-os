import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { UpdatePolicySchema, bumpVersion } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { publish } from '@/lib/notification-service'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

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

    // Security: Only HR or super-admin can update policies
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasPermission = await isHROrAbove(actorId)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Only HR or super admin can update policies' }, { status: 403 })
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

    // Check if status changed to ARCHIVED
    if (data.status === 'ARCHIVED') {
      await publish({
        type: 'POLICY_ARCHIVED',
        policyId: p.id,
        policyTitle: p.title,
      })
    } else {
      // Publish policy updated event (creates company-wide notification)
      await publish({
        type: 'POLICY_UPDATED',
        policyId: p.id,
        policyTitle: p.title,
      })
    }

    await writeAuditLog({
      actorId,
      action: 'UPDATE',
      entityType: 'POLICY',
      entityId: p.id,
      summary: `Updated policy "${p.title}"`,
      metadata: {
        changed: Object.keys(updates),
      },
      req,
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

    // Security: Only HR or super-admin can delete policies
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasPermission = await isHROrAbove(actorId)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Only HR or super admin can delete policies' }, { status: 403 })
    }

    const existing = await prisma.policy.findUnique({
      where: { id },
      select: { id: true, title: true },
    })

    await prisma.policy.delete({ where: { id } })

    if (existing) {
      await writeAuditLog({
        actorId,
        action: 'DELETE',
        entityType: 'POLICY',
        entityId: existing.id,
        summary: `Deleted policy "${existing.title}"`,
        req,
      })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete policy')
  }
}
