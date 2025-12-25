import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

const ChecklistOwnerTypeEnum = z.enum(['HR', 'MANAGER', 'IT', 'EMPLOYEE'])

const ChecklistTemplateItemInputSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional().nullable(),
  ownerType: ChecklistOwnerTypeEnum,
  dueOffsetDays: z.number().int().min(0).max(365).optional().default(0),
  evidenceRequired: z.boolean().optional().default(false),
  dependsOnIndex: z.number().int().min(0).optional().nullable(),
})

const UpdateChecklistTemplateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  isActive: z.boolean().optional(),
  items: z.array(ChecklistTemplateItemInputSchema).min(1).max(100).optional(),
})

export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    if (!id || id.length > 100) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isHR = await isHROrAbove(actorId)
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const template = await prisma.checklistTemplate.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } }, _count: { select: { instances: true } } },
    })

    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(template)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch checklist template')
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    if (!id || id.length > 100) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isHR = await isHROrAbove(actorId)
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const validation = validateBody(UpdateChecklistTemplateSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.checklistTemplate.findUnique({
        where: { id },
        select: { id: true, name: true, lifecycleType: true, version: true },
      })
      if (!existing) return null

      if (data.items) {
        const instancesCount = await tx.checklistInstance.count({ where: { templateId: id } })
        if (instancesCount > 0) {
          throw new Error('Cannot edit items for a template that already has instances. Create a new template version instead.')
        }

        await tx.checklistTemplateItem.deleteMany({ where: { templateId: id } })

        const createdItemIds: string[] = []
        for (let index = 0; index < data.items.length; index += 1) {
          const item = data.items[index]!
          const dependsOnIndex = item.dependsOnIndex ?? null
          if (dependsOnIndex != null && dependsOnIndex >= index) {
            throw new Error('dependsOnIndex must reference a previous item.')
          }
          const dependsOnItemId = dependsOnIndex != null ? createdItemIds[dependsOnIndex] ?? null : null

          const createdItem = await tx.checklistTemplateItem.create({
            data: {
              templateId: id,
              title: item.title,
              description: item.description ?? null,
              sortOrder: index + 1,
              ownerType: item.ownerType,
              dueOffsetDays: item.dueOffsetDays,
              evidenceRequired: item.evidenceRequired,
              dependsOnItemId,
            },
            select: { id: true },
          })
          createdItemIds.push(createdItem.id)
        }
      }

      const template = await tx.checklistTemplate.update({
        where: { id },
        data: {
          name: data.name,
          isActive: data.isActive,
          ...(data.items ? { version: { increment: 1 } } : {}),
        },
      })

      await writeAuditLog({
        actorId,
        action: 'UPDATE',
        entityType: 'CHECKLIST_TEMPLATE',
        entityId: template.id,
        summary: `Updated checklist template "${template.name}"`,
        metadata: {
          changed: Object.keys(data),
          version: template.version,
        },
        req,
        client: tx,
      })

      return tx.checklistTemplate.findUnique({
        where: { id },
        include: { items: { orderBy: { sortOrder: 'asc' } }, _count: { select: { instances: true } } },
      })
    })

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update checklist template')
  }
}

