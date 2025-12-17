import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentEmployeeId } from '@/lib/current-user'

/**
 * GET /api/me
 * Get current user info for client-side navigation and permissions
 */
export async function GET() {
  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        isSuperAdmin: true,
        permissionLevel: true,
        roles: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const HR_ROLE_NAMES = ['HR', 'HR_ADMIN', 'HR Admin', 'Human Resources']
    const isHR = employee.permissionLevel >= 75 || employee.roles.some((r) => HR_ROLE_NAMES.includes(r.name))

    return NextResponse.json({
      id: employee.id,
      employeeId: employee.employeeId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      avatar: employee.avatar,
      isSuperAdmin: employee.isSuperAdmin,
      isHR,
    })
  } catch (e) {
    console.error('Failed to get current user:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
