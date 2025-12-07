import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import {
  CreatePolicySchema,
  PaginationSchema,
  MAX_PAGINATION_LIMIT,
  PolicyCategoryEnum,
  PolicyStatusEnum,
} from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)

    // Validate pagination params
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
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
      ]
    }

    // Validate category enum
    const categoryParam = searchParams.get('category')
    if (categoryParam) {
      const categoryValidation = PolicyCategoryEnum.safeParse(categoryParam.toUpperCase())
      if (categoryValidation.success) {
        where.category = categoryValidation.data
      }
    }

    // Validate status enum
    const statusParam = searchParams.get('status')
    if (statusParam) {
      const statusValidation = PolicyStatusEnum.safeParse(statusParam.toUpperCase())
      if (statusValidation.success) {
        where.status = statusValidation.data
      }
    }

    const [items, total] = await Promise.all([
      prisma.policy.findMany({
        where,
        take: Math.min(take, MAX_PAGINATION_LIMIT),
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.policy.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch policies')
  }
}

export async function POST(req: Request) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const body = await req.json()

    // Validate input
    const validation = validateBody(CreatePolicySchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    const item = await prisma.policy.create({
      data: {
        title: data.title,
        category: data.category,
        summary: data.summary ?? null,
        content: data.content ?? null,
        fileUrl: data.fileUrl ?? null,
        version: data.version ?? null,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
        status: data.status,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create policy')
  }
}
