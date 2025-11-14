import { addWeeks } from 'date-fns'
import type { PrismaClient, SalesWeek } from '@prisma/client'
import { mapSalesWeeks } from '@/lib/calculations/adapters'
import { buildWeekCalendar, buildYearSegments, type YearSegment } from '@/lib/calculations/calendar'
import type { SalesWeekInput } from '@/lib/calculations/types'

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

let cachedPrisma: PrismaClient | null = null
let prismaLoadFailed = false

async function resolvePrismaClient(): Promise<PrismaClient | null> {
  if (cachedPrisma) return cachedPrisma
  if (prismaLoadFailed) return null

  try {
    const prismaModule = await import('@/lib/prisma')
    cachedPrisma = prismaModule.default as PrismaClient
    return cachedPrisma
  } catch (error) {
    prismaLoadFailed = true
    console.warn('[x-plan] Prisma client unavailable for planning calendar, using fallbacks', error)
    return null
  }
}

export async function loadPlanningCalendar(): Promise<PlanningCalendar> {
  let salesWeekRecords: SalesWeek[] = []
  const prisma = await resolvePrismaClient()

  if (prisma) {
    try {
      salesWeekRecords = await prisma.salesWeek.findMany({ orderBy: { weekNumber: 'asc' } })
    } catch (error) {
      console.warn('[x-plan] salesWeek delegate unavailable, using fallback planning calendar', error)
    }
  }
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
