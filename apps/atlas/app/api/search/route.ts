import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { getOrgVisibleEmployeeIds, isHROrAbove } from '@/lib/permissions'

type SearchResult =
  | { type: 'EMPLOYEE'; id: string; title: string; subtitle?: string; href: string }
  | { type: 'REVIEW'; id: string; title: string; subtitle?: string; href: string }
  | { type: 'TASK'; id: string; title: string; subtitle?: string; href: string }
  | { type: 'POLICY'; id: string; title: string; subtitle?: string; href: string }

function normalizeQuery(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ')
}

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const qRaw = normalizeQuery(searchParams.get('q'))
    if (qRaw.length < 2) {
      return NextResponse.json({ results: [] satisfies SearchResult[] })
    }

    const q = qRaw.toLowerCase()
    const isHR = await isHROrAbove(actorId)
    const take = 6

    const visibleIds = isHR ? null : await getOrgVisibleEmployeeIds(actorId)

    const employeeWhere = isHR
      ? {
          status: 'ACTIVE',
          OR: [
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { employeeId: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {
          status: 'ACTIVE',
          id: { in: visibleIds ?? [actorId] },
          OR: [
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { employeeId: { contains: q, mode: 'insensitive' as const } },
          ],
        }

    const taskWhere = isHR
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {
          OR: [
            { createdById: actorId },
            { assignedToId: actorId },
            { subjectEmployeeId: actorId },
          ],
          AND: [
            {
              OR: [
                { title: { contains: q, mode: 'insensitive' as const } },
                { description: { contains: q, mode: 'insensitive' as const } },
              ],
            },
          ],
        }

    const reviewWhere = isHR
      ? {
          OR: [
            { reviewPeriod: { contains: q, mode: 'insensitive' as const } },
            { roleTitle: { contains: q, mode: 'insensitive' as const } },
            { employee: { firstName: { contains: q, mode: 'insensitive' as const } } },
            { employee: { lastName: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {
          OR: [
            { employeeId: actorId },
            { assignedReviewerId: actorId },
          ],
          AND: [
            {
              OR: [
                { reviewPeriod: { contains: q, mode: 'insensitive' as const } },
                { roleTitle: { contains: q, mode: 'insensitive' as const } },
              ],
            },
          ],
        }

    const policyWhere = {
      status: 'ACTIVE',
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { summary: { contains: q, mode: 'insensitive' as const } },
      ],
    }

    const [employees, tasks, reviews, policies] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere as any,
        take,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: { id: true, employeeId: true, firstName: true, lastName: true, department: true, position: true },
      }),
      prisma.task.findMany({
        where: taskWhere as any,
        take,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        select: { id: true, title: true, status: true, category: true, dueDate: true },
      }),
      prisma.performanceReview.findMany({
        where: reviewWhere as any,
        take,
        orderBy: { reviewDate: 'desc' },
        select: {
          id: true,
          reviewPeriod: true,
          status: true,
          employee: { select: { firstName: true, lastName: true, employeeId: true } },
        },
      }),
      prisma.policy.findMany({
        where: policyWhere as any,
        take,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, version: true },
      }),
    ])

    const results: SearchResult[] = [
      ...employees.map((e) => ({
        type: 'EMPLOYEE' as const,
        id: e.id,
        title: `${e.firstName} ${e.lastName}`.trim(),
        subtitle: `${e.employeeId} • ${e.department} • ${e.position}`,
        href: `/employees/${e.id}`,
      })),
      ...tasks.map((t) => ({
        type: 'TASK' as const,
        id: t.id,
        title: t.title,
        subtitle: `${t.category} • ${t.status}${t.dueDate ? ` • due ${t.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`,
        href: `/tasks/${t.id}`,
      })),
      ...reviews.map((r) => ({
        type: 'REVIEW' as const,
        id: r.id,
        title: `Review • ${r.employee.firstName} ${r.employee.lastName}`,
        subtitle: `${r.reviewPeriod} • ${r.status}`,
        href: `/performance/reviews/${r.id}`,
      })),
      ...policies.map((p) => ({
        type: 'POLICY' as const,
        id: p.id,
        title: p.title,
        subtitle: `v${p.version}`,
        href: `/policies/${p.id}`,
      })),
    ]

    return NextResponse.json({ results })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to search')
  }
}
