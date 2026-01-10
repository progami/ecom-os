import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { getOrgVisibleEmployeeIds, isHROrAbove } from '@/lib/permissions'

// Departments to exclude from the organogram hierarchy view
const EXCLUDED_DEPARTMENTS = ['executive supervision', 'general']

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isHR = await isHROrAbove(actorId)
    const visibleIds = isHR ? null : await getOrgVisibleEmployeeIds(actorId)

    // Fetch all departments with their heads and parent relationships
    // Exclude administrative/placeholder departments from the hierarchy
    const departments = await prisma.department.findMany({
      where: {
        NOT: {
          name: {
            in: EXCLUDED_DEPARTMENTS,
            mode: 'insensitive',
          },
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        kpi: true,
        headId: true,
        parentId: true,
        head: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
            avatar: true,
            employmentType: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          where: {
            NOT: {
              name: {
                in: EXCLUDED_DEPARTMENTS,
                mode: 'insensitive',
              },
            },
          },
          select: {
            id: true,
            name: true,
          },
        },
        employees: {
          ...(visibleIds ? { where: { id: { in: visibleIds } } } : {}),
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            position: true,
            employmentType: true,
            avatar: true,
          },
          orderBy: { firstName: 'asc' },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    if (!visibleIds) {
      return NextResponse.json({ items: departments })
    }

    const sanitized = departments.map((dept) => {
      if (dept.headId && dept.head && !visibleIds.includes(dept.headId)) {
        return { ...dept, head: null }
      }
      return dept
    })

    return NextResponse.json({ items: sanitized })
  } catch (e) {
    console.error('[Departments Hierarchy] Error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch department hierarchy' },
      { status: 500 }
    )
  }
}
