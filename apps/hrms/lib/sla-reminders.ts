import { prisma } from '@/lib/prisma'
import { getHREmployees, getSuperAdminEmployees } from '@/lib/permissions'

export type SlaReminderResult = {
  policyAckRemindersCreated: number
  leaveApprovalRemindersCreated: number
  reviewRemindersCreated: number
  disciplinaryRemindersCreated: number
  acknowledgmentRemindersCreated: number
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function key(employeeId: string, relatedId: string, title: string): string {
  return `${employeeId}:${relatedId}:${title}`
}

async function existingKeys(params: {
  since: Date
  title: string
  relatedType: string
  relatedIds: string[]
}): Promise<Set<string>> {
  if (params.relatedIds.length === 0) return new Set()

  const rows = await prisma.notification.findMany({
    where: {
      createdAt: { gte: params.since },
      title: params.title,
      relatedType: params.relatedType,
      relatedId: { in: params.relatedIds },
      employeeId: { not: null },
    },
    select: { employeeId: true, relatedId: true, title: true },
  })

  return new Set(rows.map((n) => key(n.employeeId!, n.relatedId ?? '', n.title)))
}

export async function processSlaReminders(options?: {
  dedupeHours?: number
  policyAckOverdueDays?: number
  leavePendingHours?: number
  reviewPendingHours?: number
  disciplinaryPendingHours?: number
  acknowledgmentPendingDays?: number
}): Promise<SlaReminderResult> {
  const dedupeHours = options?.dedupeHours ?? 20
  const policyAckOverdueDays = options?.policyAckOverdueDays ?? 3
  const leavePendingHours = options?.leavePendingHours ?? 24
  const reviewPendingHours = options?.reviewPendingHours ?? 24
  const disciplinaryPendingHours = options?.disciplinaryPendingHours ?? 24
  const acknowledgmentPendingDays = options?.acknowledgmentPendingDays ?? 3

  const now = new Date()
  const since = new Date(now.getTime() - dedupeHours * 60 * 60 * 1000)

  let policyAckRemindersCreated = 0
  let leaveApprovalRemindersCreated = 0
  let reviewRemindersCreated = 0
  let disciplinaryRemindersCreated = 0
  let acknowledgmentRemindersCreated = 0

  // ============ POLICY ACKNOWLEDGEMENT REMINDERS ============
  const policyThreshold = new Date(now.getTime() - policyAckOverdueDays * 24 * 60 * 60 * 1000)
  const overduePolicies = await prisma.policy.findMany({
    where: {
      status: 'ACTIVE',
      effectiveDate: { lte: policyThreshold },
      region: { in: ['ALL', 'KANSAS_US', 'PAKISTAN'] },
    },
    select: { id: true, version: true, region: true },
    orderBy: [{ effectiveDate: 'asc' }, { updatedAt: 'desc' }],
    take: 200,
  })

  const policyByRegion = {
    ALL: overduePolicies.filter((p) => p.region === 'ALL'),
    KANSAS_US: overduePolicies.filter((p) => p.region === 'KANSAS_US'),
    PAKISTAN: overduePolicies.filter((p) => p.region === 'PAKISTAN'),
  }

  const policyKeysByRegion = {
    KANSAS_US: [...policyByRegion.ALL, ...policyByRegion.KANSAS_US].map((p) => `${p.id}:${p.version}`),
    PAKISTAN: [...policyByRegion.ALL, ...policyByRegion.PAKISTAN].map((p) => `${p.id}:${p.version}`),
  }

  const policyIdsByRegion = {
    KANSAS_US: [...policyByRegion.ALL, ...policyByRegion.KANSAS_US].map((p) => p.id),
    PAKISTAN: [...policyByRegion.ALL, ...policyByRegion.PAKISTAN].map((p) => p.id),
  }

  const mapEmployeeRegionToPolicyRegion = (region: string): 'KANSAS_US' | 'PAKISTAN' | null => {
    if (region === 'PAKISTAN') return 'PAKISTAN'
    if (region === 'KANSAS_USA') return 'KANSAS_US'
    return null
  }

  if (overduePolicies.length > 0) {
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, region: true },
      take: 10000,
    })

    const needsReminderByRegion: Record<'KANSAS_US' | 'PAKISTAN', string[]> = { KANSAS_US: [], PAKISTAN: [] }

    const chunkSize = 500
    for (const region of ['KANSAS_US', 'PAKISTAN'] as const) {
      const policyKeys = policyKeysByRegion[region]
      const policyIds = policyIdsByRegion[region]
      if (policyKeys.length === 0 || policyIds.length === 0) continue

      const regionEmployees = employees
        .filter((e) => mapEmployeeRegionToPolicyRegion(e.region) === region)
        .map((e) => e.id)

      for (let i = 0; i < regionEmployees.length; i += chunkSize) {
        const employeeChunk = regionEmployees.slice(i, i + chunkSize)
        const acknowledgements = await prisma.policyAcknowledgement.findMany({
          where: {
            employeeId: { in: employeeChunk },
            policyId: { in: policyIds },
          },
          select: { employeeId: true, policyId: true, policyVersion: true },
        })

        const ackByEmployee = new Map<string, Set<string>>()
        for (const ack of acknowledgements) {
          const key = `${ack.policyId}:${ack.policyVersion}`
          const set = ackByEmployee.get(ack.employeeId) ?? new Set<string>()
          set.add(key)
          ackByEmployee.set(ack.employeeId, set)
        }

        for (const employeeId of employeeChunk) {
          const acked = ackByEmployee.get(employeeId) ?? new Set<string>()
          const hasMissing = policyKeys.some((k) => !acked.has(k))
          if (hasMissing) {
            needsReminderByRegion[region].push(employeeId)
          }
        }
      }
    }

    const reminderEmployeeIds = [...new Set([...needsReminderByRegion.KANSAS_US, ...needsReminderByRegion.PAKISTAN])]

    if (reminderEmployeeIds.length > 0) {
      const title = 'Policy acknowledgement required'
      const message = 'You have one or more policies awaiting acknowledgement. Please open HRMS to review and acknowledge.'

      const existing = await prisma.notification.findMany({
        where: {
          createdAt: { gte: since },
          title,
          relatedType: 'POLICY',
          relatedId: null,
          employeeId: { in: reminderEmployeeIds },
        },
        select: { employeeId: true },
      })

      const existingEmployeeIds = new Set(existing.map((n) => n.employeeId!).filter(Boolean))

      const toCreate = reminderEmployeeIds.filter((id) => !existingEmployeeIds.has(id))
      if (toCreate.length > 0) {
        for (const employeeId of toCreate) {
          await prisma.notification.create({
            data: {
              type: 'SYSTEM',
              title,
              message,
              link: '/policies',
              employeeId,
              relatedType: 'POLICY',
              relatedId: null,
            },
          })
          policyAckRemindersCreated += 1
        }
      }

      if (existingEmployeeIds.size > 0) {
        await prisma.notification.updateMany({
          where: {
            createdAt: { gte: since },
            title,
            relatedType: 'POLICY',
            relatedId: null,
            employeeId: { in: Array.from(existingEmployeeIds) },
          },
          data: {
            message,
            isRead: false,
          },
        })
      }
    }
  }

  // ============ LEAVE APPROVAL REMINDERS ============
  const leaveThreshold = new Date(now.getTime() - leavePendingHours * 60 * 60 * 1000)
  const pendingLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lte: leaveThreshold },
      employee: { reportsToId: { not: null } },
    },
    select: {
      id: true,
      createdAt: true,
      startDate: true,
      endDate: true,
      totalDays: true,
      leaveType: true,
      employee: { select: { firstName: true, lastName: true, reportsToId: true } },
    },
    take: 200,
  })

  const leaveIds = pendingLeaves.map((l) => l.id)
  const leaveTitle = 'Leave approval reminder'
  const leaveExisting = await existingKeys({ since, title: leaveTitle, relatedType: 'LEAVE', relatedIds: leaveIds })

  for (const leave of pendingLeaves) {
    const managerId = leave.employee.reportsToId
    if (!managerId) continue

    const exists = leaveExisting.has(key(managerId, leave.id, leaveTitle))
    if (exists) continue

    await prisma.notification.create({
      data: {
        type: 'SYSTEM',
        title: leaveTitle,
        message: `A leave request from ${leave.employee.firstName} ${leave.employee.lastName} is still pending your approval (requested ${formatDay(leave.createdAt)}).`,
        link: `/leaves/${leave.id}`,
        employeeId: managerId,
        relatedId: leave.id,
        relatedType: 'LEAVE',
      },
    })

    leaveApprovalRemindersCreated += 1
  }

  // ============ REVIEW REMINDERS (HR + SUPER ADMIN) ============
  const reviewThreshold = new Date(now.getTime() - reviewPendingHours * 60 * 60 * 1000)
  const [pendingHrReviews, pendingAdminReviews] = await Promise.all([
    prisma.performanceReview.findMany({
      where: {
        status: 'PENDING_HR_REVIEW',
        submittedAt: { lte: reviewThreshold },
      },
      select: {
        id: true,
        submittedAt: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      take: 200,
    }),
    prisma.performanceReview.findMany({
      where: {
        status: 'PENDING_SUPER_ADMIN',
        hrReviewedAt: { lte: reviewThreshold },
      },
      select: {
        id: true,
        hrReviewedAt: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      take: 200,
    }),
  ])

  const hrEmployees = await getHREmployees()
  const superAdmins = await getSuperAdminEmployees()

  if (pendingHrReviews.length > 0 && hrEmployees.length > 0) {
    const title = 'Review pending HR action'
    const ids = pendingHrReviews.map((r) => r.id)
    const existing = await existingKeys({ since, title, relatedType: 'REVIEW', relatedIds: ids })

    for (const r of pendingHrReviews) {
      for (const hr of hrEmployees) {
        const k = key(hr.id, r.id, title)
        if (existing.has(k)) continue

        await prisma.notification.create({
          data: {
            type: 'SYSTEM',
            title,
            message: `A performance review for ${r.employee.firstName} ${r.employee.lastName} is waiting for HR review.`,
            link: `/performance/reviews/${r.id}`,
            employeeId: hr.id,
            relatedId: r.id,
            relatedType: 'REVIEW',
          },
        })
        reviewRemindersCreated += 1
      }
    }
  }

  if (pendingAdminReviews.length > 0 && superAdmins.length > 0) {
    const title = 'Review pending final approval'
    const ids = pendingAdminReviews.map((r) => r.id)
    const existing = await existingKeys({ since, title, relatedType: 'REVIEW', relatedIds: ids })

    for (const r of pendingAdminReviews) {
      for (const admin of superAdmins) {
        const k = key(admin.id, r.id, title)
        if (existing.has(k)) continue

        await prisma.notification.create({
          data: {
            type: 'SYSTEM',
            title,
            message: `A performance review for ${r.employee.firstName} ${r.employee.lastName} is waiting for final approval.`,
            link: `/performance/reviews/${r.id}`,
            employeeId: admin.id,
            relatedId: r.id,
            relatedType: 'REVIEW',
          },
        })
        reviewRemindersCreated += 1
      }
    }
  }

  // ============ DISCIPLINARY REMINDERS (HR + SUPER ADMIN) ============
  const disciplinaryThreshold = new Date(now.getTime() - disciplinaryPendingHours * 60 * 60 * 1000)
  const [pendingHrViolations, pendingAdminViolations] = await Promise.all([
    prisma.disciplinaryAction.findMany({
      where: {
        status: 'PENDING_HR_REVIEW',
        reportedDate: { lte: disciplinaryThreshold },
      },
      select: {
        id: true,
        caseId: true,
        reportedDate: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      take: 200,
    }),
    prisma.disciplinaryAction.findMany({
      where: {
        status: 'PENDING_SUPER_ADMIN',
        hrReviewedAt: { lte: disciplinaryThreshold },
      },
      select: {
        id: true,
        caseId: true,
        hrReviewedAt: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      take: 200,
    }),
  ])

  if (pendingHrViolations.length > 0 && hrEmployees.length > 0) {
    const title = 'Violation pending HR action'
    const ids = pendingHrViolations.map((v) => v.id)
    const existing = await existingKeys({ since, title, relatedType: 'DISCIPLINARY', relatedIds: ids })

    for (const v of pendingHrViolations) {
      for (const hr of hrEmployees) {
        const k = key(hr.id, v.id, title)
        if (existing.has(k)) continue

	        await prisma.notification.create({
	          data: {
	            type: 'SYSTEM',
	            title,
	            message: `A violation for ${v.employee.firstName} ${v.employee.lastName} is waiting for HR review.`,
	            link: v.caseId ? `/cases/${v.caseId}` : `/performance/disciplinary/${v.id}`,
	            employeeId: hr.id,
	            relatedId: v.id,
	            relatedType: 'DISCIPLINARY',
	          },
	        })
        disciplinaryRemindersCreated += 1
      }
    }
  }

  if (pendingAdminViolations.length > 0 && superAdmins.length > 0) {
    const title = 'Violation pending final approval'
    const ids = pendingAdminViolations.map((v) => v.id)
    const existing = await existingKeys({ since, title, relatedType: 'DISCIPLINARY', relatedIds: ids })

    for (const v of pendingAdminViolations) {
      for (const admin of superAdmins) {
        const k = key(admin.id, v.id, title)
        if (existing.has(k)) continue

	        await prisma.notification.create({
	          data: {
	            type: 'SYSTEM',
	            title,
	            message: `A violation for ${v.employee.firstName} ${v.employee.lastName} is waiting for final approval.`,
	            link: v.caseId ? `/cases/${v.caseId}` : `/performance/disciplinary/${v.id}`,
	            employeeId: admin.id,
	            relatedId: v.id,
	            relatedType: 'DISCIPLINARY',
	          },
	        })
        disciplinaryRemindersCreated += 1
      }
    }
  }

  // ============ ACKNOWLEDGEMENT REMINDERS (REVIEWS + VIOLATIONS) ============
  const ackThreshold = new Date(now.getTime() - acknowledgmentPendingDays * 24 * 60 * 60 * 1000)
  const [pendingReviewAcks, pendingViolationAcks] = await Promise.all([
    prisma.performanceReview.findMany({
      where: { status: 'PENDING_ACKNOWLEDGMENT', superAdminApprovedAt: { lte: ackThreshold } },
      select: { id: true, employeeId: true },
      take: 200,
    }),
    prisma.disciplinaryAction.findMany({
      where: { status: 'PENDING_ACKNOWLEDGMENT', superAdminApprovedAt: { lte: ackThreshold } },
      select: { id: true, caseId: true, employeeId: true, employeeAcknowledged: true, managerAcknowledged: true, employee: { select: { reportsToId: true } } },
      take: 200,
    }),
  ])

  if (pendingReviewAcks.length > 0) {
    const title = 'Acknowledgement required'
    const ids = pendingReviewAcks.map((r) => r.id)
    const existing = await existingKeys({ since, title, relatedType: 'REVIEW', relatedIds: ids })

    for (const r of pendingReviewAcks) {
      const k = key(r.employeeId, r.id, title)
      if (existing.has(k)) continue
      await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          title,
          message: 'A performance review is awaiting your acknowledgement.',
          link: `/performance/reviews/${r.id}`,
          employeeId: r.employeeId,
          relatedId: r.id,
          relatedType: 'REVIEW',
        },
      })
      acknowledgmentRemindersCreated += 1
    }
  }

  if (pendingViolationAcks.length > 0) {
    const title = 'Acknowledgement required'
    const ids = pendingViolationAcks.map((v) => v.id)
    const existing = await existingKeys({ since, title, relatedType: 'DISCIPLINARY', relatedIds: ids })

    for (const v of pendingViolationAcks) {
      if (!v.employeeAcknowledged) {
        const k = key(v.employeeId, v.id, title)
        if (!existing.has(k)) {
	          await prisma.notification.create({
	            data: {
	              type: 'SYSTEM',
	              title,
	              message: 'A violation record is awaiting your acknowledgement (or appeal).',
	              link: v.caseId ? `/cases/${v.caseId}` : `/performance/disciplinary/${v.id}`,
	              employeeId: v.employeeId,
	              relatedId: v.id,
	              relatedType: 'DISCIPLINARY',
	            },
	          })
          acknowledgmentRemindersCreated += 1
        }
      }

      if (!v.managerAcknowledged && v.employee.reportsToId) {
        const managerId = v.employee.reportsToId
        const k = key(managerId, v.id, title)
        if (!existing.has(k)) {
	          await prisma.notification.create({
	            data: {
	              type: 'SYSTEM',
	              title,
	              message: 'A violation record is awaiting your manager acknowledgement.',
	              link: v.caseId ? `/cases/${v.caseId}` : `/performance/disciplinary/${v.id}`,
	              employeeId: managerId,
	              relatedId: v.id,
	              relatedType: 'DISCIPLINARY',
	            },
	          })
          acknowledgmentRemindersCreated += 1
        }
      }
    }
  }

  return {
    policyAckRemindersCreated,
    leaveApprovalRemindersCreated,
    reviewRemindersCreated,
    disciplinaryRemindersCreated,
    acknowledgmentRemindersCreated,
  }
}
