import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const allowedFields = ['actualSales', 'forecastSales', 'finalSales'] as const

const updateSchema = z.object({
  updates: z.array(
    z.object({
      productId: z.string().min(1),
      weekNumber: z.number().int().min(1).max(52),
      values: z.record(z.string(), z.string().nullable().optional()),
    })
  ),
})

function parseIntValue(value: string | null | undefined) {
  if (!value) return null
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return null
  return Math.round(parsed)
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await prisma.$transaction(
    parsed.data.updates.map(({ productId, weekNumber, values }) => {
      const data: Record<string, number | null> = {}
      for (const field of allowedFields) {
        if (!(field in values)) continue
        data[field] = parseIntValue(values[field])
      }

      if (Object.keys(data).length === 0) {
        return prisma.salesWeek.findFirst({ where: { productId, weekNumber } })
      }

      return prisma.salesWeek.update({
        where: { productId_weekNumber: { productId, weekNumber } },
        data,
      })
    })
  )

  return NextResponse.json({ ok: true })
}

