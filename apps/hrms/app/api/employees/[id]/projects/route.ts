import { NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { isHROrAbove, canManageEmployee } from '@/lib/permissions'
import { getCurrentEmployeeId } from '@/lib/current-user'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/employees/[id]/projects
 * Get all project memberships for an employee
 */
export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Security: Allow HR/super-admin, or self, or managers in chain.
    const isHR = await isHROrAbove(actorId)
    if (!isHR && actorId !== id) {
      const permissionCheck = await canManageEmployee(actorId, id)
      if (!permissionCheck.canManage) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const memberships = await prisma.projectMember.findMany({
      where: { employeeId: id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })

    return NextResponse.json({ items: memberships })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch project memberships')
  }
}

/**
 * PUT /api/employees/[id]/projects
 * Replace all project memberships for an employee
 * Body: { memberships: [{ projectId: string, role?: string }] }
 */
export async function PUT(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // Security: Only HR/super-admin or direct manager can update employee projects
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const isHR = await isHROrAbove(actorId)
    const permissionCheck = isHR ? { canManage: true } : await canManageEmployee(actorId, id)
    if (!permissionCheck.canManage) {
      return NextResponse.json({ error: 'You do not have permission to manage this employee\'s projects' }, { status: 403 })
    }

    const body = await req.json()
    const { memberships } = body as { memberships: { projectId: string; role?: string }[] }

    if (!Array.isArray(memberships)) {
      return NextResponse.json({ error: 'memberships must be an array' }, { status: 400 })
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id },
    })
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Use transaction to replace all memberships
    await prisma.$transaction(async (tx) => {
      // Delete existing memberships
      await tx.projectMember.deleteMany({
        where: { employeeId: id },
      })

      // Create new memberships
      if (memberships.length > 0) {
        await tx.projectMember.createMany({
          data: memberships.map((m) => ({
            employeeId: id,
            projectId: m.projectId,
            role: m.role || null,
          })),
        })
      }
    })

    // Fetch and return updated memberships
    const updated = await prisma.projectMember.findMany({
      where: { employeeId: id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })

    return NextResponse.json({ items: updated })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update project memberships')
  }
}
