import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import {
  CreatePolicySchema,
  PaginationSchema,
  MAX_PAGINATION_LIMIT,
  PolicyCategoryEnum,
  PolicyStatusEnum,
  RegionEnum,
} from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'

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

    // Validate region enum
    const regionParam = searchParams.get('region')
    if (regionParam) {
      const regionValidation = RegionEnum.safeParse(regionParam.toUpperCase())
      if (regionValidation.success) {
        where.region = regionValidation.data
      }
    }

    const [items, total] = await Promise.all([
      prisma.policy.findMany({
        where,
        take: Math.min(take, MAX_PAGINATION_LIMIT),
        skip,
        orderBy: { title: 'asc' },
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
    // Security: Only HR or super-admin can create policies
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasPermission = await isHROrAbove(actorId)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Only HR or super admin can create policies' }, { status: 403 })
    }

    const body = await req.json()

    // Validate input
    const validation = validateBody(CreatePolicySchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    // Check for duplicate effective date
    if (data.effectiveDate) {
      const existingWithDate = await prisma.policy.findFirst({
        where: { effectiveDate: new Date(data.effectiveDate) },
      })
      if (existingWithDate) {
        return NextResponse.json(
          { error: `Another policy already has effective date ${data.effectiveDate}` },
          { status: 400 }
        )
      }
    }

    const item = await prisma.policy.create({
      data: {
        title: data.title,
        category: data.category,
        region: data.region,
        summary: data.summary ?? null,
        content: data.content ?? null,
        fileUrl: data.fileUrl ?? null,
        version: data.version,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
        status: data.status,
      },
    })

    // Company-wide notification
    await prisma.notification.create({
      data: {
        type: 'POLICY_CREATED',
        title: 'New Policy Published',
        message: `The policy "${item.title}" has been published.`,
        link: `/policies/${item.id}`,
        employeeId: null, // Broadcast
        relatedId: item.id,
        relatedType: 'POLICY',
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create policy')
  }
}
