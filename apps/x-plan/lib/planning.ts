import { addWeeks } from 'date-fns'
import { mapSalesWeeks } from '@/lib/calculations/adapters'
import { buildWeekCalendar, buildYearSegments, type YearSegment } from '@/lib/calculations/calendar'
import type { SalesWeekInput } from '@/lib/calculations/types'
import prisma from '@/lib/prisma'

const DEFAULT_PLANNING_ANCHOR = new Date('2025-01-06T00:00:00.000Z')
const DEFAULT_PLANNING_ANCHOR_WEEK = 1
const DEFAULT_PLANNING_MIN_WEEK_NUMBER = -104 // covers 2023-01-02
const DEFAULT_PLANNING_MAX_WEEK_NUMBER = 156 // 2025–2027 inclusive
const DEFAULT_PLANNING_PRODUCT_ID = '__planning__'
const EXTRA_PLANNING_YEARS = [2023, 2024] as const

function buildFallbackSalesWeeks(): SalesWeekInput[] {
  const weeks: SalesWeekInput[] = []
  for (
    let weekNumber = DEFAULT_PLANNING_MIN_WEEK_NUMBER;
    weekNumber <= DEFAULT_PLANNING_MAX_WEEK_NUMBER;
    weekNumber += 1
  ) {
    weeks.push({
      id: `planning-week-${weekNumber}`,
      productId: DEFAULT_PLANNING_PRODUCT_ID,
      weekNumber,
      weekDate: addWeeks(DEFAULT_PLANNING_ANCHOR, weekNumber - DEFAULT_PLANNING_ANCHOR_WEEK),
    })
  }
  return weeks
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

export async function loadPlanningCalendar(): Promise<PlanningCalendar> {
  let salesWeekRecords: Awaited<ReturnType<typeof prisma.salesWeek.findMany>> = []
  try {
    salesWeekRecords = await prisma.salesWeek.findMany({ orderBy: { weekNumber: 'asc' } })
  } catch (error) {
    console.warn('[x-plan] using fallback planning calendar (salesWeek delegate unavailable)', error)
  }
  const mappedWeeks = mapSalesWeeks(salesWeekRecords)
  const salesWeeks = ensurePlanningCalendarCoverage(mappedWeeks)
  const calendar = buildWeekCalendar(salesWeeks)
  const yearSegments = ensureYearSegmentCoverage(buildYearSegments(calendar))
  return { salesWeeks, yearSegments, calendar }
}

function ensureYearSegmentCoverage(segments: YearSegment[]): YearSegment[] {
  const coveredYears = new Set(segments.map((segment) => segment.year))
  const missing: YearSegment[] = []

  for (const year of EXTRA_PLANNING_YEARS) {
    if (!coveredYears.has(year)) {
      missing.push({
        year,
        startWeekNumber: 1,
        endWeekNumber: 0,
        weekCount: 0,
      })
    }
  }

  if (missing.length === 0) return segments
  return [...segments, ...missing].sort((a, b) => a.year - b.year)
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
  const sorted = [...segments].sort((a, b) => a.year - b.year)
  const requestedYear = coerceYearValue(requested)
  if (requestedYear != null && sorted.some((segment) => segment.year === requestedYear)) {
    return requestedYear
  }

  const withWeeks = sorted.filter((segment) => segment.weekCount > 0)
  const candidateSegments = withWeeks.length > 0 ? withWeeks : sorted
  const currentYear = new Date().getFullYear()

  const current = candidateSegments.find((segment) => segment.year === currentYear)
  if (current) return current.year

  const next = candidateSegments.find((segment) => segment.year >= currentYear)
  if (next) return next.year

  return candidateSegments.at(-1)?.year ?? null
}

export function findYearSegment(year: number | null, segments: YearSegment[]): YearSegment | null {
  if (year == null) return null
  return segments.find((segment) => segment.year === year) ?? null
}
