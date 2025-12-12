import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import {
  CreateLeavePolicySchema,
  PaginationSchema,
  MAX_PAGINATION_LIMIT,
  LeavePolicyStatusEnum,
  RegionEnum,
  LeaveTypeEnum,
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
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }

    // Filter by region
    const regionParam = searchParams.get('region')
    if (regionParam) {
      const regionValidation = RegionEnum.safeParse(regionParam.toUpperCase())
      if (regionValidation.success) {
        where.region = regionValidation.data
      }
    }

    // Filter by leave type
    const leaveTypeParam = searchParams.get('leaveType')
    if (leaveTypeParam) {
      const leaveTypeValidation = LeaveTypeEnum.safeParse(leaveTypeParam.toUpperCase())
      if (leaveTypeValidation.success) {
        where.leaveType = leaveTypeValidation.data
      }
    }

    // Filter by status
    const statusParam = searchParams.get('status')
    if (statusParam) {
      const statusValidation = LeavePolicyStatusEnum.safeParse(statusParam.toUpperCase())
      if (statusValidation.success) {
        where.status = statusValidation.data
      }
    }

    const [items, total] = await Promise.all([
      prisma.leavePolicy.findMany({
        where,
        take: Math.min(take, MAX_PAGINATION_LIMIT),
        skip,
        orderBy: [{ region: 'asc' }, { leaveType: 'asc' }],
      }),
      prisma.leavePolicy.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch leave policies')
  }
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const body = await req.json()

    const validation = validateBody(CreateLeavePolicySchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    // Check if policy already exists for this region+leaveType
    const existing = await prisma.leavePolicy.findUnique({
      where: {
        region_leaveType: {
          region: data.region,
          leaveType: data.leaveType,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: `A policy for ${data.leaveType} in ${data.region} already exists` },
        { status: 409 }
      )
    }

    const item = await prisma.leavePolicy.create({
      data: {
        region: data.region,
        leaveType: data.leaveType,
        title: data.title,
        description: data.description ?? null,
        entitledDays: data.entitledDays,
        isPaid: data.isPaid,
        carryoverMax: data.carryoverMax ?? null,
        minNoticeDays: data.minNoticeDays,
        maxConsecutive: data.maxConsecutive ?? null,
        rules: data.rules ?? null,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        status: data.status,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create leave policy')
  }
}
