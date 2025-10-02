import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const allowedFields = [
  'productId',
  'orderCode',
  'poDate',
  'quantity',
  'productionWeeks',
  'sourceWeeks',
  'oceanWeeks',
  'finalWeeks',
  'pay1Date',
  'pay1Percent',
  'pay1Amount',
  'pay2Date',
  'pay2Percent',
  'pay2Amount',
  'pay3Date',
  'pay3Percent',
  'pay3Amount',
  'productionStart',
  'productionComplete',
  'sourceDeparture',
  'transportReference',
  'shipName',
  'containerNumber',
  'portEta',
  'inboundEta',
  'availableDate',
  'status',
  'notes',
  'overrideSellingPrice',
  'overrideManufacturingCost',
  'overrideFreightCost',
  'overrideTariffRate',
  'overrideTacosPercent',
  'overrideFbaFee',
  'overrideReferralRate',
  'overrideStoragePerMonth',
] as const

const percentFields: Record<string, true> = {
  pay1Percent: true,
  pay2Percent: true,
  pay3Percent: true,
  overrideTariffRate: true,
  overrideTacosPercent: true,
  overrideReferralRate: true,
}

const decimalFields: Record<string, true> = {
  productionWeeks: true,
  sourceWeeks: true,
  oceanWeeks: true,
  finalWeeks: true,
  pay1Amount: true,
  pay2Amount: true,
  pay3Amount: true,
  overrideSellingPrice: true,
  overrideManufacturingCost: true,
  overrideFreightCost: true,
  overrideFbaFee: true,
  overrideStoragePerMonth: true,
}

const dateFields: Record<string, true> = {
  poDate: true,
  pay1Date: true,
  pay2Date: true,
  pay3Date: true,
  productionStart: true,
  productionComplete: true,
  sourceDeparture: true,
  portEta: true,
  inboundEta: true,
  availableDate: true,
}

const updateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().min(1),
      values: z.record(z.string(), z.string().nullable().optional()),
    })
  ),
})

const createSchema = z.object({
  productId: z.string().min(1),
  orderCode: z.string().trim().min(1).optional(),
  poDate: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(0).optional(),
})

const deleteSchema = z.object({
  id: z.string().min(1),
})

function parseNumber(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(/[$,%]/g, '')
  const parsed = Number(cleaned)
  return Number.isNaN(parsed) ? null : parsed
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await prisma.$transaction(
    parsed.data.updates.map(({ id, values }) => {
      const data: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (!(field in values)) continue
        const incoming = values[field]
        if (incoming === null || incoming === undefined || incoming === '') {
          data[field] = null
          continue
        }

        if (field === 'quantity') {
          data[field] = parseNumber(incoming) ?? null
        } else if (percentFields[field]) {
          const parsedNumber = parseNumber(incoming)
          if (parsedNumber === null) {
            data[field] = null
          } else {
            data[field] = parsedNumber > 1 ? parsedNumber / 100 : parsedNumber
          }
        } else if (decimalFields[field]) {
          data[field] = parseNumber(incoming)
        } else if (dateFields[field]) {
          data[field] = parseDate(incoming)
        } else if (field === 'status') {
          data[field] = incoming as string
        } else if (field === 'productId') {
          data[field] = incoming
        } else if (field === 'orderCode' || field === 'transportReference' || field === 'shipName' || field === 'containerNumber') {
          data[field] = incoming
        } else if (field === 'notes') {
          data[field] = incoming
        }
      }

      return prisma.purchaseOrder.update({ where: { id }, data })
    })
  )

  return NextResponse.json({ ok: true })
}

function generateOrderCode() {
  const random = Math.random().toString(36).slice(-5).toUpperCase()
  return `PO-${random}`
}

async function resolveOrderCode(requested?: string) {
  if (requested) {
    const existing = await prisma.purchaseOrder.findUnique({ where: { orderCode: requested } })
    if (existing) {
      return { error: 'A purchase order with this code already exists.', status: 409 as const }
    }
    return { orderCode: requested }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateOrderCode()
    const conflict = await prisma.purchaseOrder.findUnique({ where: { orderCode: candidate } })
    if (!conflict) {
      return { orderCode: candidate }
    }
  }

  return { error: 'Unable to generate a unique purchase order code. Try again.', status: 503 as const }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { productId, orderCode, quantity, poDate } = parsed.data

  const productExists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
  if (!productExists) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const orderCodeResult = await resolveOrderCode(orderCode)
  if ('error' in orderCodeResult) {
    return NextResponse.json({ error: orderCodeResult.error }, { status: orderCodeResult.status })
  }

  const safeQuantity = quantity ?? 0
  const data = {
    productId,
    orderCode: orderCodeResult.orderCode,
    quantity: safeQuantity,
    poDate: poDate ? parseDate(poDate) : null,
    productionWeeks: new Prisma.Decimal(0),
    sourceWeeks: new Prisma.Decimal(0),
    oceanWeeks: new Prisma.Decimal(0),
    finalWeeks: new Prisma.Decimal(0),
    status: 'PLANNED' as const,
  }

  try {
    const created = await prisma.purchaseOrder.create({ data })

    return NextResponse.json({
      order: {
        id: created.id,
        orderCode: created.orderCode,
        productId: created.productId,
        quantity: created.quantity,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'A purchase order with this code already exists.' }, { status: 409 })
    }
    throw error
  }
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { id } = parsed.data

  try {
    await prisma.purchaseOrder.delete({ where: { id } })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to delete purchase order' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
