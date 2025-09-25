import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const numericFields = ['sellingPrice', 'tacosPercent', 'fbaFee', 'referralRate', 'storagePerMonth'] as const
const percentFields: NumericField[] = ['tacosPercent', 'referralRate']
const dateFields = ['startDate', 'endDate'] as const

const createSchema = z.object({
  productId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  sellingPrice: z.number().optional(),
  tacosPercent: z.number().optional(),
  fbaFee: z.number().optional(),
  referralRate: z.number().optional(),
  storagePerMonth: z.number().optional(),
})

const updateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        values: z.record(z.string(), z.string().optional().nullable()),
      })
    )
    .min(1),
})

const deleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
})

type NumericField = (typeof numericFields)[number]

type ParsedUpdate = { id: string; data: Record<string, string | number | Date | Prisma.Decimal | null> }

type UpdateValueMap = Record<string, string | null | undefined>

function parseNumeric(value: string | null | undefined) {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/[$,%]/g, '')
  const numeric = Number(normalized)
  if (Number.isNaN(numeric)) return null
  return numeric
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeNumericUpdate(field: NumericField, value: string | null | undefined) {
  const parsed = parseNumeric(value)
  if (parsed === null) return null
  if (percentFields.includes(field) && parsed > 1) {
    return parsed / 100
  }
  return parsed
}

function mapUpdates(updates: Array<{ id: string; values: UpdateValueMap }>): ParsedUpdate[] {
  return updates
    .map(({ id, values }) => {
      const data: ParsedUpdate['data'] = {}

      for (const field of numericFields) {
        if (field in values) {
          const parsed = normalizeNumericUpdate(field, values[field])
          if (parsed === null) {
            data[field] = null
          } else {
            data[field] = new Prisma.Decimal(parsed)
          }
        }
      }

      for (const field of dateFields) {
        if (field in values) {
          const parsed = parseDate(values[field])
          data[field] = parsed
        }
      }

      if ('productId' in values) {
        const productId = values.productId?.trim()
        if (productId) {
          data.productId = productId
        }
      }

      return { id, data }
    })
    .filter((update) => Object.keys(update.data).length > 0)
}

function formatTermResponse(term: any) {
  return {
    id: term.id,
    productId: term.productId,
    startDate: term.startDate instanceof Date ? term.startDate.toISOString() : term.startDate,
    endDate: term.endDate instanceof Date ? term.endDate.toISOString() : term.endDate,
    sellingPrice: term.sellingPrice != null ? Number(term.sellingPrice) : null,
    tacosPercent: term.tacosPercent != null ? Number(term.tacosPercent) : null,
    fbaFee: term.fbaFee != null ? Number(term.fbaFee) : null,
    referralRate: term.referralRate != null ? Number(term.referralRate) : null,
    storagePerMonth: term.storagePerMonth != null ? Number(term.storagePerMonth) : null,
  }
}

export async function GET() {
  const terms = await prisma.productSalesTerm.findMany({ orderBy: { startDate: 'asc' } })
  return NextResponse.json({ terms: terms.map(formatTermResponse) })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const startDate = parseDate(parsed.data.startDate)
  if (!startDate) {
    return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
  }

  const endDate = parseDate(parsed.data.endDate ?? null)

  const term = await prisma.productSalesTerm.create({
    data: {
      productId: parsed.data.productId,
      startDate,
      endDate,
      sellingPrice: new Prisma.Decimal(parsed.data.sellingPrice ?? 0),
      tacosPercent: new Prisma.Decimal(parsed.data.tacosPercent ?? 0),
      fbaFee: new Prisma.Decimal(parsed.data.fbaFee ?? 0),
      referralRate: new Prisma.Decimal(parsed.data.referralRate ?? 0),
      storagePerMonth: new Prisma.Decimal(parsed.data.storagePerMonth ?? 0),
    },
  })

  return NextResponse.json({ term: formatTermResponse(term) }, { status: 201 })
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const updates = mapUpdates(parsed.data.updates)
  if (updates.length === 0) {
    return NextResponse.json({ ok: true })
  }

  await prisma.$transaction(
    updates.map(({ id, data }) =>
      prisma.productSalesTerm.update({
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

  await prisma.productSalesTerm.deleteMany({ where: { id: { in: parsed.data.ids } } })

  return NextResponse.json({ ok: true })
}
