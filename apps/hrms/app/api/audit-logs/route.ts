import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove } from '@/lib/permissions'

const AuditActionEnum = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'ACKNOWLEDGE',
  'ASSIGN',
  'COMMENT',
  'ATTACH',
  'COMPLETE',
])

const AuditEntityTypeEnum = z.enum([
  'EMPLOYEE',
  'POLICY',
  'POLICY_ACKNOWLEDGEMENT',
  'LEAVE_REQUEST',
  'PERFORMANCE_REVIEW',
  'DISCIPLINARY_ACTION',
  'CASE',
  'CASE_NOTE',
  'CASE_ATTACHMENT',
  'TASK',
  'NOTIFICATION',
])

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canView = await isHROrAbove(actorId)
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const takeRaw = searchParams.get('take')
    const skipRaw = searchParams.get('skip')
    const entityTypeRaw = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const actionRaw = searchParams.get('action')
    const actorFilterId = searchParams.get('actorId')

    const take = Math.min(parseInt(takeRaw ?? '50', 10), 200)
    const skip = parseInt(skipRaw ?? '0', 10)

    const where: any = {}

    if (entityId) where.entityId = entityId
    if (actorFilterId) where.actorId = actorFilterId

    if (entityTypeRaw) {
      const parsed = AuditEntityTypeEnum.safeParse(entityTypeRaw.toUpperCase())
      if (parsed.success) where.entityType = parsed.data
    }

    if (actionRaw) {
      const parsed = AuditActionEnum.safeParse(actionRaw.toUpperCase())
      if (parsed.success) where.action = parsed.data
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, avatar: true, employeeId: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch audit logs')
  }
}

