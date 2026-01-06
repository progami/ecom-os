import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import {
  CreatePerformanceReviewSchema,
  PaginationSchema,
  MAX_PAGINATION_LIMIT,
  ReviewTypeEnum,
  ReviewStatusEnum,
} from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canRaiseViolation, getHREmployees, getSubtreeEmployeeIds, isHROrAbove, isManagerOf } from '@/lib/permissions'
import { formatReviewPeriod, type ReviewPeriodType } from '@/lib/review-period'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)

    // Authentication check
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isHR = await isHROrAbove(currentEmployeeId)

    const paginationResult = PaginationSchema.safeParse({
      take: searchParams.get('take') || undefined,
      skip: searchParams.get('skip') || undefined,
      q: searchParams.get('q') || undefined,
    })

    const take = paginationResult.success ? paginationResult.data.take : 50
    const skip = paginationResult.success ? paginationResult.data.skip : 0
    const q = paginationResult.success ? paginationResult.data.q?.toLowerCase() : ''

    const where: Record<string, unknown> = {}

    // Access control: restrict what reviews can be viewed
    const employeeIdParam = searchParams.get('employeeId')

    // Build access control constraint
    let accessConstraint: Record<string, unknown> | null = null

    if (employeeIdParam) {
      const isSelf = employeeIdParam === currentEmployeeId
      if (!isSelf && !isHR) {
        const isManager = await isManagerOf(currentEmployeeId, employeeIdParam)
        if (!isManager) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
      accessConstraint = { employeeId: employeeIdParam }
    } else if (!isHR) {
      // No specific employee - restrict to (own + subtree) OR (assigned as reviewer)
      const subtreeIds = await getSubtreeEmployeeIds(currentEmployeeId)
      accessConstraint = {
        OR: [
          { employeeId: { in: [currentEmployeeId, ...subtreeIds] } },
          { assignedReviewerId: currentEmployeeId },
        ],
      }
    }

    // Build search constraint
    const searchConstraint = q
      ? {
          OR: [
            { reviewerName: { contains: q, mode: 'insensitive' } },
            { reviewPeriod: { contains: q, mode: 'insensitive' } },
            { employee: { firstName: { contains: q, mode: 'insensitive' } } },
            { employee: { lastName: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : null

    // Combine constraints with AND
    const andConditions = [accessConstraint, searchConstraint].filter(Boolean)
    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    const reviewTypeParam = searchParams.get('reviewType')
    if (reviewTypeParam) {
      const typeValidation = ReviewTypeEnum.safeParse(reviewTypeParam.toUpperCase())
      if (typeValidation.success) {
        where.reviewType = typeValidation.data
      }
    }

    const statusParam = searchParams.get('status')
    if (statusParam) {
      const statusValidation = ReviewStatusEnum.safeParse(statusParam.toUpperCase())
      if (statusValidation.success) {
        where.status = statusValidation.data
      }
    }

    const [items, total] = await Promise.all([
      prisma.performanceReview.findMany({
        where,
        take: Math.min(take, MAX_PAGINATION_LIMIT),
        skip,
        orderBy: { reviewDate: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
              position: true,
            },
          },
          quarterlyCycle: {
            select: {
              id: true,
              reviewPeriod: true,
              deadline: true,
            },
          },
        },
      }),
      prisma.performanceReview.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch performance reviews')
  }
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const body = await req.json()

    const validation = validateBody(CreatePerformanceReviewSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        reportsToId: true,
      },
    })
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check if current user has permission to create review for this employee
    // Uses same permission as raising violations (Manager for reports, HR/Admin for anyone)
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    const permissionCheck = await canRaiseViolation(currentEmployeeId, data.employeeId)
    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: `Permission denied: ${permissionCheck.reason}` },
        { status: 403 }
      )
    }

    const roleTitle = data.roleTitle ?? employee.position
    if (!roleTitle || !roleTitle.trim()) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }

    const assignedReviewerId = data.assignedReviewerId ?? employee.reportsToId
    if (!assignedReviewerId) {
      return NextResponse.json({ error: 'Employee has no manager. Select a manager to continue.' }, { status: 400 })
    }

    const assignedReviewer = await prisma.employee.findUnique({
      where: { id: assignedReviewerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    })
    if (!assignedReviewer) {
      return NextResponse.json({ error: 'Selected manager was not found' }, { status: 400 })
    }

    // Prevent multiple reviews for the same role in the same period
    const duplicate = await prisma.performanceReview.findFirst({
      where: {
        employeeId: data.employeeId,
        roleTitle: roleTitle.trim(),
        periodType: data.periodType,
        periodYear: data.periodYear,
      },
      select: { id: true },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: 'A performance review already exists for this role and period.' },
        { status: 409 }
      )
    }

    const reviewerName = `${assignedReviewer.firstName} ${assignedReviewer.lastName}`

    const item = await prisma.performanceReview.create({
	      data: {
	        employeeId: data.employeeId,
	        reviewType: data.reviewType,
	        periodType: data.periodType,
	        periodYear: data.periodYear,
	        reviewPeriod: formatReviewPeriod(data.periodType as ReviewPeriodType, data.periodYear),
	        reviewDate: new Date(data.reviewDate),
	        reviewerName,
	        roleTitle: roleTitle.trim(),
	        assignedReviewerId: assignedReviewer.id,
	        overallRating: data.overallRating,
	        qualityOfWork: data.qualityOfWork ?? null,
	        productivity: data.productivity ?? null,
	        communication: data.communication ?? null,
	        teamwork: data.teamwork ?? null,
        initiative: data.initiative ?? null,
        attendance: data.attendance ?? null,
        // Values-based ratings
        ratingPrecision: data.ratingPrecision ?? null,
        ratingTransparency: data.ratingTransparency ?? null,
        ratingReliability: data.ratingReliability ?? null,
        ratingInitiative: data.ratingInitiative ?? null,
        // Self-assessment ratings
        selfRatingPrecision: data.selfRatingPrecision ?? null,
        selfRatingTransparency: data.selfRatingTransparency ?? null,
        selfRatingReliability: data.selfRatingReliability ?? null,
        selfRatingInitiative: data.selfRatingInitiative ?? null,
        // Computed values (values-based scoring removed - enterprise feature)
        valuesScore: null,
        valuesVetoApplied: false,
        valuesVetoReason: null,
        // Justifications
        lowHonestyJustification: data.lowHonestyJustification ?? null,
        lowIntegrityJustification: data.lowIntegrityJustification ?? null,
        strengths: data.strengths ?? null,
        areasToImprove: data.areasToImprove ?? null,
        goals: data.goals ?? null,
        comments: data.comments ?? null,
        // If not DRAFT, start approval chain with PENDING_HR_REVIEW
	        status: data.status === 'DRAFT' ? 'DRAFT' : 'PENDING_HR_REVIEW',
	      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    })

	    // Notify HR if review is submitted for approval
	    if (data.status !== 'DRAFT') {
      const hrEmployees = await getHREmployees()
      for (const hr of hrEmployees) {
        await prisma.notification.create({
          data: {
            type: 'REVIEW_PENDING_HR',
            title: 'Performance Review Pending',
            message: `A performance review for ${item.employee.firstName} ${item.employee.lastName} needs your review.`,
            link: `/performance/reviews/${item.id}`,
            employeeId: hr.id,
            relatedId: item.id,
            relatedType: 'REVIEW',
          },
        })
      }

	      // Notify the employee being reviewed
	      await prisma.notification.create({
	        data: {
	          type: 'REVIEW_SUBMITTED',
	          title: 'Performance Review Submitted',
	          message: `A performance review has been submitted for you by ${reviewerName}.`,
	          link: `/performance/reviews/${item.id}`,
	          employeeId: data.employeeId,
	          relatedId: item.id,
	          relatedType: 'REVIEW',
	        },
      })
    }

    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create performance review')
  }
}
