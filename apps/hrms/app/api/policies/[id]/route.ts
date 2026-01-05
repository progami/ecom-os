import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { UpdatePolicySchema, bumpVersion } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { getViewerContext } from '@/lib/domain/workflow/viewer'
import { policyToWorkflowRecordDTO } from '@/lib/domain/policies/workflow-record'

type PolicyRouteContext = { params: Promise<{ id: string }> }

function mapEmployeeRegionToPolicyRegion(region: string): 'KANSAS_US' | 'PAKISTAN' | null {
  if (region === 'PAKISTAN') return 'PAKISTAN'
  if (region === 'KANSAS_USA') return 'KANSAS_US'
  return null
}

export async function GET(req: Request, context: PolicyRouteContext) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format')
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const p = await prisma.policy.findUnique({ where: { id } })

    if (!p) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (format === 'workflow') {
      const employeeId = await getCurrentEmployeeId()
      if (!employeeId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const viewer = await getViewerContext(employeeId)
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { region: true },
      })

      const mappedRegion = employee ? mapEmployeeRegionToPolicyRegion(employee.region) : null
      const isApplicable =
        p.region === 'ALL' || (mappedRegion !== null && p.region === mappedRegion)

      const ack = await prisma.policyAcknowledgement.findUnique({
        where: {
          policyId_employeeId_policyVersion: {
            policyId: p.id,
            employeeId,
            policyVersion: p.version,
          },
        },
        select: { acknowledgedAt: true },
      })

      const dto = await policyToWorkflowRecordDTO(p as any, viewer, {
        isApplicable,
        isAcknowledged: Boolean(ack),
        acknowledgedAt: ack?.acknowledgedAt ?? null,
      })
      return NextResponse.json(dto)
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

    const notificationType = data.status === 'ARCHIVED' ? 'POLICY_ARCHIVED' : 'POLICY_UPDATED'
    const verb = notificationType === 'POLICY_ARCHIVED' ? 'archived' : 'updated'

    await prisma.notification.create({
      data: {
        type: notificationType,
        title: notificationType === 'POLICY_ARCHIVED' ? 'Policy Archived' : 'Policy Updated',
        message: `The policy "${p.title}" has been ${verb}.`,
        link: `/policies/${p.id}`,
        employeeId: null, // Broadcast
        relatedId: p.id,
        relatedType: 'POLICY',
      },
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

    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete policy')
  }
}
