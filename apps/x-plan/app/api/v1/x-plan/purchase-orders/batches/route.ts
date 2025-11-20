import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const prismaAny = prisma as unknown as {
  batchTableRow?: typeof prisma.batchTableRow
}

function ensureBatchDelegate() {
  if (!prismaAny.batchTableRow) {
    return null
  }
  return prismaAny.batchTableRow
}

const allowedFields = [
  'batchCode',
  'productId',
  'quantity',
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
  overrideTacosPercent: true,
  overrideReferralRate: true,
}

const decimalFields: Record<string, true> = {
  overrideSellingPrice: true,
  overrideManufacturingCost: true,
  overrideFreightCost: true,
  overrideTariffRate: true,
  overrideFbaFee: true,
  overrideStoragePerMonth: true,
}

function parseNumber(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(/[$,%\s]/g, '').replace(/,/g, '')
  const parsed = Number(cleaned)
  return Number.isNaN(parsed) ? null : parsed
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
  purchaseOrderId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(0).default(0),
  batchCode: z.string().trim().optional(),
})

const deleteSchema = z.object({
  id: z.string().min(1),
})

async function recalcOrderQuantity(purchaseOrderId: string) {
  const delegate = ensureBatchDelegate()
  if (!delegate) return

  try {
    const aggregate = (await delegate.aggregate({
      where: { purchaseOrderId },
      _sum: { quantity: true },
    })) as { _sum?: { quantity?: number | null } }
    const quantity = aggregate?._sum?.quantity ?? 0
    await prisma.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { quantity } })
  } catch (error: any) {
    if (error?.code === 'P2021') {
      console.warn('BatchTableRow table missing; skip quantity recalculation')
      return
    }
    throw error
  }
}

export async function POST(request: Request) {
  const delegate = ensureBatchDelegate()
  if (!delegate) {
    return NextResponse.json(
      {
        error:
          'Purchase order batches are not available yet. Regenerate the Prisma client (pnpm --filter @ecom-os/x-plan prisma:generate) and ensure the database migration has been applied.',
      },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { purchaseOrderId, productId, quantity, batchCode } = parsed.data

  const [purchaseOrder, product] = await Promise.all([
    prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, select: { id: true } }),
    prisma.product.findUnique({ where: { id: productId }, select: { id: true } }),
  ])

  if (!purchaseOrder) {
    return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
  }
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  let created
  try {
    created = await delegate.create({
      data: {
        purchaseOrderId,
        productId,
        quantity,
        batchCode: batchCode && batchCode.length > 0 ? batchCode : null,
      },
    })
  } catch (error: any) {
    if (error?.code === 'P2021') {
      return NextResponse.json(
        {
          error:
            'Purchase order batches are not yet available. Run `prisma migrate dev --schema apps/x-plan/prisma/schema.prisma` (or `prisma db push`) and restart the dev server to create the new table.',
        },
        { status: 503 }
      )
    }
    console.error('Failed to create purchase order batch', error)
    return NextResponse.json({ error: 'Failed to create purchase order batch' }, { status: 500 })
  }

  await recalcOrderQuantity(purchaseOrderId)

  return NextResponse.json({
    batch: {
      id: created.id,
      purchaseOrderId: created.purchaseOrderId,
      productId: created.productId,
      quantity: created.quantity,
      batchCode: created.batchCode,
    },
  })
}

export async function PUT(request: Request) {
  const delegate = ensureBatchDelegate()
  if (!delegate) {
    return NextResponse.json(
      {
        error:
          'Purchase order batches are not available yet. Regenerate the Prisma client (pnpm --filter @ecom-os/x-plan prisma:generate) and ensure the database migration has been applied.',
      },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const ordersToRecalc = new Set<string>()

  for (const { id, values } of parsed.data.updates) {
    const existing = await delegate.findUnique({ where: { id }, select: { purchaseOrderId: true } })
    if (!existing) {
      throw new Error('Batch not found')
    }
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (!(field in values)) continue
      const incoming = values[field]
      if (incoming == null || incoming === '') {
        data[field] = null
        continue
      }
      if (field === 'quantity') {
        const parsedQuantity = parseNumber(incoming)
        data[field] = parsedQuantity != null ? Math.max(0, Math.round(parsedQuantity)) : null
      } else if (percentFields[field]) {
        const parsedNumber = parseNumber(incoming)
        data[field] = parsedNumber == null ? null : parsedNumber > 1 ? parsedNumber / 100 : parsedNumber
      } else if (decimalFields[field]) {
        data[field] = parseNumber(incoming)
      } else if (field === 'productId' || field === 'batchCode') {
        data[field] = incoming
      }
    }

    try {
      await delegate.update({ where: { id }, data })
    } catch (error: any) {
      if (error?.code === 'P2021') {
        throw new Error(
          'Purchase order batches are not yet available. Run `prisma migrate dev --schema apps/x-plan/prisma/schema.prisma` (or `prisma db push`) and restart the dev server to create the new table.'
        )
      }
      throw error
    }
    ordersToRecalc.add(existing.purchaseOrderId)
  }

  await Promise.all(Array.from(ordersToRecalc).map((orderId) => recalcOrderQuantity(orderId)))

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const delegate = ensureBatchDelegate()
  if (!delegate) {
    return NextResponse.json(
      {
        error:
          'Purchase order batches are not available yet. Regenerate the Prisma client (pnpm --filter @ecom-os/x-plan prisma:generate) and ensure the database migration has been applied.',
      },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { id } = parsed.data

  const existing = await delegate.findUnique({ where: { id }, select: { purchaseOrderId: true } })
  if (!existing) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  try {
    await delegate.delete({ where: { id } })
  } catch (error: any) {
    if (error?.code === 'P2021') {
      return NextResponse.json(
        {
          error:
            'Purchase order batches are not yet available. Run `prisma migrate dev --schema apps/x-plan/prisma/schema.prisma` (or `prisma db push`) and restart the dev server to create the new table.'
        },
        { status: 503 }
      )
    }
    console.error('Failed to delete purchase order batch', error)
    return NextResponse.json({ error: 'Failed to delete purchase order batch' }, { status: 500 })
  }
  await recalcOrderQuantity(existing.purchaseOrderId)

  return NextResponse.json({ ok: true })
}
