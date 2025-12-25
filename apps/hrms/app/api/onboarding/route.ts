import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { computeChecklistProgress } from '@/lib/domain/checklists/checklist-service'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isHR = await isHROrAbove(actorId)
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [templates, instancesRaw, employeesRaw] = await Promise.all([
      prisma.checklistTemplate.findMany({
        where: { lifecycleType: 'ONBOARDING', isActive: true },
        orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
        select: { id: true, name: true, lifecycleType: true, version: true, isActive: true, updatedAt: true },
        take: 20,
      }),
      prisma.checklistInstance.findMany({
        where: { lifecycleType: 'ONBOARDING' },
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
        include: {
          template: { select: { id: true, name: true, version: true } },
          employee: { select: { id: true, employeeId: true, firstName: true, lastName: true, joinDate: true, department: true, position: true, avatar: true } },
          items: { select: { status: true } },
        },
      }),
      prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ joinDate: 'desc' }],
        take: 200,
        select: { id: true, employeeId: true, firstName: true, lastName: true, joinDate: true, department: true, position: true, avatar: true },
      }),
    ])

    const instances = instancesRaw.map((i) => ({
      id: i.id,
      anchorDate: i.anchorDate,
      createdAt: i.createdAt,
      template: i.template,
      employee: i.employee,
      progress: computeChecklistProgress(i.items),
    }))

    const onboardingEmployeeIds = new Set(instancesRaw.map((i) => i.employeeId))
    const employeesWithoutOnboarding = employeesRaw.filter((e) => !onboardingEmployeeIds.has(e.id))

    return NextResponse.json({
      templates,
      instances,
      employeesWithoutOnboarding,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch onboarding overview')
  }
}

