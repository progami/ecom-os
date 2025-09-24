import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const editableFields = ['amazonPayout', 'inventorySpend', 'fixedCosts'] as const

const updateSchema = z.object({
  updates: z.array(
    z.object({
      weekNumber: z.number().int().min(1).max(52),
      values: z.record(z.string(), z.string().nullable().optional()),
    })
  ),
})

function parseNumber(value: string | null | undefined) {
  if (!value) return null
  const cleaned = value.replace(/[$,%]/g, '')
  const parsed = Number(cleaned)
  if (Number.isNaN(parsed)) return null
  return parsed
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await prisma.$transaction(
    parsed.data.updates.map(({ weekNumber, values }) => {
      const data: Record<string, number | null> = {}
      for (const field of editableFields) {
        if (!(field in values)) continue
        data[field] = parseNumber(values[field])
      }
      if (Object.keys(data).length === 0) {
        return prisma.cashFlowWeek.findFirst({ where: { weekNumber } })
      }
      return prisma.cashFlowWeek.update({ where: { weekNumber }, data })
    })
  )

  return NextResponse.json({ ok: true })
}

