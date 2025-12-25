import { prisma } from '@/lib/prisma'
import { PermissionLevel } from '@/lib/permissions'

const HR_ROLE_NAMES = ['HR', 'HR_ADMIN', 'HR Admin', 'Human Resources']

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
  const isHR = isSuperAdmin ||
    Boolean(employee && (employee.permissionLevel >= PermissionLevel.HR || employee.roles.some((r) => HR_ROLE_NAMES.includes(r.name))))

  return { employeeId, isSuperAdmin, isHR }
}

