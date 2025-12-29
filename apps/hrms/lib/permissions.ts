import { prisma } from './prisma'
import { FIELD_PERMISSIONS, getEmployeeFieldOwnership, type AttributePermission } from './employee/field-ownership'

export { FIELD_PERMISSIONS, getEmployeeFieldOwnership }
export type { AttributePermission }

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
 * 4. They are HR or Super Admin
 * 5. They have an ADMIN role
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

  const actor = await prisma.employee.findUnique({
    where: { id: currentUserId },
    select: {
      isSuperAdmin: true,
      permissionLevel: true,
      roles: {
        where: { name: { in: [...HR_ROLE_NAMES, 'ADMIN', 'Admin', 'admin'] } },
        select: { name: true },
      },
    },
  })

  if (actor?.isSuperAdmin) {
    return { canManage: true, reason: 'Super Admin' }
  }

  if ((actor?.permissionLevel ?? 0) >= PermissionLevel.HR) {
    return { canManage: true, reason: 'HR' }
  }

  if ((actor?.roles?.length ?? 0) > 0) {
    return { canManage: true, reason: 'HR/Admin role' }
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
      isSuperAdmin: true,
      permissionLevel: true,
      roles: {
        where: { name: { in: [...HR_ROLE_NAMES, 'ADMIN', 'Admin', 'admin'] } },
        select: { name: true },
      },
    },
  })

  // If admin, return all employees except self
  const isHRLike = currentUser?.isSuperAdmin ||
    (currentUser?.permissionLevel ?? 0) >= PermissionLevel.HR ||
    (currentUser?.roles?.length ?? 0) > 0

  if (isHRLike) {
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

// ============ N-ARY TREE PERMISSION MODEL ============

/**
 * Get all employee IDs in the management chain above an employee
 * Returns array from immediate manager up to root
 */
export async function getManagerChain(employeeId: string): Promise<string[]> {
  const chain: string[] = []
  let currentId: string | null = employeeId
  const visited = new Set<string>()

  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)

    const employee: { reportsToId: string | null } | null = await prisma.employee.findUnique({
      where: { id: currentId },
      select: { reportsToId: true }
    })

    if (employee?.reportsToId) {
      chain.push(employee.reportsToId)
      currentId = employee.reportsToId
    } else {
      currentId = null
    }
  }

  return chain
}

/**
 * Get all employee IDs in the subtree under a manager (all direct and indirect reports)
 */
export async function getSubtreeEmployeeIds(managerId: string): Promise<string[]> {
  const subtree: string[] = []
  const queue: string[] = [managerId]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const directReports = await prisma.employee.findMany({
      where: { reportsToId: currentId },
      select: { id: true }
    })

    for (const report of directReports) {
      subtree.push(report.id)
      queue.push(report.id)
    }
  }

  return subtree
}

/**
 * Check if actor is in the management chain above target employee
 */
export async function isManagerOf(actorId: string, targetEmployeeId: string): Promise<boolean> {
  if (actorId === targetEmployeeId) return false
  const managerChain = await getManagerChain(targetEmployeeId)
  return managerChain.includes(actorId)
}

/**
 * Check if actor is super admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const user = await prisma.employee.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true }
  })
  return user?.isSuperAdmin ?? false
}

/**
 * Check if actor can modify a specific field on target employee
 */
export async function canEditField(
  actorId: string,
  targetEmployeeId: string,
  fieldName: string
): Promise<{ allowed: boolean; reason?: string }> {
  const permission = FIELD_PERMISSIONS[fieldName]

  if (!permission) {
    // Unknown field - allow by default (may be custom field)
    return { allowed: true }
  }

  // Google controlled fields cannot be edited by anyone
  if (permission === 'GOOGLE_CONTROLLED') {
    const ownership = getEmployeeFieldOwnership(fieldName)
    return {
      allowed: false,
      reason: ownership?.lockedReason ?? 'This field is managed by the system and cannot be edited',
    }
  }

  const actor = await prisma.employee.findUnique({
    where: { id: actorId },
    select: {
      id: true,
      isSuperAdmin: true,
      permissionLevel: true,
      roles: {
        where: { name: { in: HR_ROLE_NAMES } },
        select: { name: true },
      },
    },
  })

  if (!actor) {
    return { allowed: false, reason: 'Actor not found' }
  }

  const isHRLike = actor.isSuperAdmin ||
    actor.permissionLevel >= PermissionLevel.HR ||
    (actor.roles?.length ?? 0) > 0

  // Employees cannot edit their own profile unless they are HR or Super Admin.
  if (actorId === targetEmployeeId && !isHRLike) {
    return { allowed: false, reason: 'Self-editing is disabled. Contact HR for changes.' }
  }

  // User editable: managers/HR can edit (self-edit disabled)
  if (permission === 'USER_EDITABLE') {
    // Managers, HR, and Super Admin can edit user-editable fields
    if (isHRLike || await isManagerOf(actorId, targetEmployeeId)) {
      return { allowed: true }
    }
    return { allowed: false, reason: 'Only HR or your manager can edit this field' }
  }

  // Manager editable: only HR or super admin (NOT regular managers)
  // Manager role is now purely for org chart visualization
  if (permission === 'MANAGER_EDITABLE') {
    if (isHRLike) {
      return { allowed: true }
    }
    return { allowed: false, reason: 'Only HR and Super Admin can edit this field' }
  }

  return { allowed: false, reason: 'Permission denied' }
}

/**
 * Check if making newManagerId the manager of targetEmployeeId would create a cycle
 */
async function checkWouldCreateCycle(targetEmployeeId: string, newManagerId: string): Promise<boolean> {
  const subtree = await getSubtreeEmployeeIds(targetEmployeeId)
  return subtree.includes(newManagerId)
}

/**
 * Check if actor can reassign target employee to a new manager
 * Rules:
 * - Super admin can reassign anyone (including themselves)
 * - Non-super-admins cannot reassign themselves
 * - Manager can only reassign employees in their subtree
 * - Peers cannot move each other
 * - Cannot create cycles in the hierarchy
 */
export async function canReassignEmployee(
  actorId: string,
  targetEmployeeId: string,
  newManagerId: string | null
): Promise<{ allowed: boolean; reason?: string }> {
  const actor = await prisma.employee.findUnique({
    where: { id: actorId },
    select: { id: true, isSuperAdmin: true, reportsToId: true }
  })

  if (!actor) {
    return { allowed: false, reason: 'Actor not found' }
  }

  // Super admin can reassign anyone including themselves (but still check for cycles)
  if (actor.isSuperAdmin) {
    if (newManagerId) {
      const wouldCreateCycle = await checkWouldCreateCycle(targetEmployeeId, newManagerId)
      if (wouldCreateCycle) {
        return { allowed: false, reason: 'This reassignment would create a cycle in the hierarchy' }
      }
    }
    return { allowed: true }
  }

  // Non-super-admins cannot reassign themselves
  if (actorId === targetEmployeeId) {
    return { allowed: false, reason: 'You cannot reassign yourself' }
  }

  // Check if actor is above target in hierarchy
  const isAboveTarget = await isManagerOf(actorId, targetEmployeeId)
  if (!isAboveTarget) {
    const isTargetAboveActor = await isManagerOf(targetEmployeeId, actorId)
    if (isTargetAboveActor) {
      return { allowed: false, reason: 'You cannot reassign your own manager' }
    }
    return {
      allowed: false,
      reason: 'You can only reassign employees who report to you directly or indirectly'
    }
  }

  // If newManagerId is provided, verify actor can assign to that manager
  if (newManagerId && newManagerId !== actorId) {
    const isAboveNewManager = await isManagerOf(actorId, newManagerId)
    if (!isAboveNewManager) {
      return {
        allowed: false,
        reason: 'You can only reassign employees to managers within your team'
      }
    }
  }

  // Check for cycles
  if (newManagerId) {
    const wouldCreateCycle = await checkWouldCreateCycle(targetEmployeeId, newManagerId)
    if (wouldCreateCycle) {
      return { allowed: false, reason: 'This reassignment would create a cycle in the hierarchy' }
    }
  }

  return { allowed: true }
}

/**
 * Filter update payload to only include fields the actor can edit
 */
export async function filterAllowedFields(
  actorId: string,
  targetEmployeeId: string,
  updateData: Record<string, unknown>
): Promise<{ allowed: Record<string, unknown>; denied: { field: string; reason: string }[] }> {
  const allowed: Record<string, unknown> = {}
  const denied: { field: string; reason: string }[] = []

  for (const [field, value] of Object.entries(updateData)) {
    const result = await canEditField(actorId, targetEmployeeId, field)
    if (result.allowed) {
      allowed[field] = value
    } else {
      denied.push({ field, reason: result.reason || 'Permission denied' })
    }
  }

  return { allowed, denied }
}

/**
 * Calculate permission level based on position in hierarchy
 */
export async function calculatePermissionLevel(employeeId: string): Promise<number> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { isSuperAdmin: true, reportsToId: true }
  })

  if (!employee) return 0
  if (employee.isSuperAdmin) return 100

  const directReportsCount = await prisma.employee.count({
    where: { reportsToId: employeeId }
  })

  if (directReportsCount > 0) return 50 // Manager
  return 0 // Regular employee
}

// ============ APPROVAL CHAIN PERMISSION SYSTEM ============
// Workflow: Employee -> Manager -> HR -> Super Admin

/**
 * Permission level constants
 * Super Admin (100) > HR (75) > Manager (50) > Employee (0)
 */
export const PermissionLevel = {
  SUPER_ADMIN: 100,
  HR: 75,
  MANAGER: 50,
  EMPLOYEE: 0,
} as const

/**
 * HR role names recognized by the system
 */
const HR_ROLE_NAMES = ['HR', 'HR_ADMIN', 'HR Admin', 'Human Resources']

/**
 * Check if user is HR (permission level >= 75 or has HR role)
 */
export async function isHR(userId: string): Promise<boolean> {
  const user = await prisma.employee.findUnique({
    where: { id: userId },
    select: {
      permissionLevel: true,
      isSuperAdmin: true,
      roles: {
        where: { name: { in: HR_ROLE_NAMES } },
        select: { name: true },
      },
    },
  })

  if (!user) return false
  if (user.isSuperAdmin) return true
  if (user.permissionLevel >= PermissionLevel.HR) return true
  return (user.roles?.length ?? 0) > 0
}

/**
 * Check if user is HR or above (HR or Super Admin)
 */
export async function isHROrAbove(userId: string): Promise<boolean> {
  return isHR(userId)
}

/**
 * Check if user can RAISE a violation/review for an employee
 * - Manager can raise for their direct/indirect reports
 * - HR can raise for anyone
 * - Super Admin can raise for anyone
 */
export async function canRaiseViolation(
  actorId: string,
  targetEmployeeId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (actorId === targetEmployeeId) {
    return { allowed: false, reason: 'Cannot raise violation against yourself' }
  }

  const actor = await prisma.employee.findUnique({
    where: { id: actorId },
    select: {
      permissionLevel: true,
      isSuperAdmin: true,
      roles: {
        where: { name: { in: HR_ROLE_NAMES } },
        select: { name: true },
      },
    },
  })

  if (!actor) {
    return { allowed: false, reason: 'Actor not found' }
  }

  // Super Admin can raise for anyone
  if (actor.isSuperAdmin) {
    return { allowed: true, reason: 'Super Admin' }
  }

  // HR can raise for anyone
  if (actor.permissionLevel >= PermissionLevel.HR || (actor.roles?.length ?? 0) > 0) {
    return { allowed: true, reason: 'HR' }
  }

  // Managers can raise only for their direct/indirect reports (org-chart derived)
  const isManager = await isManagerOf(actorId, targetEmployeeId)
  if (isManager) {
    return { allowed: true, reason: 'Manager of employee' }
  }

  return { allowed: false, reason: 'You can only raise violations for employees who report to you' }
}

/**
 * Check if user can do HR-level review (HR or Super Admin)
 */
export async function canHRReview(actorId: string): Promise<{ allowed: boolean; reason?: string }> {
  const actor = await prisma.employee.findUnique({
    where: { id: actorId },
    select: {
      permissionLevel: true,
      isSuperAdmin: true,
      roles: {
        where: { name: { in: HR_ROLE_NAMES } },
        select: { name: true },
      },
    },
  })

  if (!actor) {
    return { allowed: false, reason: 'Actor not found' }
  }

  if (actor.isSuperAdmin) {
    return { allowed: true, reason: 'Super Admin' }
  }

  if (actor.permissionLevel >= PermissionLevel.HR || (actor.roles?.length ?? 0) > 0) {
    return { allowed: true, reason: 'HR' }
  }

  return { allowed: false, reason: 'Only HR can perform this action' }
}

/**
 * Check if user can do FINAL approval (Super Admin only)
 */
export async function canFinalApprove(actorId: string): Promise<{ allowed: boolean; reason?: string }> {
  const actor = await prisma.employee.findUnique({
    where: { id: actorId },
    select: { isSuperAdmin: true },
  })

  if (!actor) {
    return { allowed: false, reason: 'Actor not found' }
  }

  if (actor.isSuperAdmin) {
    return { allowed: true, reason: 'Super Admin' }
  }

  return { allowed: false, reason: 'Only Super Admin can perform final approval' }
}

/**
 * Check if user can edit employee records (HR or Super Admin only for org/employment fields)
 * Note: This is different from canEditField which checks field-level permissions
 */
export async function canEditEmployeeRecord(
  actorId: string,
  targetEmployeeId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const actor = await prisma.employee.findUnique({
    where: { id: actorId },
    select: {
      permissionLevel: true,
      isSuperAdmin: true,
      roles: {
        where: { name: { in: HR_ROLE_NAMES } },
        select: { name: true },
      },
    },
  })

  if (!actor) {
    return { allowed: false, reason: 'Actor not found' }
  }

  const isHRLike = actor.isSuperAdmin ||
    actor.permissionLevel >= PermissionLevel.HR ||
    (actor.roles?.length ?? 0) > 0

  // Self-editing is allowed for HR and Super Admin only.
  if (actorId === targetEmployeeId && !isHRLike) {
    return { allowed: false, reason: 'Self-editing is disabled. Contact HR for changes.' }
  }

  // Super Admin can edit anyone
  if (actor.isSuperAdmin) {
    return { allowed: true, reason: 'Super Admin' }
  }

  // HR can edit anyone (for org/employment changes, will go through approval)
  if (isHRLike) {
    return { allowed: true, reason: 'HR' }
  }

  return { allowed: false, reason: 'Only HR and Super Admin can edit employee records' }
}

/**
 * Get the role/level of a user for display purposes
 */
export async function getUserRole(userId: string): Promise<'SUPER_ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE'> {
  const user = await prisma.employee.findUnique({
    where: { id: userId },
    select: {
      permissionLevel: true,
      isSuperAdmin: true,
      roles: {
        where: { name: { in: HR_ROLE_NAMES } },
        select: { name: true },
      },
    },
  })

  if (!user) return 'EMPLOYEE'
  if (user.isSuperAdmin) return 'SUPER_ADMIN'
  if (user.permissionLevel >= PermissionLevel.HR || (user.roles?.length ?? 0) > 0) return 'HR'
  if (user.permissionLevel >= PermissionLevel.MANAGER) return 'MANAGER'
  return 'EMPLOYEE'
}

/**
 * Get all HR employees (for notifications)
 */
export async function getHREmployees(): Promise<{ id: string; email: string; firstName: string }[]> {
  return prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { permissionLevel: { gte: PermissionLevel.HR } },
        { roles: { some: { name: { in: HR_ROLE_NAMES } } } },
      ],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
    },
  })
}

/**
 * Get all Super Admin employees (for notifications)
 */
export async function getSuperAdminEmployees(): Promise<{ id: string; email: string; firstName: string }[]> {
  return prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      isSuperAdmin: true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
    },
  })
}

/**
 * Get all employees who are authorized to report violations for a given target employee
 * Authorized reporters are:
 * 1. Super Admins - can report for anyone
 * 2. HR employees (permissionLevel >= 75 or HR role) - can report for anyone
 * 3. Managers in the target's management chain - can report for their reports
 */
export async function getAuthorizedReporters(targetEmployeeId: string): Promise<{
  id: string
  employeeId: string
  firstName: string
  lastName: string
  position: string
}[]> {
  const reporters = new Map<string, {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    position: string
  }>()

  // 1. Get all Super Admins
  const superAdmins = await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      isSuperAdmin: true,
      id: { not: targetEmployeeId }, // Cannot report yourself
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      position: true,
    },
  })
  for (const emp of superAdmins) {
    reporters.set(emp.id, emp)
  }

  // 2. Get all HR employees
  const hrEmployees = await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      id: { not: targetEmployeeId },
      OR: [
        { permissionLevel: { gte: PermissionLevel.HR } },
        { roles: { some: { name: { in: HR_ROLE_NAMES } } } },
      ],
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      position: true,
    },
  })
  for (const emp of hrEmployees) {
    reporters.set(emp.id, emp)
  }

  // 3. Get all managers in the target's management chain
  const managerChain = await getManagerChain(targetEmployeeId)
  if (managerChain.length > 0) {
    const managers = await prisma.employee.findMany({
      where: {
        id: { in: managerChain },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        position: true,
      },
    })
    for (const emp of managers) {
      reporters.set(emp.id, emp)
    }
  }

  // Sort by name and return
  return Array.from(reporters.values()).sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  )
}
