import { NextResponse } from 'next/server'
import { Prisma, PurchaseOrderStatus } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { mapPurchaseOrders } from '@/lib/calculations/adapters'

const allowedFields = [
  'orderCode',
  'productId',
  'quantity',
  'productionWeeks',
  'sourcePrepWeeks',
  'oceanWeeks',
  'finalMileWeeks',
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
  sourcePrepWeeks: true,
  oceanWeeks: true,
  finalMileWeeks: true,
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
  orderCode: z.string().trim().min(1),
  productId: z.string().min(1),
  transportReference: z.string().optional(),
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
        if (field === 'productId' && (incoming === null || incoming === undefined || incoming === '')) {
          continue
        }

        if (incoming === null || incoming === undefined || incoming === '') {
          data[field] = null
          continue
        }

        if (field === 'quantity') {
          data[field] = parseNumber(incoming) ?? null
        } else if (field === 'productId') {
          data[field] = incoming as string
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
        } else if (field === 'orderCode' || field === 'transportReference') {
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { orderCode, productId, transportReference } = parsed.data

  const productExists = await prisma.product.count({ where: { id: productId } })
  if (productExists === 0) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  try {
    const created = await prisma.purchaseOrder.create({
      data: {
        orderCode: orderCode.trim(),
        productId,
        quantity: 0,
        productionWeeks: new Prisma.Decimal(0),
        sourcePrepWeeks: new Prisma.Decimal(0),
        oceanWeeks: new Prisma.Decimal(0),
        finalMileWeeks: new Prisma.Decimal(0),
        pay1Date: null,
        pay1Percent: null,
        pay1Amount: null,
        pay2Date: null,
        pay2Percent: null,
        pay2Amount: null,
        pay3Date: null,
        pay3Percent: null,
        pay3Amount: null,
        productionStart: null,
        productionComplete: null,
        sourceDeparture: null,
        transportReference: transportReference?.trim() ? transportReference.trim() : null,
        portEta: null,
        inboundEta: null,
        availableDate: null,
        totalLeadDays: null,
        status: PurchaseOrderStatus.PLANNED,
        statusIcon: null,
        weeksUntilArrival: null,
        notes: null,
        overrideSellingPrice: null,
        overrideManufacturingCost: null,
        overrideFreightCost: null,
        overrideTariffRate: null,
        overrideTacosPercent: null,
        overrideFbaFee: null,
        overrideReferralRate: null,
        overrideStoragePerMonth: null,
      },
      include: { payments: { orderBy: { paymentIndex: 'asc' } } },
    })

    const [order] = mapPurchaseOrders([created])
    return NextResponse.json({ order })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Unable to create purchase order' }, { status: 500 })
  }
}
