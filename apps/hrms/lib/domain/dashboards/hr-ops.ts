import { prisma } from '@/lib/prisma'

export type HrOpsDashboardWorkItem = {
  id: string
  href: string
  title: string
  subtitle: string
  createdAt?: string | null
  dueAt?: string | null
}

export type HrOpsDashboardSnapshot = {
  generatedAt: string
  overdue: {
    leaves: { count: number; items: HrOpsDashboardWorkItem[] }
    reviews: { count: number; items: HrOpsDashboardWorkItem[] }
    violations: { count: number; items: HrOpsDashboardWorkItem[] }
    acknowledgements: { count: number; items: HrOpsDashboardWorkItem[] }
  }
  cases: {
    byStatus: Record<string, number>
    bySeverity: Record<string, number>
  }
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

function fmtAge(from: Date): string {
  const diffDays = Math.max(0, Math.floor((Date.now() - from.getTime()) / 86_400_000))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return '1 day'
  return `${diffDays} days`
}

function iso(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString()
}

export async function getHrOpsDashboardSnapshot(options?: {
  take?: number
  approvalThresholdDays?: number
  ackThresholdDays?: number
}): Promise<HrOpsDashboardSnapshot> {
  const take = options?.take ?? 50
  const approvalThresholdDays = options?.approvalThresholdDays ?? 1
  const ackThresholdDays = options?.ackThresholdDays ?? 3

  const approvalThreshold = daysAgo(approvalThresholdDays)
  const ackThreshold = daysAgo(ackThresholdDays)

  const [
    pendingLeaves,
    pendingHrReviews,
    pendingAdminReviews,
    pendingHrViolations,
    pendingAdminViolations,
    pendingAcksReviews,
    pendingAcksViolations,
    casesByStatus,
    casesBySeverity,
  ] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { status: 'PENDING', createdAt: { lte: approvalThreshold } },
      take,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        totalDays: true,
        leaveType: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.performanceReview.findMany({
      where: { status: 'PENDING_HR_REVIEW', submittedAt: { lte: approvalThreshold } },
      take,
      orderBy: { submittedAt: 'asc' },
      select: {
        id: true,
        submittedAt: true,
        reviewPeriod: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.performanceReview.findMany({
      where: { status: 'PENDING_SUPER_ADMIN', hrReviewedAt: { lte: approvalThreshold } },
      take,
      orderBy: { hrReviewedAt: 'asc' },
      select: {
        id: true,
        hrReviewedAt: true,
        reviewPeriod: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.disciplinaryAction.findMany({
      where: { status: 'PENDING_HR_REVIEW', reportedDate: { lte: approvalThreshold } },
      take,
      orderBy: { reportedDate: 'asc' },
      select: {
        id: true,
        caseId: true,
        reportedDate: true,
        severity: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.disciplinaryAction.findMany({
      where: { status: 'PENDING_SUPER_ADMIN', hrReviewedAt: { lte: approvalThreshold } },
      take,
      orderBy: { hrReviewedAt: 'asc' },
      select: {
        id: true,
        caseId: true,
        hrReviewedAt: true,
        severity: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.performanceReview.findMany({
      where: { status: 'PENDING_ACKNOWLEDGMENT', superAdminApprovedAt: { lte: ackThreshold } },
      take,
      orderBy: { superAdminApprovedAt: 'asc' },
      select: {
        id: true,
        superAdminApprovedAt: true,
        reviewPeriod: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.disciplinaryAction.findMany({
      where: { status: 'PENDING_ACKNOWLEDGMENT', superAdminApprovedAt: { lte: ackThreshold } },
      take,
      orderBy: { superAdminApprovedAt: 'asc' },
      select: {
        id: true,
        caseId: true,
        superAdminApprovedAt: true,
        severity: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.case.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.case.groupBy({
      by: ['severity'],
      _count: { _all: true },
    }),
  ])

  return {
    generatedAt: new Date().toISOString(),
    overdue: {
      leaves: {
        count: pendingLeaves.length,
        items: pendingLeaves.map((l) => ({
          id: l.id,
          href: `/leaves/${l.id}`,
          title: `Leave approval • ${l.employee.firstName} ${l.employee.lastName}`,
          subtitle: `${l.leaveType} • ${l.totalDays} days • requested ${fmtAge(l.createdAt)} ago`,
          createdAt: iso(l.createdAt),
        })),
      },
      reviews: {
        count: pendingHrReviews.length + pendingAdminReviews.length,
        items: [
          ...pendingHrReviews.map((r) => ({
            id: r.id,
            href: `/performance/reviews/${r.id}`,
            title: `Review pending HR • ${r.employee.firstName} ${r.employee.lastName}`,
            subtitle: `${r.reviewPeriod} • submitted ${r.submittedAt ? fmtAge(r.submittedAt) : '—'} ago`,
            createdAt: iso(r.submittedAt),
          })),
          ...pendingAdminReviews.map((r) => ({
            id: r.id,
            href: `/performance/reviews/${r.id}`,
            title: `Review pending final • ${r.employee.firstName} ${r.employee.lastName}`,
            subtitle: `${r.reviewPeriod} • waiting ${r.hrReviewedAt ? fmtAge(r.hrReviewedAt) : '—'} ago`,
            createdAt: iso(r.hrReviewedAt),
          })),
        ],
      },
      violations: {
        count: pendingHrViolations.length + pendingAdminViolations.length,
        items: [
          ...pendingHrViolations.map((v) => ({
            id: v.id,
            href: v.caseId ? `/cases/${v.caseId}` : `/performance/disciplinary/${v.id}`,
            title: `Violation pending HR • ${v.employee.firstName} ${v.employee.lastName}`,
            subtitle: `${v.severity} • reported ${fmtAge(v.reportedDate)} ago`,
            createdAt: iso(v.reportedDate),
          })),
          ...pendingAdminViolations.map((v) => ({
            id: v.id,
            href: v.caseId ? `/cases/${v.caseId}` : `/performance/disciplinary/${v.id}`,
            title: `Violation pending final • ${v.employee.firstName} ${v.employee.lastName}`,
            subtitle: `${v.severity} • waiting ${v.hrReviewedAt ? fmtAge(v.hrReviewedAt) : '—'} ago`,
            createdAt: iso(v.hrReviewedAt),
          })),
        ],
      },
      acknowledgements: {
        count: pendingAcksReviews.length + pendingAcksViolations.length,
        items: [
          ...pendingAcksReviews.map((r) => ({
            id: r.id,
            href: `/performance/reviews/${r.id}`,
            title: `Ack required • ${r.employee.firstName} ${r.employee.lastName}`,
            subtitle: `${r.reviewPeriod} • pending ${r.superAdminApprovedAt ? fmtAge(r.superAdminApprovedAt) : '—'} ago`,
            createdAt: iso(r.superAdminApprovedAt),
          })),
          ...pendingAcksViolations.map((v) => ({
            id: v.id,
            href: v.caseId ? `/cases/${v.caseId}` : `/performance/disciplinary/${v.id}`,
            title: `Ack required • ${v.employee.firstName} ${v.employee.lastName}`,
            subtitle: `${v.severity} • pending ${v.superAdminApprovedAt ? fmtAge(v.superAdminApprovedAt) : '—'} ago`,
            createdAt: iso(v.superAdminApprovedAt),
          })),
        ],
      },
    },
    cases: {
      byStatus: casesByStatus.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = row._count._all
        return acc
      }, {}),
      bySeverity: casesBySeverity.reduce<Record<string, number>>((acc, row) => {
        acc[row.severity] = row._count._all
        return acc
      }, {}),
    },
  }
}
