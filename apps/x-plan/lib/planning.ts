import { mapSalesWeeks } from '@/lib/calculations/adapters'
import { buildWeekCalendar, buildYearSegments, type YearSegment } from '@/lib/calculations/calendar'
import type { SalesWeekInput } from '@/lib/calculations/types'
import prisma from '@/lib/prisma'

export interface PlanningCalendar {
  salesWeeks: SalesWeekInput[]
  yearSegments: YearSegment[]
  calendar: ReturnType<typeof buildWeekCalendar>
}

export async function loadPlanningCalendar(): Promise<PlanningCalendar> {
  const salesWeekRecords = await prisma.salesWeek.findMany({ orderBy: { weekNumber: 'asc' } })
  const salesWeeks = mapSalesWeeks(salesWeekRecords)
  const calendar = buildWeekCalendar(salesWeeks)
  const yearSegments = buildYearSegments(calendar)
  return { salesWeeks, yearSegments, calendar }
}

function coerceYearValue(value: string | string[] | undefined): number | null {
  if (!value) return null
  const values = Array.isArray(value) ? value : [value]
  for (const candidate of values) {
    const parsed = Number.parseInt(candidate, 10)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}

export function resolveActiveYear(
  requested: string | string[] | undefined,
  segments: YearSegment[],
): number | null {
  if (!segments.length) return null
  const requestedYear = coerceYearValue(requested)
  if (requestedYear != null && segments.some((segment) => segment.year === requestedYear)) {
    return requestedYear
  }
  return segments[0]?.year ?? null
}

export function findYearSegment(year: number | null, segments: YearSegment[]): YearSegment | null {
  if (year == null) return null
  return segments.find((segment) => segment.year === year) ?? null
}
