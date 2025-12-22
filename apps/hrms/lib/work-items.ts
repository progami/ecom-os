import { prisma } from '@/lib/prisma'
import { PermissionLevel } from '@/lib/permissions'

export type WorkItemType =
  | 'TASK_ASSIGNED'
  | 'POLICY_ACK_REQUIRED'
  | 'LEAVE_APPROVAL_REQUIRED'
  | 'REVIEW_DUE'
  | 'REVIEW_PENDING_HR'
  | 'REVIEW_PENDING_SUPER_ADMIN'
  | 'REVIEW_ACK_REQUIRED'
  | 'VIOLATION_PENDING_HR'
  | 'VIOLATION_PENDING_SUPER_ADMIN'
  | 'VIOLATION_ACK_REQUIRED'
  | 'CASE_ASSIGNED'

export type WorkItem = {
  id: string
  type: WorkItemType
  title: string
  description: string | null
  href: string
  createdAt: string
  dueAt: string | null
  priority: number
}

const HR_ROLE_NAMES = ['HR', 'HR_ADMIN', 'HR Admin', 'Human Resources']

function isEmployeeHrLike(employee: {
  isSuperAdmin: boolean
  permissionLevel: number
  roles: { name: string }[]
}): boolean {
  if (employee.isSuperAdmin) return true
  if (employee.permissionLevel >= PermissionLevel.HR) return true
  return employee.roles.some((r) => HR_ROLE_NAMES.includes(r.name))
}

function mapEmployeeRegionToPolicyRegion(region: string): 'KANSAS_US' | 'PAKISTAN' | null {
  if (region === 'PAKISTAN') return 'PAKISTAN'
  if (region === 'KANSAS_USA') return 'KANSAS_US'
  return null
}

function iso(date: Date): string {
  return date.toISOString()
}

export async function getWorkItemsForEmployee(employeeId: string): Promise<{ items: WorkItem[] }> {
  const actor = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      region: true,
      isSuperAdmin: true,
      permissionLevel: true,
      roles: { select: { name: true } },
    },
  })

  if (!actor) {
    return { items: [] }
  }

  const isHR = isEmployeeHrLike(actor)
  const policyRegion = mapEmployeeRegionToPolicyRegion(actor.region)

  const items: WorkItem[] = []

  // Assigned tasks
  const tasks = await prisma.task.findMany({
    where: {
      assignedToId: employeeId,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      dueDate: true,
    },
  })

  for (const task of tasks) {
    items.push({
      id: `TASK_ASSIGNED:${task.id}`,
      type: 'TASK_ASSIGNED',
      title: task.title,
      description: task.description,
      href: `/tasks/${task.id}`,
      createdAt: iso(task.createdAt),
      dueAt: task.dueDate ? iso(task.dueDate) : null,
      priority: 50,
    })
  }

  // Policy acknowledgements required
  if (policyRegion) {
    const policies = await prisma.policy.findMany({
      where: {
        status: 'ACTIVE',
        region: { in: ['ALL', policyRegion] },
      },
      orderBy: [{ effectiveDate: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        title: true,
        version: true,
        updatedAt: true,
        effectiveDate: true,
      },
    })

    const policyIds = policies.map((p) => p.id)
    const acknowledgements = await prisma.policyAcknowledgement.findMany({
      where: {
        employeeId,
        policyId: { in: policyIds },
      },
      select: {
        policyId: true,
        policyVersion: true,
      },
    })

    const acknowledged = new Set(acknowledgements.map((a) => `${a.policyId}:${a.policyVersion}`))
    for (const policy of policies) {
      const key = `${policy.id}:${policy.version}`
      if (acknowledged.has(key)) continue

      items.push({
        id: `POLICY_ACK_REQUIRED:${policy.id}`,
        type: 'POLICY_ACK_REQUIRED',
        title: 'Policy acknowledgment required',
        description: `Acknowledge “${policy.title}” (v${policy.version})`,
        href: `/policies/${policy.id}`,
        createdAt: iso(policy.updatedAt),
        dueAt: policy.effectiveDate ? iso(policy.effectiveDate) : null,
        priority: 80,
      })
    }
  }

  // Leave approvals (direct reports)
  const pendingLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'PENDING',
      employee: { reportsToId: employeeId },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 50,
    select: {
      id: true,
      createdAt: true,
      leaveType: true,
      startDate: true,
      endDate: true,
      totalDays: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  })

  for (const req of pendingLeaves) {
    items.push({
      id: `LEAVE_APPROVAL_REQUIRED:${req.id}`,
      type: 'LEAVE_APPROVAL_REQUIRED',
      title: 'Leave approval required',
      description: `${req.employee.firstName} ${req.employee.lastName} requested ${req.leaveType.replaceAll('_', ' ').toLowerCase()} (${req.totalDays} days)`,
      href: `/leaves/${req.id}`,
      createdAt: iso(req.createdAt),
      dueAt: iso(req.startDate),
      priority: 70,
    })
  }

  // HR review / Super Admin review queues
  if (isHR) {
    const pendingHrReviews = await prisma.performanceReview.findMany({
      where: { status: 'PENDING_HR_REVIEW' },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        createdAt: true,
        submittedAt: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    })

    for (const review of pendingHrReviews) {
      items.push({
        id: `REVIEW_PENDING_HR:${review.id}`,
        type: 'REVIEW_PENDING_HR',
        title: 'Review pending HR approval',
        description: `Review for ${review.employee.firstName} ${review.employee.lastName}`,
        href: `/performance/reviews/${review.id}`,
        createdAt: iso(review.submittedAt ?? review.createdAt),
        dueAt: null,
        priority: 85,
      })
    }

    const pendingHrViolations = await prisma.disciplinaryAction.findMany({
      where: { status: 'PENDING_HR_REVIEW' },
      orderBy: [{ reportedDate: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        createdAt: true,
        reportedDate: true,
        severity: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    })

    for (const action of pendingHrViolations) {
      items.push({
        id: `VIOLATION_PENDING_HR:${action.id}`,
        type: 'VIOLATION_PENDING_HR',
        title: 'Violation pending HR review',
        description: `${action.employee.firstName} ${action.employee.lastName} • ${action.severity.toLowerCase()}`,
        href: `/performance/disciplinary/${action.id}`,
        createdAt: iso(action.reportedDate ?? action.createdAt),
        dueAt: null,
        priority: 90,
      })
    }
  }

  if (actor.isSuperAdmin) {
    const pendingAdminReviews = await prisma.performanceReview.findMany({
      where: { status: 'PENDING_SUPER_ADMIN' },
      orderBy: [{ hrReviewedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        createdAt: true,
        hrReviewedAt: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    })

    for (const review of pendingAdminReviews) {
      items.push({
        id: `REVIEW_PENDING_SUPER_ADMIN:${review.id}`,
        type: 'REVIEW_PENDING_SUPER_ADMIN',
        title: 'Review pending final approval',
        description: `Review for ${review.employee.firstName} ${review.employee.lastName}`,
        href: `/performance/reviews/${review.id}`,
        createdAt: iso(review.hrReviewedAt ?? review.createdAt),
        dueAt: null,
        priority: 95,
      })
    }

    const pendingAdminViolations = await prisma.disciplinaryAction.findMany({
      where: { status: 'PENDING_SUPER_ADMIN' },
      orderBy: [{ hrReviewedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        createdAt: true,
        hrReviewedAt: true,
        severity: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    })

    for (const action of pendingAdminViolations) {
      items.push({
        id: `VIOLATION_PENDING_SUPER_ADMIN:${action.id}`,
        type: 'VIOLATION_PENDING_SUPER_ADMIN',
        title: 'Violation pending final approval',
        description: `${action.employee.firstName} ${action.employee.lastName} • ${action.severity.toLowerCase()}`,
        href: `/performance/disciplinary/${action.id}`,
        createdAt: iso(action.hrReviewedAt ?? action.createdAt),
        dueAt: null,
        priority: 98,
      })
    }
  }

  // Employee acknowledgements
  const pendingReviewAcks = await prisma.performanceReview.findMany({
    where: { employeeId, status: 'PENDING_ACKNOWLEDGMENT' },
    orderBy: [{ superAdminApprovedAt: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    select: {
      id: true,
      createdAt: true,
      superAdminApprovedAt: true,
    },
  })

  for (const review of pendingReviewAcks) {
    items.push({
      id: `REVIEW_ACK_REQUIRED:${review.id}`,
      type: 'REVIEW_ACK_REQUIRED',
      title: 'Review acknowledgment required',
      description: 'A performance review is awaiting your acknowledgment',
      href: `/performance/reviews/${review.id}`,
      createdAt: iso(review.superAdminApprovedAt ?? review.createdAt),
      dueAt: null,
      priority: 88,
    })
  }

  const pendingViolationAcks = await prisma.disciplinaryAction.findMany({
    where: {
      status: 'PENDING_ACKNOWLEDGMENT',
      OR: [
        { employeeId },
        { employee: { reportsToId: employeeId } },
      ],
    },
    orderBy: [{ superAdminApprovedAt: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    select: {
      id: true,
      createdAt: true,
      superAdminApprovedAt: true,
      employeeId: true,
      employeeAcknowledged: true,
      managerAcknowledged: true,
      employee: { select: { firstName: true, lastName: true, reportsToId: true } },
    },
  })

  for (const action of pendingViolationAcks) {
    const isEmployee = action.employeeId === employeeId
    const isManager = action.employee.reportsToId === employeeId

    if (isEmployee && action.employeeAcknowledged) continue
    if (isManager && action.managerAcknowledged) continue

    const who = isEmployee ? 'your' : `${action.employee.firstName} ${action.employee.lastName}'s`
    items.push({
      id: `VIOLATION_ACK_REQUIRED:${action.id}`,
      type: 'VIOLATION_ACK_REQUIRED',
      title: 'Violation acknowledgment required',
      description: `Acknowledge ${who} violation record`,
      href: `/performance/disciplinary/${action.id}`,
      createdAt: iso(action.superAdminApprovedAt ?? action.createdAt),
      dueAt: null,
      priority: 92,
    })
  }

  // Assigned cases
  const assignedCases = await prisma.case.findMany({
    where: {
      assignedToId: employeeId,
      status: { in: ['OPEN', 'IN_REVIEW', 'ON_HOLD'] },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 50,
    select: {
      id: true,
      caseNumber: true,
      title: true,
      updatedAt: true,
    },
  })

  for (const c of assignedCases) {
    items.push({
      id: `CASE_ASSIGNED:${c.id}`,
      type: 'CASE_ASSIGNED',
      title: `Case #${c.caseNumber} assigned`,
      description: c.title,
      href: `/cases/${c.id}`,
      createdAt: iso(c.updatedAt),
      dueAt: null,
      priority: 75,
    })
  }

  items.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    return b.createdAt.localeCompare(a.createdAt)
  })

  return { items }
}

