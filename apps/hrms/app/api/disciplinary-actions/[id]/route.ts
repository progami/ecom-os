import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { UpdateDisciplinaryActionSchema } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canManageEmployee } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const item = await prisma.disciplinaryAction.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            position: true,
            email: true,
          },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch disciplinary action')
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // Check if current user has permission to manage this employee
    const existing = await prisma.disciplinaryAction.findUnique({
      where: { id },
      select: { employeeId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    const permissionCheck = await canManageEmployee(currentEmployeeId, existing.employeeId)
    if (!permissionCheck.canManage) {
      return NextResponse.json(
        { error: `Permission denied: ${permissionCheck.reason}` },
        { status: 403 }
      )
    }

    const body = await req.json()

    const validation = validateBody(UpdateDisciplinaryActionSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data
    const updates: Record<string, unknown> = {}

    if (data.violationType !== undefined) updates.violationType = data.violationType
    if (data.violationReason !== undefined) updates.violationReason = data.violationReason
    if (data.severity !== undefined) updates.severity = data.severity
    if (data.valuesBreached !== undefined) updates.valuesBreached = data.valuesBreached
    if (data.employeeTookOwnership !== undefined) updates.employeeTookOwnership = data.employeeTookOwnership
    if (data.incidentDate !== undefined) updates.incidentDate = new Date(data.incidentDate)
    if (data.reportedBy !== undefined) updates.reportedBy = data.reportedBy
    if (data.description !== undefined) updates.description = data.description
    if (data.witnesses !== undefined) updates.witnesses = data.witnesses
    if (data.evidence !== undefined) updates.evidence = data.evidence
    if (data.actionTaken !== undefined) updates.actionTaken = data.actionTaken
    if (data.actionDate !== undefined) updates.actionDate = data.actionDate ? new Date(data.actionDate) : null
    if (data.actionDetails !== undefined) updates.actionDetails = data.actionDetails
    if (data.followUpDate !== undefined) updates.followUpDate = data.followUpDate ? new Date(data.followUpDate) : null
    if (data.followUpNotes !== undefined) updates.followUpNotes = data.followUpNotes
    if (data.status !== undefined) updates.status = data.status
    if (data.resolution !== undefined) updates.resolution = data.resolution

    const item = await prisma.disciplinaryAction.update({
      where: { id },
      data: updates,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    })

    return NextResponse.json(item)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update disciplinary action')
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // Check if current user has permission to manage this employee
    const existing = await prisma.disciplinaryAction.findUnique({
      where: { id },
      select: { employeeId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    const permissionCheck = await canManageEmployee(currentEmployeeId, existing.employeeId)
    if (!permissionCheck.canManage) {
      return NextResponse.json(
        { error: `Permission denied: ${permissionCheck.reason}` },
        { status: 403 }
      )
    }

    await prisma.disciplinaryAction.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete disciplinary action')
  }
}
