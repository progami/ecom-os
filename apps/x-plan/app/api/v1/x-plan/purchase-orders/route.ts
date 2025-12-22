import { NextResponse } from 'next/server'
import { Prisma } from '@ecom-os/prisma-x-plan'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { OPS_STAGE_DEFAULT_LABELS } from '@/lib/business-parameter-labels'
import { withXPlanAuth } from '@/lib/api/auth'

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
  overrideTariffRate: true,
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
  strategyId: z.string().min(1),
  productId: z.string().min(1),
  orderCode: z.string().trim().min(1).optional(),
  poDate: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(0).optional(),
})

const deleteSchema = z.object({
  id: z.string().min(1),
})

const STAGE_DEFAULT_LABEL_SET = Object.values(OPS_STAGE_DEFAULT_LABELS)

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

type StageDefaultsMap = Record<string, number>

type StageParameterRow = {
  label?: string | null
  valueNumeric?: Prisma.Decimal | number | null
}

function buildStageDefaultsMap(rows: StageParameterRow[]): StageDefaultsMap {
  return rows.reduce((map, row) => {
    const key = row.label?.trim().toLowerCase()
    if (!key) return map
    const numericValue = row.valueNumeric
    let numeric: number
    if (numericValue == null) {
      numeric = NaN
    } else if (typeof numericValue === 'number') {
      numeric = numericValue
    } else {
      numeric = Number(numericValue)
    }
    if (Number.isFinite(numeric) && numeric > 0) {
      map[key] = numeric
    }
    return map
  }, {} as StageDefaultsMap)
}

function resolveStageDefaultWeeks(map: StageDefaultsMap, label: string): number {
  const key = label.trim().toLowerCase()
  const value = map[key]
  if (Number.isFinite(value) && value && value > 0) {
    return value
  }
  return 1
}

export const PUT = withXPlanAuth(async (request: Request) => {
  const body = await request.json().catch(() => null)
  console.log('[PUT /purchase-orders] body:', JSON.stringify(body, null, 2))
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    console.log('[PUT /purchase-orders] validation error:', parsed.error.format())
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.format() }, { status: 400 })
  }

  try {
    // Pre-validate orderCode uniqueness before attempting batch update
    const orderCodeUpdates = parsed.data.updates
      .filter(({ values }) => values.orderCode && values.orderCode.trim() !== '')
      .map(({ id, values }) => ({ id, orderCode: values.orderCode!.trim() }))

    if (orderCodeUpdates.length > 0) {
      // Get the strategyId from one of the orders being updated
      const ordersBeingUpdated = (await prisma.purchaseOrder.findMany({
        where: { id: { in: orderCodeUpdates.map((u) => u.id) } },
        select: { id: true, strategyId: true },
      })) as unknown as { id: string; strategyId: string }[]
      const strategyIds = [...new Set(ordersBeingUpdated.map((o) => o.strategyId))]

      const existingOrders = (await prisma.purchaseOrder.findMany({
        where: {
          strategyId: { in: strategyIds },
          orderCode: { in: orderCodeUpdates.map((u) => u.orderCode) },
        },
        select: { id: true, orderCode: true, strategyId: true },
      })) as unknown as { id: string; orderCode: string; strategyId: string }[]

      // Check if any orderCode would conflict with a different PO in the same strategy
      for (const update of orderCodeUpdates) {
        const orderBeingUpdated = ordersBeingUpdated.find((o) => o.id === update.id)
        const conflict = existingOrders.find(
          (existing) =>
            existing.orderCode === update.orderCode &&
            existing.id !== update.id &&
            existing.strategyId === orderBeingUpdated?.strategyId
        )
        if (conflict) {
          const errorMessage = `Order code "${update.orderCode}" is already in use by another purchase order.`
          console.log('[PUT /purchase-orders] returning 409:', errorMessage)
          return new Response(JSON.stringify({ error: errorMessage }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }
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
    console.log('[PUT /purchase-orders] success')
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PUT /purchase-orders] error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const errorMessage = 'A purchase order with this code already exists.'
      console.log('[PUT /purchase-orders] returning 409 (Prisma P2002):', errorMessage)
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Database error', details: String(error) }, { status: 500 })
  }
})

function generateOrderCode() {
  const random = Math.random().toString(36).slice(-5).toUpperCase()
  return `PO-${random}`
}

async function resolveOrderCode(strategyId: string, requested?: string) {
  if (requested) {
    const existing = await prisma.purchaseOrder.findUnique({
      where: { strategyId_orderCode: { strategyId, orderCode: requested } },
    })
    if (existing) {
      return { error: 'A purchase order with this code already exists.', status: 409 as const }
    }
    return { orderCode: requested }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateOrderCode()
    const conflict = await prisma.purchaseOrder.findUnique({
      where: { strategyId_orderCode: { strategyId, orderCode: candidate } },
    })
    if (!conflict) {
      return { orderCode: candidate }
    }
  }

  return { error: 'Unable to generate a unique purchase order code. Try again.', status: 503 as const }
}

export const POST = withXPlanAuth(async (request: Request) => {
  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { strategyId, productId, orderCode, quantity, poDate } = parsed.data

  const productExists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
  if (!productExists) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const orderCodeResult = await resolveOrderCode(strategyId, orderCode)
  if ('error' in orderCodeResult) {
    return NextResponse.json({ error: orderCodeResult.error }, { status: orderCodeResult.status })
  }

  const stageDefaultsRows = await prisma.businessParameter.findMany({
    where: { strategyId, label: { in: STAGE_DEFAULT_LABEL_SET } },
    select: { label: true, valueNumeric: true },
  })
  const stageDefaults = buildStageDefaultsMap(stageDefaultsRows)

  const safeQuantity = quantity ?? 0
  const data = {
    strategyId,
    productId,
    orderCode: orderCodeResult.orderCode,
    quantity: safeQuantity,
    poDate: poDate ? parseDate(poDate) : null,
    productionWeeks: new Prisma.Decimal(
      resolveStageDefaultWeeks(stageDefaults, OPS_STAGE_DEFAULT_LABELS.production)
    ),
    sourceWeeks: new Prisma.Decimal(
      resolveStageDefaultWeeks(stageDefaults, OPS_STAGE_DEFAULT_LABELS.source)
    ),
    oceanWeeks: new Prisma.Decimal(
      resolveStageDefaultWeeks(stageDefaults, OPS_STAGE_DEFAULT_LABELS.ocean)
    ),
    finalWeeks: new Prisma.Decimal(
      resolveStageDefaultWeeks(stageDefaults, OPS_STAGE_DEFAULT_LABELS.final)
    ),
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
    console.error('[POST /purchase-orders] error:', error)
    return NextResponse.json({ error: 'Unable to create purchase order' }, { status: 500 })
  }
})

export const DELETE = withXPlanAuth(async (request: Request) => {
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
})
