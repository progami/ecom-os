import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import {
  CreateResourceSchema,
  PaginationSchema,
  MAX_PAGINATION_LIMIT,
  ResourceCategoryEnum,
} from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getHREmployees, isHROrAbove } from '@/lib/permissions'
import { getCurrentEmployeeId } from '@/lib/current-user'

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

    // Parse subcategories
    const subs = [...searchParams.getAll('subcategory')]
    const csv = (searchParams.get('subcategories') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const subcategories = [...subs, ...csv].slice(0, 20) // Limit to 20 subcategories

    const where: Record<string, unknown> = {}

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }

    // Validate category enum
    const categoryParam = searchParams.get('category')
    if (categoryParam) {
      const categoryValidation = ResourceCategoryEnum.safeParse(categoryParam.toUpperCase())
      if (categoryValidation.success) {
        where.category = categoryValidation.data
      }
    }

    if (subcategories.length) {
      where.subcategory = { in: subcategories }
    }

    const [items, total] = await Promise.all([
      prisma.resource.findMany({
        where,
        take: Math.min(take, MAX_PAGINATION_LIMIT),
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.resource.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch resources')
  }
}

export async function POST(req: Request) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    // Security: Only HR or super-admin can create resources
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasPermission = await isHROrAbove(actorId)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Only HR or super admin can create resources' }, { status: 403 })
    }

    const body = await req.json()

    // Validate input
    const validation = validateBody(CreateResourceSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    // Check for duplicate by website if provided
    if (data.website) {
      const existing = await prisma.resource.findFirst({
        where: { website: data.website },
      })
      if (existing) {
        return NextResponse.json(
          { error: 'A resource with this website already exists', existing },
          { status: 409 }
        )
      }
    }

    const item = await prisma.resource.create({
      data: {
        name: data.name,
        category: data.category,
        subcategory: data.subcategory ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        website: data.website ?? null,
        description: data.description ?? null,
        rating: data.rating ?? null,
      },
    })

    // Notify HR about the new resource
    const hrEmployees = await getHREmployees()
    for (const hr of hrEmployees) {
      await prisma.notification.create({
        data: {
          type: 'RESOURCE_CREATED',
          title: 'New Resource Added',
          message: `A new ${data.category.toLowerCase()} resource "${data.name}" has been added.`,
          link: `/resources`,
          employeeId: hr.id,
          relatedId: item.id,
          relatedType: 'RESOURCE',
        },
      })
    }

    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create resource')
  }
}
