import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { getViewerContext } from '@/lib/domain/workflow/viewer'
import { getChecklistWorkflowRecord } from '@/lib/domain/checklists/workflow-record'
import { isManagerOf } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

async function canViewChecklist(params: {
  instanceEmployeeId: string
  instanceEmployeeManagerId: string | null
  viewer: { employeeId: string; isHR: boolean; isSuperAdmin: boolean }
}): Promise<boolean> {
  if (params.viewer.isHR || params.viewer.isSuperAdmin) return true
  if (params.viewer.employeeId === params.instanceEmployeeId) return true
  if (params.instanceEmployeeManagerId && params.instanceEmployeeManagerId === params.viewer.employeeId) return true
  return isManagerOf(params.viewer.employeeId, params.instanceEmployeeId)
}

export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    if (!id || id.length > 100) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const viewer = await getViewerContext(actorId)
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format')

    if (format === 'workflow') {
      const dto = await getChecklistWorkflowRecord({ id, viewer })
      return NextResponse.json(dto)
    }

    const instance = await prisma.checklistInstance.findUnique({
      where: { id },
      include: {
        template: { select: { id: true, name: true, lifecycleType: true, version: true } },
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            position: true,
            avatar: true,
            reportsToId: true,
          },
        },
        items: {
          orderBy: { templateItem: { sortOrder: 'asc' } },
          include: {
            templateItem: true,
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                dueDate: true,
                assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
              },
            },
          },
        },
      },
    })

    if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const allowed = await canViewChecklist({
      instanceEmployeeId: instance.employeeId,
      instanceEmployeeManagerId: instance.employee.reportsToId ?? null,
      viewer,
    })

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(instance)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch checklist')
  }
}

