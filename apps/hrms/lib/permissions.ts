import { prisma } from './prisma'

export type PermissionCheckResult = {
  canManage: boolean
  reason?: string
}

/**
 * Check if a user can manage (review/discipline) an employee
 *
 * A user can manage an employee if:
 * 1. They are the direct manager (employee.reportsToId === currentUserId)
 * 2. They are in the management chain (manager's manager, etc.)
 * 3. They are the head of the employee's department
 * 4. They have an ADMIN role
 */
export async function canManageEmployee(
  currentUserId: string,
  targetEmployeeId: string
): Promise<PermissionCheckResult> {
  // Can't manage yourself
  if (currentUserId === targetEmployeeId) {
    return { canManage: false, reason: 'Cannot manage yourself' }
  }

  // Get target employee details
  const targetEmployee = await prisma.employee.findUnique({
    where: { id: targetEmployeeId },
    select: {
      id: true,
      reportsToId: true,
      departmentId: true,
    },
  })

  if (!targetEmployee) {
    return { canManage: false, reason: 'Employee not found' }
  }

  // Check 1: Direct manager
  if (targetEmployee.reportsToId === currentUserId) {
    return { canManage: true, reason: 'Direct manager' }
  }

  // Check 2: In management chain (walk up the tree)
  let managerId = targetEmployee.reportsToId
  const visited = new Set<string>()
  while (managerId) {
    if (visited.has(managerId)) break // Prevent infinite loops
    visited.add(managerId)

    if (managerId === currentUserId) {
      return { canManage: true, reason: 'In management chain' }
    }

    const manager = await prisma.employee.findUnique({
      where: { id: managerId },
      select: { reportsToId: true },
    })
    managerId = manager?.reportsToId ?? null
  }

  // Check 3: Department head
  if (targetEmployee.departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: targetEmployee.departmentId },
      select: { headId: true },
    })
    if (department?.headId === currentUserId) {
      return { canManage: true, reason: 'Department head' }
    }
  }

  // Check 4: Has ADMIN role
  const currentUser = await prisma.employee.findUnique({
    where: { id: currentUserId },
    select: {
      roles: {
        where: { name: { in: ['ADMIN', 'Admin', 'admin', 'HR_ADMIN', 'HR Admin'] } },
        select: { name: true },
      },
    },
  })
  if (currentUser?.roles && currentUser.roles.length > 0) {
    return { canManage: true, reason: 'Admin role' }
  }

  return { canManage: false, reason: 'No management relationship' }
}

/**
 * Get all employees that a user can manage
 */
export async function getManageableEmployees(currentUserId: string) {
  const currentUser = await prisma.employee.findUnique({
    where: { id: currentUserId },
    select: {
      id: true,
      roles: {
        where: { name: { in: ['ADMIN', 'Admin', 'admin', 'HR_ADMIN', 'HR Admin'] } },
        select: { name: true },
      },
    },
  })

  // If admin, return all employees except self
  if (currentUser?.roles && currentUser.roles.length > 0) {
    return prisma.employee.findMany({
      where: {
        id: { not: currentUserId },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        department: true,
        position: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })
  }

  // Get direct reports
  const directReports = await prisma.employee.findMany({
    where: {
      reportsToId: currentUserId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      department: true,
      position: true,
    },
  })

  // Get indirect reports (reports of direct reports, recursively)
  const allReports = new Map<string, typeof directReports[0]>()
  for (const report of directReports) {
    allReports.set(report.id, report)
  }

  // BFS to find all indirect reports
  const queue = directReports.map(r => r.id)
  while (queue.length > 0) {
    const managerId = queue.shift()!
    const indirectReports = await prisma.employee.findMany({
      where: {
        reportsToId: managerId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        department: true,
        position: true,
      },
    })
    for (const report of indirectReports) {
      if (!allReports.has(report.id)) {
        allReports.set(report.id, report)
        queue.push(report.id)
      }
    }
  }

  // Get employees in departments led by current user
  const ledDepartments = await prisma.department.findMany({
    where: { headId: currentUserId },
    select: { id: true },
  })

  if (ledDepartments.length > 0) {
    const deptEmployees = await prisma.employee.findMany({
      where: {
        departmentId: { in: ledDepartments.map(d => d.id) },
        id: { not: currentUserId },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        department: true,
        position: true,
      },
    })
    for (const emp of deptEmployees) {
      allReports.set(emp.id, emp)
    }
  }

  // Sort and return
  return Array.from(allReports.values()).sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  )
}

/**
 * Check if user has admin role
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.employee.findUnique({
    where: { id: userId },
    select: {
      roles: {
        where: { name: { in: ['ADMIN', 'Admin', 'admin', 'HR_ADMIN', 'HR Admin'] } },
        select: { name: true },
      },
    },
  })
  return (user?.roles?.length ?? 0) > 0
}
