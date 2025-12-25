import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

const ChecklistLifecycleTypeEnum = z.enum(['ONBOARDING', 'OFFBOARDING'])
const ChecklistOwnerTypeEnum = z.enum(['HR', 'MANAGER', 'IT', 'EMPLOYEE'])

const ChecklistTemplateItemInputSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional().nullable(),
  ownerType: ChecklistOwnerTypeEnum,
  dueOffsetDays: z.number().int().min(0).max(365).optional().default(0),
  evidenceRequired: z.boolean().optional().default(false),
  dependsOnIndex: z.number().int().min(0).optional().nullable(),
})

const CreateChecklistTemplateSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  lifecycleType: ChecklistLifecycleTypeEnum,
  isActive: z.boolean().optional().default(true),
  items: z.array(ChecklistTemplateItemInputSchema).min(1).max(100),
})

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isHR = await isHROrAbove(actorId)
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const templates = await prisma.checklistTemplate.findMany({
      orderBy: [{ lifecycleType: 'asc' }, { isActive: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        lifecycleType: true,
        version: true,
        isActive: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { items: true, instances: true } },
      },
    })

    return NextResponse.json({ items: templates, total: templates.length })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch checklist templates')
  }
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isHR = await isHROrAbove(actorId)
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const validation = validateBody(CreateChecklistTemplateSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.checklistTemplate.create({
        data: {
          name: data.name,
          lifecycleType: data.lifecycleType,
          isActive: data.isActive,
        },
        select: { id: true, name: true, lifecycleType: true, version: true },
      })

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
            templateId: created.id,
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

      await writeAuditLog({
        actorId,
        action: 'CREATE',
        entityType: 'CHECKLIST_TEMPLATE',
        entityId: created.id,
        summary: `Created checklist template "${created.name}"`,
        metadata: { lifecycleType: created.lifecycleType, version: created.version, itemCount: data.items.length },
        req,
        client: tx,
      })

      return tx.checklistTemplate.findUnique({
        where: { id: created.id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      })
    })

    return NextResponse.json(template, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create checklist template')
  }
}

