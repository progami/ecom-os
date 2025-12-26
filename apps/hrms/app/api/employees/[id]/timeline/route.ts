import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove, isManagerOf } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

type TimelineEvent = {
  id: string
  type: string
  title: string
  description: string | null
  occurredAt: string
  href: string | null
}

function iso(date: Date): string {
  return date.toISOString()
}

function formatLeaveType(raw: string): string {
  return raw.replaceAll('_', ' ').toLowerCase()
}

export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isHR = await isHROrAbove(actorId)

    const target = await prisma.employee.findFirst({
      where: { OR: [{ id }, { employeeId: id }] },
      select: { id: true, status: true },
    })

    if (!target) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isSelf = actorId === target.id
    if (!isHR && !isSelf && target.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let canView = isSelf || isHR
    if (!canView) {
      const isManager = await isManagerOf(actorId, target.id)
      canView = isManager
    }

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const takeRaw = searchParams.get('take')
    const take = Math.min(parseInt(takeRaw ?? '200', 10), 500)

    const [leaves, reviews, violations, policyAcks, cases, tasks] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { employeeId: target.id },
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
        select: {
          id: true,
          status: true,
          leaveType: true,
          totalDays: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          reviewedAt: true,
        },
      }),
      prisma.performanceReview.findMany({
        where: { employeeId: target.id },
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
        select: {
          id: true,
          reviewType: true,
          status: true,
          createdAt: true,
          submittedAt: true,
          hrReviewedAt: true,
          superAdminApprovedAt: true,
          acknowledgedAt: true,
          deadline: true,
        },
      }),
      prisma.disciplinaryAction.findMany({
        where: { employeeId: target.id },
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
        select: {
          id: true,
          caseId: true,
          severity: true,
          violationType: true,
          status: true,
          createdAt: true,
          incidentDate: true,
          reportedDate: true,
          appealedAt: true,
          appealResolvedAt: true,
        },
      }),
      prisma.policyAcknowledgement.findMany({
        where: { employeeId: target.id },
        orderBy: [{ acknowledgedAt: 'desc' }],
        take: 200,
        select: {
          id: true,
          policyId: true,
          policyVersion: true,
          acknowledgedAt: true,
          policy: { select: { title: true } },
        },
      }),
      prisma.case.findMany({
        where: { subjectEmployeeId: target.id },
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
        select: {
          id: true,
          caseNumber: true,
          caseType: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.task.findMany({
        where: { subjectEmployeeId: target.id },
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
        select: {
          id: true,
          title: true,
          status: true,
          category: true,
          createdAt: true,
          completedAt: true,
          dueDate: true,
        },
      }),
    ])

    const events: TimelineEvent[] = []

    for (const leave of leaves) {
      const occurredAt = leave.reviewedAt ?? leave.createdAt
      const title = leave.status === 'APPROVED'
        ? 'Leave approved'
        : leave.status === 'REJECTED'
          ? 'Leave rejected'
          : leave.status === 'CANCELLED'
            ? 'Leave cancelled'
            : 'Leave requested'

      events.push({
        id: `LEAVE:${leave.id}`,
        type: 'LEAVE',
        title,
        description: `${formatLeaveType(leave.leaveType)} • ${leave.totalDays} days`,
        occurredAt: iso(occurredAt),
        href: `/leaves/${leave.id}`,
      })
    }

    for (const review of reviews) {
      const occurredAt =
        review.acknowledgedAt ??
        review.superAdminApprovedAt ??
        review.hrReviewedAt ??
        review.submittedAt ??
        review.createdAt

      const title = `Performance review (${review.reviewType.replaceAll('_', ' ').toLowerCase()})`
      const description = `Status: ${review.status.replaceAll('_', ' ')}`

      events.push({
        id: `REVIEW:${review.id}`,
        type: 'PERFORMANCE_REVIEW',
        title,
        description,
        occurredAt: iso(occurredAt),
        href: `/performance/reviews/${review.id}`,
      })
    }

    for (const violation of violations) {
      const occurredAt =
        violation.appealResolvedAt ??
        violation.appealedAt ??
        violation.reportedDate ??
        violation.createdAt

      const title = `Violation (${violation.severity.toLowerCase()})`
      const description = `${violation.violationType.replaceAll('_', ' ').toLowerCase()} • ${violation.status.replaceAll('_', ' ').toLowerCase()}`

      events.push({
        id: `VIOLATION:${violation.id}`,
        type: 'DISCIPLINARY_ACTION',
        title,
        description,
        occurredAt: iso(occurredAt),
        href: violation.caseId ? `/cases/${violation.caseId}` : `/performance/disciplinary/${violation.id}`,
      })
    }

    for (const ack of policyAcks) {
      events.push({
        id: `POLICY_ACK:${ack.id}`,
        type: 'POLICY_ACKNOWLEDGEMENT',
        title: 'Policy acknowledged',
        description: `${ack.policy.title} • v${ack.policyVersion}`,
        occurredAt: iso(ack.acknowledgedAt),
        href: `/policies/${ack.policyId}`,
      })
    }

    for (const c of cases) {
      events.push({
        id: `CASE:${c.id}`,
        type: 'CASE',
        title: `Case #${c.caseNumber} (${c.caseType.toLowerCase()})`,
        description: `${c.title} • ${c.status.replaceAll('_', ' ').toLowerCase()}`,
        occurredAt: iso(c.createdAt),
        href: `/cases/${c.id}`,
      })
    }

    for (const task of tasks) {
      const occurredAt = task.completedAt ?? task.createdAt
      const title = task.status === 'DONE' ? 'Task completed' : 'Task'
      const description = `${task.title} • ${task.category.toLowerCase()} • ${task.status.replaceAll('_', ' ').toLowerCase()}`

      events.push({
        id: `TASK:${task.id}`,
        type: 'TASK',
        title,
        description,
        occurredAt: iso(occurredAt),
        href: `/tasks/${task.id}`,
      })
    }

    events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

    return NextResponse.json({ items: events.slice(0, take), total: events.length })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch employee timeline')
  }
}
