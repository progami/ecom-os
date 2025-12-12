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

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)

    const paginationResult = PaginationSchema.safeParse({
      take: searchParams.get('take') || undefined,
      skip: searchParams.get('skip') || undefined,
      q: searchParams.get('q') || undefined,
    })

    const take = paginationResult.success ? paginationResult.data.take : 50
    const skip = paginationResult.success ? paginationResult.data.skip : 0
    const q = paginationResult.success ? paginationResult.data.q?.toLowerCase() : ''

    const where: Record<string, unknown> = {}

    if (q) {
      where.OR = [
        { reviewerName: { contains: q, mode: 'insensitive' } },
        { reviewPeriod: { contains: q, mode: 'insensitive' } },
        { employee: { firstName: { contains: q, mode: 'insensitive' } } },
        { employee: { lastName: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const employeeIdParam = searchParams.get('employeeId')
    if (employeeIdParam) {
      where.employeeId = employeeIdParam
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
    })
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const item = await prisma.performanceReview.create({
      data: {
        employeeId: data.employeeId,
        reviewType: data.reviewType,
        reviewPeriod: data.reviewPeriod,
        reviewDate: new Date(data.reviewDate),
        reviewerName: data.reviewerName,
        overallRating: data.overallRating,
        qualityOfWork: data.qualityOfWork ?? null,
        productivity: data.productivity ?? null,
        communication: data.communication ?? null,
        teamwork: data.teamwork ?? null,
        initiative: data.initiative ?? null,
        attendance: data.attendance ?? null,
        strengths: data.strengths ?? null,
        areasToImprove: data.areasToImprove ?? null,
        goals: data.goals ?? null,
        comments: data.comments ?? null,
        status: data.status,
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

    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create performance review')
  }
}
