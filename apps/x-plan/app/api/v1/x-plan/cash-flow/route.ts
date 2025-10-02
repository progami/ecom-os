import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { loadPlanningCalendar } from '@/lib/planning'

const editableFields = ['amazonPayout', 'inventorySpend', 'fixedCosts'] as const

const updateSchema = z.object({
  updates: z.array(
    z.object({
      weekNumber: z.number().int().min(1),
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

  const planning = await loadPlanningCalendar()
  const minWeek = planning.calendar.minWeekNumber ?? 1
  const maxWeek = planning.calendar.maxWeekNumber ?? minWeek

  const outOfRange = parsed.data.updates.find(
    ({ weekNumber }) => weekNumber < minWeek || weekNumber > maxWeek,
  )

  if (outOfRange) {
    return NextResponse.json(
      { error: `Week ${outOfRange.weekNumber} is outside the planning calendar` },
      { status: 400 },
    )
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

