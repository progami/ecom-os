import { addWeeks } from 'date-fns'
import { mapSalesWeeks } from '@/lib/calculations/adapters'
import { buildWeekCalendar, buildYearSegments, type YearSegment } from '@/lib/calculations/calendar'
import type { SalesWeekInput } from '@/lib/calculations/types'

type SalesWeekRecords = Awaited<ReturnType<import('@prisma/client').PrismaClient['salesWeek']['findMany']>>

const DEFAULT_PLANNING_ANCHOR = new Date('2025-01-06T00:00:00.000Z')
const DEFAULT_PLANNING_WEEK_COUNT = 156 // 2025–2027 inclusive
const DEFAULT_PLANNING_PRODUCT_ID = '__planning__'

function buildFallbackSalesWeeks(): SalesWeekInput[] {
  return Array.from({ length: DEFAULT_PLANNING_WEEK_COUNT }, (_, index) => {
    const weekNumber = index + 1
    return {
      id: `planning-week-${weekNumber}`,
      productId: DEFAULT_PLANNING_PRODUCT_ID,
      weekNumber,
      weekDate: addWeeks(DEFAULT_PLANNING_ANCHOR, index),
    }
  })
}

const FALLBACK_WEEKS = buildFallbackSalesWeeks()

export function ensurePlanningCalendarCoverage(salesWeeks: SalesWeekInput[]): SalesWeekInput[] {
  if (!salesWeeks.length) {
    return [...FALLBACK_WEEKS]
  }

  const fallbackByWeek = new Map<number, SalesWeekInput>(
    FALLBACK_WEEKS.map((week) => [week.weekNumber, week]),
  )

  const seenWeeks = new Set<number>()
  const enriched = salesWeeks.map((week) => {
    seenWeeks.add(week.weekNumber)
    if ((week.weekDate == null || Number.isNaN(new Date(week.weekDate).getTime())) && fallbackByWeek.has(week.weekNumber)) {
      const fallback = fallbackByWeek.get(week.weekNumber)
      if (fallback?.weekDate) {
        return { ...week, weekDate: fallback.weekDate }
      }
    }
    return week
  })

  const missingWeeks: SalesWeekInput[] = []
  fallbackByWeek.forEach((fallback, weekNumber) => {
    if (!seenWeeks.has(weekNumber)) {
      missingWeeks.push(fallback)
    }
  })

  return [...enriched, ...missingWeeks]
}

export interface PlanningCalendar {
  salesWeeks: SalesWeekInput[]
  yearSegments: YearSegment[]
  calendar: ReturnType<typeof buildWeekCalendar>
}

async function fetchSalesWeeks(): Promise<SalesWeekRecords> {
  const prismaClient = await import('@/lib/prisma')
    .then((module) => module.default)
    .catch((error) => {
      console.warn('[x-plan] using fallback planning calendar (salesWeek delegate unavailable)', error)
      return null
    })

  if (!prismaClient) {
    return []
  }

  try {
    return await prismaClient.salesWeek.findMany({ orderBy: { weekNumber: 'asc' } })
  } catch (error) {
    console.warn('[x-plan] using fallback planning calendar (salesWeek delegate unavailable)', error)
    return []
  }
}

export async function loadPlanningCalendar(): Promise<PlanningCalendar> {
  const salesWeekRecords = await fetchSalesWeeks()
  const mappedWeeks = mapSalesWeeks(salesWeekRecords)
  const salesWeeks = ensurePlanningCalendarCoverage(mappedWeeks)
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
