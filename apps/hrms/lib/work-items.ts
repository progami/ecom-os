import { prisma } from '@/lib/prisma'
import { PermissionLevel } from '@/lib/permissions'
import type { WorkItemAction, WorkItemDTO, WorkItemPriority, WorkItemsResponse } from '@/lib/contracts/work-items'
import { rankWorkItems } from '@/lib/domain/work-items/rank'

export type WorkItemType =
  | 'TASK_ASSIGNED'
  | 'POLICY_ACK_REQUIRED'
  | 'LEAVE_PENDING_MANAGER'
  | 'LEAVE_PENDING_HR'
  | 'LEAVE_PENDING_SUPER_ADMIN'
  | 'REVIEW_DUE'
  | 'REVIEW_PENDING_HR'
  | 'REVIEW_PENDING_SUPER_ADMIN'
  | 'REVIEW_ACK_REQUIRED'
  | 'VIOLATION_PENDING_HR'
  | 'VIOLATION_PENDING_SUPER_ADMIN'
  | 'VIOLATION_ACK_REQUIRED'

const HR_ROLE_NAMES = ['HR', 'HR_ADMIN', 'HR Admin', 'Human Resources']

function isEmployeeHrLike(employee: {
  isSuperAdmin: boolean
  permissionLevel: number
  roles: { name: string }[]
}): boolean {
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

function daysBetween(aMs: number, bMs: number): number {
  const dayMs = 86_400_000
  return Math.floor(Math.abs(aMs - bMs) / dayMs)
}

function computeDueMeta(dueAtIso: string | null): { isOverdue: boolean; overdueDays: number | null } {
  if (!dueAtIso) return { isOverdue: false, overdueDays: null }

  const dueMs = Date.parse(dueAtIso)
  if (!Number.isFinite(dueMs)) return { isOverdue: false, overdueDays: null }

  const nowMs = Date.now()
  if (dueMs > nowMs) return { isOverdue: false, overdueDays: null }

  const overdueDays = Math.max(1, daysBetween(nowMs, dueMs))
  return { isOverdue: true, overdueDays }
}

function priorityFromScore(score: number, isOverdue: boolean): WorkItemPriority {
  if (isOverdue || score >= 100) return 'URGENT'
  if (score >= 85) return 'HIGH'
  if (score >= 65) return 'NORMAL'
  return 'LOW'
}

function toTypeLabel(type: WorkItemType): string {
  const map: Record<WorkItemType, string> = {
    TASK_ASSIGNED: 'Task',
    POLICY_ACK_REQUIRED: 'Policy',
    LEAVE_PENDING_MANAGER: 'Leave',
    LEAVE_PENDING_HR: 'Leave',
    LEAVE_PENDING_SUPER_ADMIN: 'Leave',
    REVIEW_DUE: 'Review',
    REVIEW_PENDING_HR: 'Review',
    REVIEW_PENDING_SUPER_ADMIN: 'Review',
    REVIEW_ACK_REQUIRED: 'Review',
    VIOLATION_PENDING_HR: 'Violation',
    VIOLATION_PENDING_SUPER_ADMIN: 'Violation',
    VIOLATION_ACK_REQUIRED: 'Violation',
  }
  return map[type] ?? type
}

function toStageLabel(type: WorkItemType, options?: { status?: string }): string {
  const status = options?.status
  if (type === 'TASK_ASSIGNED' && status) {
    if (status === 'OPEN') return 'Open'
    if (status === 'IN_PROGRESS') return 'In progress'
  }

  const map: Record<WorkItemType, string> = {
    TASK_ASSIGNED: 'Assigned',
    POLICY_ACK_REQUIRED: 'Acknowledgement required',
    LEAVE_PENDING_MANAGER: 'Manager approval required',
    LEAVE_PENDING_HR: 'HR approval required',
    LEAVE_PENDING_SUPER_ADMIN: 'Final approval required',
    REVIEW_DUE: 'Due',
    REVIEW_PENDING_HR: 'HR review required',
    REVIEW_PENDING_SUPER_ADMIN: 'Final approval required',
    REVIEW_ACK_REQUIRED: 'Acknowledgement required',
    VIOLATION_PENDING_HR: 'HR review required',
    VIOLATION_PENDING_SUPER_ADMIN: 'Final approval required',
    VIOLATION_ACK_REQUIRED: 'Acknowledgement required',
  }

  return map[type] ?? type
}

function createWorkItemAction(action: WorkItemAction): WorkItemAction {
  if (action.disabled && !action.disabledReason) {
    return { ...action, disabledReason: 'Not available' }
  }
  return action
}

export async function getWorkItemsForEmployee(employeeId: string): Promise<WorkItemsResponse> {
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
    return { items: [], meta: { totalCount: 0, actionRequiredCount: 0, overdueCount: 0 } }
  }

  const isSuperAdmin = actor.isSuperAdmin
  const isHR = isEmployeeHrLike(actor)
  const policyRegion = mapEmployeeRegionToPolicyRegion(actor.region)

  const items: WorkItemDTO[] = []

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
      status: true,
    },
  })

  for (const task of tasks) {
    const createdAt = iso(task.createdAt)
    const dueAt = task.dueDate ? iso(task.dueDate) : null
    const dueMeta = computeDueMeta(dueAt)

    const primaryAction: WorkItemAction | null =
      task.status === 'OPEN'
        ? createWorkItemAction({ id: 'task.markInProgress', label: 'Start', disabled: false })
        : createWorkItemAction({ id: 'task.markDone', label: 'Mark done', disabled: false })

    const secondaryActions: WorkItemAction[] =
      task.status === 'OPEN'
        ? [createWorkItemAction({ id: 'task.markDone', label: 'Mark done', disabled: false })]
        : []

    const baseScore = 50
    const score = baseScore + (dueMeta.isOverdue ? 30 + Math.min(30, dueMeta.overdueDays ?? 0) : 0)

    items.push({
      id: `TASK_ASSIGNED:${task.id}`,
      type: 'TASK_ASSIGNED',
      typeLabel: toTypeLabel('TASK_ASSIGNED'),
      title: task.title,
      description: task.description,
      href: `/tasks/${task.id}`,
      entity: { type: 'TASK', id: task.id },
      stageLabel: toStageLabel('TASK_ASSIGNED', { status: task.status }),
      createdAt,
      dueAt,
      isOverdue: dueMeta.isOverdue,
      overdueDays: dueMeta.overdueDays,
      priority: priorityFromScore(score, dueMeta.isOverdue),
      isActionRequired: true,
      primaryAction,
      secondaryActions,
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

      const createdAt = iso(policy.updatedAt)
      const dueAt = policy.effectiveDate ? iso(policy.effectiveDate) : null
      const dueMeta = computeDueMeta(dueAt)
      const baseScore = 80
      const score = baseScore + (dueMeta.isOverdue ? 30 + Math.min(30, dueMeta.overdueDays ?? 0) : 0)

      items.push({
        id: `POLICY_ACK_REQUIRED:${policy.id}`,
        type: 'POLICY_ACK_REQUIRED',
        typeLabel: toTypeLabel('POLICY_ACK_REQUIRED'),
        title: 'Policy acknowledgment required',
        description: `Acknowledge “${policy.title}” (v${policy.version})`,
        href: `/policies/${policy.id}`,
        entity: { type: 'POLICY', id: policy.id },
        stageLabel: toStageLabel('POLICY_ACK_REQUIRED'),
        createdAt,
        dueAt,
        isOverdue: dueMeta.isOverdue,
        overdueDays: dueMeta.overdueDays,
        priority: priorityFromScore(score, dueMeta.isOverdue),
        isActionRequired: true,
        primaryAction: createWorkItemAction({ id: 'policy.acknowledge', label: 'Acknowledge', disabled: false }),
        secondaryActions: [],
      })
    }
  }

  // Leave approvals (manager stage - direct reports)
  const pendingManagerLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: { in: ['PENDING', 'PENDING_MANAGER'] },
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

  for (const req of pendingManagerLeaves) {
    const createdAt = iso(req.createdAt)
    const dueAt = iso(req.startDate)
    const dueMeta = computeDueMeta(dueAt)
    const baseScore = 70
    const score = baseScore + (dueMeta.isOverdue ? 30 + Math.min(30, dueMeta.overdueDays ?? 0) : 0)

    items.push({
      id: `LEAVE_PENDING_MANAGER:${req.id}`,
      type: 'LEAVE_PENDING_MANAGER',
      typeLabel: toTypeLabel('LEAVE_PENDING_MANAGER'),
      title: 'Leave approval required',
      description: `${req.employee.firstName} ${req.employee.lastName} requested ${req.leaveType.replaceAll('_', ' ').toLowerCase()} (${req.totalDays} days)`,
      href: `/leaves/${req.id}`,
      entity: { type: 'LEAVE_REQUEST', id: req.id },
      stageLabel: toStageLabel('LEAVE_PENDING_MANAGER'),
      createdAt,
      dueAt,
      isOverdue: dueMeta.isOverdue,
      overdueDays: dueMeta.overdueDays,
      priority: priorityFromScore(score, dueMeta.isOverdue),
      isActionRequired: true,
      primaryAction: createWorkItemAction({ id: 'leave.approve', label: 'Approve', disabled: false }),
      secondaryActions: [createWorkItemAction({ id: 'leave.reject', label: 'Reject', disabled: false })],
    })
  }

  if (isHR) {
    const pendingHrLeaves = await prisma.leaveRequest.findMany({
      where: { status: 'PENDING_HR' },
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

    for (const req of pendingHrLeaves) {
      const createdAt = iso(req.createdAt)
      const dueAt = iso(req.startDate)
      const dueMeta = computeDueMeta(dueAt)
      const baseScore = 80
      const score = baseScore + (dueMeta.isOverdue ? 20 + Math.min(30, dueMeta.overdueDays ?? 0) : 0)

      items.push({
        id: `LEAVE_PENDING_HR:${req.id}`,
        type: 'LEAVE_PENDING_HR',
        typeLabel: toTypeLabel('LEAVE_PENDING_HR'),
        title: 'Leave pending HR approval',
        description: `${req.employee.firstName} ${req.employee.lastName} requested ${req.leaveType.replaceAll('_', ' ').toLowerCase()} (${req.totalDays} days)`,
        href: `/leaves/${req.id}`,
        entity: { type: 'LEAVE_REQUEST', id: req.id },
        stageLabel: toStageLabel('LEAVE_PENDING_HR'),
        createdAt,
        dueAt,
        isOverdue: dueMeta.isOverdue,
        overdueDays: dueMeta.overdueDays,
        priority: priorityFromScore(score, dueMeta.isOverdue),
        isActionRequired: true,
        primaryAction: createWorkItemAction({ id: 'leave.approve', label: 'Approve (HR)', disabled: false }),
        secondaryActions: [createWorkItemAction({ id: 'leave.reject', label: 'Reject', disabled: false })],
      })
    }
  }

  if (isSuperAdmin) {
    const pendingAdminLeaves = await prisma.leaveRequest.findMany({
      where: { status: 'PENDING_SUPER_ADMIN' },
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

    for (const req of pendingAdminLeaves) {
      const createdAt = iso(req.createdAt)
      const dueAt = iso(req.startDate)
      const dueMeta = computeDueMeta(dueAt)
      const baseScore = 90
      const score = baseScore + (dueMeta.isOverdue ? 20 + Math.min(30, dueMeta.overdueDays ?? 0) : 0)

      items.push({
        id: `LEAVE_PENDING_SUPER_ADMIN:${req.id}`,
        type: 'LEAVE_PENDING_SUPER_ADMIN',
        typeLabel: toTypeLabel('LEAVE_PENDING_SUPER_ADMIN'),
        title: 'Leave pending final approval',
        description: `${req.employee.firstName} ${req.employee.lastName} requested ${req.leaveType.replaceAll('_', ' ').toLowerCase()} (${req.totalDays} days)`,
        href: `/leaves/${req.id}`,
        entity: { type: 'LEAVE_REQUEST', id: req.id },
        stageLabel: toStageLabel('LEAVE_PENDING_SUPER_ADMIN'),
        createdAt,
        dueAt,
        isOverdue: dueMeta.isOverdue,
        overdueDays: dueMeta.overdueDays,
        priority: priorityFromScore(score, dueMeta.isOverdue),
        isActionRequired: true,
        primaryAction: createWorkItemAction({ id: 'leave.approve', label: 'Final approve', disabled: false }),
        secondaryActions: [createWorkItemAction({ id: 'leave.reject', label: 'Reject', disabled: false })],
      })
    }
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
      const createdAt = iso(review.submittedAt ?? review.createdAt)
      const baseScore = 85
      const score = baseScore
      items.push({
        id: `REVIEW_PENDING_HR:${review.id}`,
        type: 'REVIEW_PENDING_HR',
        typeLabel: toTypeLabel('REVIEW_PENDING_HR'),
        title: 'Review pending HR approval',
        description: `Review for ${review.employee.firstName} ${review.employee.lastName}`,
        href: `/performance/reviews/${review.id}`,
        entity: { type: 'PERFORMANCE_REVIEW', id: review.id },
        stageLabel: toStageLabel('REVIEW_PENDING_HR'),
        createdAt,
        dueAt: null,
        isOverdue: false,
        overdueDays: null,
        priority: priorityFromScore(score, false),
        isActionRequired: true,
        primaryAction: createWorkItemAction({ id: 'review.hrApprove', label: 'Approve (HR)', disabled: false }),
        secondaryActions: [
          createWorkItemAction({ id: 'review.hrReject', label: 'Reject', disabled: false }),
        ],
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
      const createdAt = iso(action.reportedDate ?? action.createdAt)
      const baseScore = 90
      const score = baseScore
      items.push({
        id: `VIOLATION_PENDING_HR:${action.id}`,
        type: 'VIOLATION_PENDING_HR',
        typeLabel: toTypeLabel('VIOLATION_PENDING_HR'),
        title: 'Violation pending HR review',
        description: `${action.employee.firstName} ${action.employee.lastName} • ${action.severity.toLowerCase()}`,
        href: `/performance/violations/${action.id}`,
        entity: { type: 'DISCIPLINARY_ACTION', id: action.id },
        stageLabel: toStageLabel('VIOLATION_PENDING_HR'),
        createdAt,
        dueAt: null,
        isOverdue: false,
        overdueDays: null,
        priority: priorityFromScore(score, false),
        isActionRequired: true,
        primaryAction: createWorkItemAction({ id: 'disciplinary.hrApprove', label: 'Approve (HR)', disabled: false }),
        secondaryActions: [
          createWorkItemAction({ id: 'disciplinary.hrReject', label: 'Request changes', disabled: false }),
        ],
      })
    }
  }

  if (isSuperAdmin) {
    const pendingAdminReviews = await prisma.performanceReview.findMany({
      where: { status: 'PENDING_SUPER_ADMIN' },
      orderBy: [{ hrReviewedAt: 'desc' }, { submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        createdAt: true,
        submittedAt: true,
        hrReviewedAt: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    })

    for (const review of pendingAdminReviews) {
      const createdAt = iso(review.hrReviewedAt ?? review.submittedAt ?? review.createdAt)
      const baseScore = 92
      const score = baseScore
      items.push({
        id: `REVIEW_PENDING_SUPER_ADMIN:${review.id}`,
        type: 'REVIEW_PENDING_SUPER_ADMIN',
        typeLabel: toTypeLabel('REVIEW_PENDING_SUPER_ADMIN'),
        title: 'Review pending final approval',
        description: `Review for ${review.employee.firstName} ${review.employee.lastName}`,
        href: `/performance/reviews/${review.id}`,
        entity: { type: 'PERFORMANCE_REVIEW', id: review.id },
        stageLabel: toStageLabel('REVIEW_PENDING_SUPER_ADMIN'),
        createdAt,
        dueAt: null,
        isOverdue: false,
        overdueDays: null,
        priority: priorityFromScore(score, false),
        isActionRequired: true,
        primaryAction: createWorkItemAction({ id: 'review.superAdminApprove', label: 'Final approve', disabled: false }),
        secondaryActions: [
          createWorkItemAction({ id: 'review.superAdminReject', label: 'Reject', disabled: false }),
        ],
      })
    }

    const pendingAdminViolations = await prisma.disciplinaryAction.findMany({
      where: { status: 'PENDING_SUPER_ADMIN' },
      orderBy: [{ hrReviewedAt: 'desc' }, { reportedDate: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        createdAt: true,
        reportedDate: true,
        hrReviewedAt: true,
        severity: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    })

    for (const action of pendingAdminViolations) {
      const createdAt = iso(action.hrReviewedAt ?? action.reportedDate ?? action.createdAt)
      const baseScore = 95
      const score = baseScore
      items.push({
        id: `VIOLATION_PENDING_SUPER_ADMIN:${action.id}`,
        type: 'VIOLATION_PENDING_SUPER_ADMIN',
        typeLabel: toTypeLabel('VIOLATION_PENDING_SUPER_ADMIN'),
        title: 'Violation pending final approval',
        description: `${action.employee.firstName} ${action.employee.lastName} • ${action.severity.toLowerCase()}`,
        href: `/performance/violations/${action.id}`,
        entity: { type: 'DISCIPLINARY_ACTION', id: action.id },
        stageLabel: toStageLabel('VIOLATION_PENDING_SUPER_ADMIN'),
        createdAt,
        dueAt: null,
        isOverdue: false,
        overdueDays: null,
        priority: priorityFromScore(score, false),
        isActionRequired: true,
        primaryAction: createWorkItemAction({ id: 'disciplinary.superAdminApprove', label: 'Final approve', disabled: false }),
        secondaryActions: [
          createWorkItemAction({ id: 'disciplinary.superAdminReject', label: 'Request changes', disabled: false }),
        ],
      })
    }
  }

  // Employee acknowledgements
  const pendingReviewAcks = await prisma.performanceReview.findMany({
    where: { employeeId, status: 'PENDING_ACKNOWLEDGMENT' },
    orderBy: [{ hrReviewedAt: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    select: {
      id: true,
      createdAt: true,
      hrReviewedAt: true,
    },
  })

  for (const review of pendingReviewAcks) {
    const createdAt = iso(review.hrReviewedAt ?? review.createdAt)
    const baseScore = 88
    const score = baseScore
    items.push({
      id: `REVIEW_ACK_REQUIRED:${review.id}`,
      type: 'REVIEW_ACK_REQUIRED',
      typeLabel: toTypeLabel('REVIEW_ACK_REQUIRED'),
      title: 'Review acknowledgment required',
      description: 'A performance review is awaiting your acknowledgment',
      href: `/performance/reviews/${review.id}`,
      entity: { type: 'PERFORMANCE_REVIEW', id: review.id },
      stageLabel: toStageLabel('REVIEW_ACK_REQUIRED'),
      createdAt,
      dueAt: null,
      isOverdue: false,
      overdueDays: null,
      priority: priorityFromScore(score, false),
      isActionRequired: true,
      primaryAction: createWorkItemAction({ id: 'review.acknowledge', label: 'Acknowledge', disabled: false }),
      secondaryActions: [],
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
    orderBy: [{ hrReviewedAt: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    select: {
      id: true,
      createdAt: true,
      hrReviewedAt: true,
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
    const createdAt = iso(action.hrReviewedAt ?? action.createdAt)
    const baseScore = 92
    const score = baseScore
    items.push({
      id: `VIOLATION_ACK_REQUIRED:${action.id}`,
      type: 'VIOLATION_ACK_REQUIRED',
      typeLabel: toTypeLabel('VIOLATION_ACK_REQUIRED'),
      title: 'Violation acknowledgment required',
      description: `Acknowledge ${who} violation record`,
      href: `/performance/violations/${action.id}`,
      entity: { type: 'DISCIPLINARY_ACTION', id: action.id },
      stageLabel: toStageLabel('VIOLATION_ACK_REQUIRED'),
      createdAt,
      dueAt: null,
      isOverdue: false,
      overdueDays: null,
      priority: priorityFromScore(score, false),
      isActionRequired: true,
      primaryAction: createWorkItemAction({ id: 'disciplinary.acknowledge', label: 'Acknowledge', disabled: false }),
      secondaryActions: isEmployee
        ? [createWorkItemAction({ id: 'disciplinary.appeal', label: 'Appeal', disabled: false })]
        : [],
    })
  }

  const ranked = rankWorkItems(items)

  const overdueCount = ranked.filter((i) => i.isOverdue).length
  const actionRequiredCount = ranked.filter((i) => i.isActionRequired).length

  return {
    items: ranked,
    meta: {
      totalCount: ranked.length,
      actionRequiredCount,
      overdueCount,
    },
  }
}
