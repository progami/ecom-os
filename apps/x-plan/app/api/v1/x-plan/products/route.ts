import { NextResponse } from 'next/server'
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

type NumericField = (typeof numericFields)[number]

const percentFields: NumericField[] = ['tariffRate', 'tacosPercent', 'amazonReferralRate']

function parseNumeric(value: string | null | undefined) {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/[%$]/g, '')
  const parsed = Number(normalized)
  if (Number.isNaN(parsed)) return null
  return parsed
}

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ products })
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const updates = parsed.data.updates.map(({ id, values }) => {
    const data: Record<string, number | null> = {}
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
    return { id, data }
  })

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
