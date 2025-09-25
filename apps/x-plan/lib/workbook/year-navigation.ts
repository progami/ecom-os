import { buildWeekCalendar, buildYearSegments, type WeekCalendar, type YearSegment } from '@/lib/calculations/calendar'
import { mapSalesWeeks } from '@/lib/calculations/adapters'
import type { SalesWeekInput } from '@/lib/calculations'
import prisma from '@/lib/prisma'

export interface SalesCalendarContext {
  salesWeekInputs: SalesWeekInput[]
  calendar: WeekCalendar
  yearSegments: YearSegment[]
}

export async function loadSalesCalendar(): Promise<SalesCalendarContext> {
  const salesWeeks = await prisma.salesWeek.findMany({ orderBy: { weekNumber: 'asc' } })
  const salesWeekInputs = mapSalesWeeks(salesWeeks)
  const calendar = buildWeekCalendar(salesWeekInputs)
  const yearSegments = buildYearSegments(calendar)

  return { salesWeekInputs, calendar, yearSegments }
}
