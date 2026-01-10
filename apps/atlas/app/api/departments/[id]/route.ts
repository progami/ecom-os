import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  const { id } = await params

  try {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        head: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
            avatar: true,
          },
        },
        parent: true,
        children: {
          include: {
            head: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        employees: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            position: true,
            avatar: true,
          },
        },
      },
    })

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    return NextResponse.json(department)
  } catch (e) {
    console.error('[Department] Error:', e)
    return NextResponse.json({ error: 'Failed to fetch department' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  const { id } = await params

  try {
    // Security: Only HR or super-admin can update departments
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasPermission = await isHROrAbove(actorId)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Only HR or super admin can update departments' }, { status: 403 })
    }

    const body = await req.json()
    const { name, code, kpi, headId, parentId } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (code !== undefined) updates.code = code || null
    if (kpi !== undefined) updates.kpi = kpi || null
    if (headId !== undefined) updates.headId = headId || null
    if (parentId !== undefined) updates.parentId = parentId || null

    const department = await prisma.department.update({
      where: { id },
      data: updates,
      include: {
        head: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(department)
  } catch (e: any) {
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Department name already exists' }, { status: 400 })
    }
    console.error('[Department] Error:', e)
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  const { id } = await params

  try {
    // Security: Only HR or super-admin can delete departments
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasPermission = await isHROrAbove(actorId)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Only HR or super admin can delete departments' }, { status: 403 })
    }

    await prisma.department.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }
    console.error('[Department] Error:', e)
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
  }
}
