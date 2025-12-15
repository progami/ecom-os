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

// ============ N-ARY TREE PERMISSION MODEL ============

// Attribute permission types
export type AttributePermission =
  | 'GOOGLE_CONTROLLED'  // name, email - synced from Google, not editable
  | 'USER_EDITABLE'      // phone, address - employee can edit own
  | 'MANAGER_EDITABLE'   // role, project, department, reportsTo - manager+ only

// Field permission mapping
export const FIELD_PERMISSIONS: Record<string, AttributePermission> = {
  // Google controlled (read-only, comes from Google Admin)
  firstName: 'GOOGLE_CONTROLLED',
  lastName: 'GOOGLE_CONTROLLED',
  email: 'GOOGLE_CONTROLLED',
  googleId: 'GOOGLE_CONTROLLED',
  avatar: 'GOOGLE_CONTROLLED',

  // User editable (employee can edit their own)
  phone: 'USER_EDITABLE',
  address: 'USER_EDITABLE',
  city: 'USER_EDITABLE',
  country: 'USER_EDITABLE',
  postalCode: 'USER_EDITABLE',
  emergencyContact: 'USER_EDITABLE',
  emergencyPhone: 'USER_EDITABLE',
  dateOfBirth: 'USER_EDITABLE',
  gender: 'USER_EDITABLE',
  maritalStatus: 'USER_EDITABLE',
  nationality: 'USER_EDITABLE',

  // Manager editable (only manager or above can edit)
  department: 'MANAGER_EDITABLE',
  departmentId: 'MANAGER_EDITABLE',
  position: 'MANAGER_EDITABLE',
  employmentType: 'MANAGER_EDITABLE',
  joinDate: 'MANAGER_EDITABLE',
  status: 'MANAGER_EDITABLE',
  region: 'MANAGER_EDITABLE',
  reportsToId: 'MANAGER_EDITABLE',
  salary: 'MANAGER_EDITABLE',
  currency: 'MANAGER_EDITABLE',
  permissionLevel: 'MANAGER_EDITABLE',
  isSuperAdmin: 'MANAGER_EDITABLE',
}

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
    return { allowed: false, reason: 'This field is synced from Google Admin and cannot be edited' }
  }

  const actor = await prisma.employee.findUnique({
    where: { id: actorId },
    select: { id: true, isSuperAdmin: true, permissionLevel: true }
  })

  if (!actor) {
    return { allowed: false, reason: 'Actor not found' }
  }

  // User editable: employee can edit their own
  if (permission === 'USER_EDITABLE') {
    if (actorId === targetEmployeeId) {
      return { allowed: true }
    }
    // Managers and super admins can also edit user-editable fields
    if (actor.isSuperAdmin || await isManagerOf(actorId, targetEmployeeId)) {
      return { allowed: true }
    }
    return { allowed: false, reason: 'You can only edit your own profile for this field' }
  }

  // Manager editable: only manager chain or super admin
  if (permission === 'MANAGER_EDITABLE') {
    if (actor.isSuperAdmin) {
      return { allowed: true }
    }
    if (await isManagerOf(actorId, targetEmployeeId)) {
      return { allowed: true }
    }
    return { allowed: false, reason: 'Only your manager or above can edit this field' }
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
 * - Super admin can reassign anyone
 * - Manager can only reassign employees in their subtree
 * - Peers cannot move each other
 * - Cannot create cycles in the hierarchy
 */
export async function canReassignEmployee(
  actorId: string,
  targetEmployeeId: string,
  newManagerId: string | null
): Promise<{ allowed: boolean; reason?: string }> {
  if (actorId === targetEmployeeId) {
    return { allowed: false, reason: 'You cannot reassign yourself' }
  }

  const actor = await prisma.employee.findUnique({
    where: { id: actorId },
    select: { id: true, isSuperAdmin: true, reportsToId: true }
  })

  if (!actor) {
    return { allowed: false, reason: 'Actor not found' }
  }

  // Super admin can reassign anyone (but still check for cycles)
  if (actor.isSuperAdmin) {
    if (newManagerId) {
      const wouldCreateCycle = await checkWouldCreateCycle(targetEmployeeId, newManagerId)
      if (wouldCreateCycle) {
        return { allowed: false, reason: 'This reassignment would create a cycle in the hierarchy' }
      }
    }
    return { allowed: true }
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
