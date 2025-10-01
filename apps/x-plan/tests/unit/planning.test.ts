import { describe, expect, it } from 'vitest'
import { buildWeekCalendar, buildYearSegments, getCalendarDateForWeek } from '@/lib/calculations/calendar'
import type { SalesWeekInput } from '@/lib/calculations/types'
import { ensurePlanningCalendarCoverage } from '@/lib/planning'

describe('planning calendar coverage', () => {
  it('generates default weeks when no sales data exists', () => {
    const weeks = ensurePlanningCalendarCoverage([])
    expect(weeks).toHaveLength(156)

    const calendar = buildWeekCalendar(weeks)
    const segments = buildYearSegments(calendar)

    expect(segments.map((segment) => segment.year)).toEqual([2025, 2026, 2027])
    expect(segments[0]?.weekCount).toBe(52)
    expect(segments[1]?.weekCount).toBe(52)
    expect(segments[2]?.weekCount).toBe(52)

    const firstWeekDate = getCalendarDateForWeek(1, calendar)
    const lastWeekDate = getCalendarDateForWeek(156, calendar)

    expect(firstWeekDate?.toISOString()).toBe('2025-01-06T00:00:00.000Z')
    expect(lastWeekDate?.toISOString()).toBe('2027-12-27T00:00:00.000Z')
  })

  it('fills missing weeks and dates without overwriting populated rows', () => {
    const partialWeeks: SalesWeekInput[] = [
      {
        id: 'existing-week-1',
        productId: 'prod-1',
        weekNumber: 1,
        weekDate: new Date('2025-02-03T00:00:00.000Z'),
      },
      {
        id: 'existing-week-60',
        productId: 'prod-2',
        weekNumber: 60,
      },
    ]

    const weeks = ensurePlanningCalendarCoverage(partialWeeks)
    const calendar = buildWeekCalendar(weeks)

    const segment2027 = buildYearSegments(calendar).find((segment) => segment.year === 2027)
    expect(segment2027?.endWeekNumber).toBe(156)

    const preservedWeek = weeks.find((week) => week.id === 'existing-week-1')
    expect(preservedWeek?.weekDate?.toISOString()).toBe('2025-02-03T00:00:00.000Z')

    const filledWeek = getCalendarDateForWeek(60, calendar)
    expect(filledWeek?.toISOString()).toBe('2026-02-23T00:00:00.000Z')
  })
})
