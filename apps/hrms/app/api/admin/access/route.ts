import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isSuperAdmin } from '@/lib/permissions'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'

const HR_ROLE_NAMES = ['HR', 'HR_ADMIN', 'HR Admin', 'Human Resources']

/**
 * GET /api/admin/access
 * List all employees with their access levels (Super Admin only)
 */
export async function GET(request: NextRequest) {
  const rateLimitError = withRateLimit(request)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admins can access this endpoint
    const isAdmin = await isSuperAdmin(currentEmployeeId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Super Admin access required' }, { status: 403 })
    }

    // Get all active employees with their roles
    const employees = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        position: true,
        avatar: true,
        isSuperAdmin: true,
        permissionLevel: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })

    // Transform to include isHR flag
    const items = employees.map((emp) => ({
      ...emp,
      isHR: emp.permissionLevel >= 75 || emp.roles.some((r) => HR_ROLE_NAMES.includes(r.name)),
      hrRoleId: emp.roles.find((r) => HR_ROLE_NAMES.includes(r.name))?.id || null,
    }))

    return NextResponse.json({
      items,
      total: items.length,
      currentUserId: currentEmployeeId,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch access list')
  }
}
