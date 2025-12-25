import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { instantiateChecklistForEmployee, computeChecklistProgress } from '@/lib/domain/checklists/checklist-service'

const ChecklistLifecycleTypeEnum = z.enum(['ONBOARDING', 'OFFBOARDING'])

const CreateChecklistInstanceSchema = z.object({
  employeeId: z.string().min(1).max(100),
  lifecycleType: ChecklistLifecycleTypeEnum,
  templateId: z.string().min(1).max(100).optional(),
})

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isHR = await isHROrAbove(actorId)
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const lifecycleType = ChecklistLifecycleTypeEnum.safeParse(searchParams.get('lifecycleType')?.toUpperCase()).success
      ? (searchParams.get('lifecycleType')!.toUpperCase() as 'ONBOARDING' | 'OFFBOARDING')
      : undefined

    const items = await prisma.checklistInstance.findMany({
      where: lifecycleType ? { lifecycleType } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      include: {
        template: { select: { id: true, name: true, lifecycleType: true, version: true } },
        employee: { select: { id: true, employeeId: true, firstName: true, lastName: true, joinDate: true, department: true, position: true, avatar: true } },
        items: { select: { status: true } },
      },
    })

    const formatted = items.map((i) => {
      const progress = computeChecklistProgress(i.items)
      return {
        id: i.id,
        lifecycleType: i.lifecycleType,
        anchorDate: i.anchorDate,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        template: i.template,
        employee: i.employee,
        progress,
      }
    })

    return NextResponse.json({ items: formatted, total: formatted.length })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch checklists')
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
    const validation = validateBody(CreateChecklistInstanceSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const res = await instantiateChecklistForEmployee({
      employeeId: data.employeeId,
      lifecycleType: data.lifecycleType,
      actorId,
      templateId: data.templateId,
    })

    return NextResponse.json(res, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create checklist')
  }
}

