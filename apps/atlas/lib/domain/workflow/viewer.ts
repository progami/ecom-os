import { prisma } from '@/lib/prisma'
import { HR_ROLE_NAMES, PermissionLevel } from '@/lib/permissions'

export async function getViewerContext(employeeId: string): Promise<{
  employeeId: string
  isSuperAdmin: boolean
  isHR: boolean
}> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      isSuperAdmin: true,
      permissionLevel: true,
      roles: { select: { name: true } },
    },
  })

  const isSuperAdmin = Boolean(employee?.isSuperAdmin)
  const permissionLevel = employee?.permissionLevel ?? 0
  const isHR = Boolean(
    employee &&
      ((permissionLevel >= PermissionLevel.HR && permissionLevel < PermissionLevel.SUPER_ADMIN) ||
        employee.roles.some((r) => HR_ROLE_NAMES.includes(r.name)))
  )

  return { employeeId, isSuperAdmin, isHR }
}
