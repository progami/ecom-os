import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const numericFields = [
  'sellingPrice',
  'manufacturingCost',
  'freightCost',
  'tariffRate',
  'tacosPercent',
  'fbaFee',
  'amazonReferralRate',
  'storagePerMonth',
] as const

const textFields = ['name', 'sku'] as const

const percentFields: NumericField[] = ['tariffRate', 'tacosPercent', 'amazonReferralRate']

const updateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        values: z.record(z.string(), z.string().nullable().optional()),
      })
    )
    .min(1),
})

const createSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
})

const deleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
})

type NumericField = (typeof numericFields)[number]

type TransactionClient = { [key: string]: any }

function parseNumeric(value: string | null | undefined) {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/[%$]/g, '')
  const parsed = Number(normalized)
  if (Number.isNaN(parsed)) return null
  return parsed
}

async function seedSalesWeeksForProduct(productId: string, client: TransactionClient) {
  const templateProduct = await client.product.findFirst({
    where: { id: { not: productId } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  type TemplateWeek = { weekNumber: number; weekDate: Date }

  let templateWeeks: TemplateWeek[] = templateProduct
    ? await client.salesWeek.findMany({
        where: { productId: templateProduct.id },
        select: { weekNumber: true, weekDate: true },
        orderBy: { weekNumber: 'asc' },
      })
    : []

  if (templateWeeks.length === 0) {
    const today = new Date()
    const startOfYear = new Date(today.getFullYear(), 0, 1)
    const firstMonday = new Date(startOfYear)
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1)
    }
    templateWeeks = Array.from({ length: 52 }, (_, index): TemplateWeek => {
      const timestamp = firstMonday.getTime() + index * 7 * 24 * 60 * 60 * 1000
      return {
        weekNumber: index + 1,
        weekDate: new Date(timestamp),
      }
    })
  }

  if (templateWeeks.length === 0) return

  await client.salesWeek.createMany({
    data: templateWeeks.map((week) => ({
      productId,
      weekNumber: week.weekNumber,
      weekDate: week.weekDate,
    })),
    skipDuplicates: true,
  })
}

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ products })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx: TransactionClient) => {
    const product = await tx.product.create({
      data: {
        name: parsed.data.name.trim(),
        sku: parsed.data.sku.trim(),
        sellingPrice: new Prisma.Decimal(0),
        manufacturingCost: new Prisma.Decimal(0),
        freightCost: new Prisma.Decimal(0),
        tariffRate: new Prisma.Decimal(0),
        tacosPercent: new Prisma.Decimal(0),
        fbaFee: new Prisma.Decimal(0),
        amazonReferralRate: new Prisma.Decimal(0),
        storagePerMonth: new Prisma.Decimal(0),
      },
    })

    await seedSalesWeeksForProduct(product.id, tx)

    return product
  })

  return NextResponse.json({ product: result })
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const updates = parsed.data.updates
    .map(({ id, values }) => {
      const data: Record<string, string | number | null> = {}

      for (const field of numericFields) {
        if (field in values) {
          const parsedValue = parseNumeric(values[field])
          if (parsedValue === null) {
            data[field] = null
          } else if (percentFields.includes(field) && parsedValue > 1) {
            data[field] = parsedValue / 100
          } else {
            data[field] = parsedValue
          }
        }
      }

      for (const field of textFields) {
        if (field in values) {
          const rawValue = values[field]
          if (rawValue == null) continue
          const trimmed = rawValue.trim()
          if (trimmed) {
            data[field] = trimmed
          }
        }
      }

      return { id, data }
    })
    .filter((update) => Object.keys(update.data).length > 0)

  if (updates.length === 0) {
    return NextResponse.json({ ok: true })
  }

  await prisma.$transaction(
    updates.map(({ id, data }) =>
      prisma.product.update({
        where: { id },
        data,
      })
    )
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const ids = parsed.data.ids

  await prisma.$transaction(async (tx: TransactionClient) => {
    await tx.purchaseOrder.deleteMany({ where: { productId: { in: ids } } })
    await tx.leadTimeOverride.deleteMany({ where: { productId: { in: ids } } })
    await tx.product.deleteMany({ where: { id: { in: ids } } })
  })

  return NextResponse.json({ ok: true })
}
