import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withXPlanAuth } from '@/lib/api/auth'

// Type assertion for strategy model (Prisma types are generated but not resolved correctly at build time)
const prismaAny = prisma as unknown as Record<string, any>

const DEFAULT_STRATEGY_ID = 'default-strategy'

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  region: z.enum(['US', 'UK']).optional(),
})

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  region: z.enum(['US', 'UK']).optional(),
})

const deleteSchema = z.object({
  id: z.string().min(1),
})

export const GET = withXPlanAuth(async () => {
  const strategies = await prismaAny.strategy.findMany({
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    include: {
      _count: {
        select: {
          products: true,
          purchaseOrders: true,
          salesWeeks: true,
        },
      },
    },
  })

  const hasCanonicalDefault = strategies.some((strategy: any) => strategy.id === DEFAULT_STRATEGY_ID)
  const normalized = strategies.map((strategy: any) => ({
    ...strategy,
    isDefault: hasCanonicalDefault ? strategy.id === DEFAULT_STRATEGY_ID : strategy.isDefault,
  }))

  normalized.sort((a: any, b: any) => {
    const aDefault = a.id === DEFAULT_STRATEGY_ID
    const bDefault = b.id === DEFAULT_STRATEGY_ID
    if (aDefault !== bDefault) return aDefault ? -1 : 1
    const aUpdated = typeof a.updatedAt === 'string' ? a.updatedAt : a.updatedAt?.toISOString?.() ?? ''
    const bUpdated = typeof b.updatedAt === 'string' ? b.updatedAt : b.updatedAt?.toISOString?.() ?? ''
    return bUpdated.localeCompare(aUpdated)
  })

  return NextResponse.json({ strategies: normalized })
})

export const POST = withXPlanAuth(async (request: Request) => {
  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const strategy = await prismaAny.strategy.create({
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim(),
      region: parsed.data.region ?? 'US',
      isDefault: false,
      status: 'DRAFT',
    },
  })

  return NextResponse.json({ strategy })
})

export const PUT = withXPlanAuth(async (request: Request) => {
  const body = await request.json().catch(() => null)

  if (body && typeof body === 'object' && 'isDefault' in body) {
    return NextResponse.json({ error: 'Default strategy cannot be changed' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { id, ...data } = parsed.data

  // If setting this as ACTIVE, set others to DRAFT
  if (data.status === 'ACTIVE') {
    await prismaAny.strategy.updateMany({
      where: { status: 'ACTIVE', id: { not: id } },
      data: { status: 'DRAFT' },
    })
  }

  const strategy = await prismaAny.strategy.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() }),
      ...(data.status && { status: data.status }),
      ...(data.region && { region: data.region }),
    },
  })

  return NextResponse.json({ strategy })
})

export const DELETE = withXPlanAuth(async (request: Request) => {
  const body = await request.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { id } = parsed.data

  // Don't allow deleting the default strategy for existing data.
  if (id === DEFAULT_STRATEGY_ID) {
    return NextResponse.json({ error: 'Cannot delete the default strategy' }, { status: 400 })
  }

  // Cascade delete is handled by Prisma schema
  await prismaAny.strategy.delete({ where: { id } })

  return NextResponse.json({ ok: true })
})
