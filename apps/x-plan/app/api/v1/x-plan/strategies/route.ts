import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

// Type assertion for strategy model (Prisma types are generated but not resolved correctly at build time)
const prismaAny = prisma as unknown as Record<string, any>

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  isDefault: z.boolean().optional(),
})

const deleteSchema = z.object({
  id: z.string().min(1),
})

export async function GET() {
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
  return NextResponse.json({ strategies })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Check if this is the first strategy - make it default
  const count = await prismaAny.strategy.count()
  const isDefault = count === 0

  const strategy = await prismaAny.strategy.create({
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim(),
      isDefault,
      status: isDefault ? 'ACTIVE' : 'DRAFT',
    },
  })

  return NextResponse.json({ strategy })
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { id, ...data } = parsed.data

  // If setting this as default, unset other defaults
  if (data.isDefault) {
    await prismaAny.strategy.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    })
  }

  const strategy = await prismaAny.strategy.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() }),
      ...(data.status && { status: data.status }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
    },
  })

  return NextResponse.json({ strategy })
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { id } = parsed.data

  // Don't allow deleting the default strategy
  const strategy = await prismaAny.strategy.findUnique({ where: { id } })
  if (strategy?.isDefault) {
    return NextResponse.json({ error: 'Cannot delete the default strategy' }, { status: 400 })
  }

  // Cascade delete is handled by Prisma schema
  await prismaAny.strategy.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
