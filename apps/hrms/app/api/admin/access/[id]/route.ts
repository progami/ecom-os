import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isSuperAdmin } from '@/lib/permissions'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'

const HR_ROLE_NAME = 'HR'

/**
 * PATCH /api/admin/access/[id]
 * Update employee access levels (Super Admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: targetEmployeeId } = await params
    const body = await request.json()
    const { isSuperAdmin: newSuperAdminStatus, isHR: newHRStatus } = body

    // Validate target employee exists
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
        roles: {
          where: { name: HR_ROLE_NAME },
          select: { id: true },
        },
      },
    })

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Prevent removing your own Super Admin status
    if (currentEmployeeId === targetEmployeeId && newSuperAdminStatus === false && targetEmployee.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Cannot remove your own Super Admin status' },
        { status: 400 }
      )
    }

    // Update Super Admin status if provided
    if (typeof newSuperAdminStatus === 'boolean') {
      await prisma.employee.update({
        where: { id: targetEmployeeId },
        data: {
          isSuperAdmin: newSuperAdminStatus,
          // Also update permission level for consistency
          permissionLevel: newSuperAdminStatus ? 100 : (newHRStatus ? 75 : 0),
        },
      })
    }

    // Update HR role if provided
    if (typeof newHRStatus === 'boolean') {
      // Find or create HR role
      let hrRole = await prisma.role.findUnique({
        where: { name: HR_ROLE_NAME },
      })

      if (!hrRole) {
        hrRole = await prisma.role.create({
          data: {
            name: HR_ROLE_NAME,
            description: 'Human Resources - Can review violations and access employee records',
          },
        })
      }

      const hasHRRole = targetEmployee.roles.length > 0

      if (newHRStatus && !hasHRRole) {
        // Add HR role
        await prisma.employee.update({
          where: { id: targetEmployeeId },
          data: {
            roles: {
              connect: { id: hrRole.id },
            },
            // Update permission level if not already Super Admin
            permissionLevel: newSuperAdminStatus === true || targetEmployee.isSuperAdmin ? 100 : 75,
          },
        })
      } else if (!newHRStatus && hasHRRole) {
        // Remove HR role
        await prisma.employee.update({
          where: { id: targetEmployeeId },
          data: {
            roles: {
              disconnect: { id: hrRole.id },
            },
            // Update permission level if not Super Admin
            permissionLevel: newSuperAdminStatus === true || targetEmployee.isSuperAdmin ? 100 : 0,
          },
        })
      }
    }

    // Fetch updated employee
    const updatedEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
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
    })

    return NextResponse.json({
      success: true,
      employee: updatedEmployee,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update access')
  }
}
