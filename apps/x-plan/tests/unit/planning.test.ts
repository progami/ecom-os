import { describe, expect, it } from 'vitest'
import { buildWeekCalendar, buildYearSegments, getCalendarDateForWeek } from '@/lib/calculations/calendar'
import type { SalesWeekInput } from '@/lib/calculations/types'
import { ensurePlanningCalendarCoverage } from '@/lib/planning'

describe('planning calendar coverage', () => {
  it('generates default weeks when no sales data exists', () => {
    const weeksUk = ensurePlanningCalendarCoverage([], 1)
    expect(weeksUk).toHaveLength(261)

    const calendarUk = buildWeekCalendar(weeksUk, 1)
    const segmentsUk = buildYearSegments(calendarUk)

    expect(segmentsUk.map((segment) => segment.year)).toEqual([2023, 2024, 2025, 2026, 2027])
    expect(segmentsUk.map((segment) => segment.weekCount)).toEqual([52, 53, 52, 52, 52])

    const first2023WeekDateUk = getCalendarDateForWeek(-104, calendarUk)
    const firstWeekDateUk = getCalendarDateForWeek(1, calendarUk)
    const lastWeekDateUk = getCalendarDateForWeek(156, calendarUk)

    expect(first2023WeekDateUk?.toISOString()).toBe('2023-01-02T00:00:00.000Z')
    expect(firstWeekDateUk?.toISOString()).toBe('2025-01-06T00:00:00.000Z')
    expect(lastWeekDateUk?.toISOString()).toBe('2027-12-27T00:00:00.000Z')

    const weeksUs = ensurePlanningCalendarCoverage([], 0)
    expect(weeksUs).toHaveLength(261)

    const calendarUs = buildWeekCalendar(weeksUs, 0)
    const segmentsUs = buildYearSegments(calendarUs)

    expect(segmentsUs.map((segment) => segment.year)).toEqual([2023, 2024, 2025, 2026, 2027])
    expect(segmentsUs.map((segment) => segment.weekCount)).toEqual([53, 52, 52, 52, 52])

    const first2023WeekDateUs = getCalendarDateForWeek(-104, calendarUs)
    const firstWeekDateUs = getCalendarDateForWeek(1, calendarUs)
    const lastWeekDateUs = getCalendarDateForWeek(156, calendarUs)

    expect(first2023WeekDateUs?.toISOString()).toBe('2023-01-01T00:00:00.000Z')
    expect(firstWeekDateUs?.toISOString()).toBe('2025-01-05T00:00:00.000Z')
    expect(lastWeekDateUs?.toISOString()).toBe('2027-12-26T00:00:00.000Z')
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

    const weeks = ensurePlanningCalendarCoverage(partialWeeks, 1)
    const calendar = buildWeekCalendar(weeks, 1)

    const segment2027 = buildYearSegments(calendar).find((segment) => segment.year === 2027)
    expect(segment2027?.endWeekNumber).toBe(156)

    const preservedWeek = weeks.find((week) => week.id === 'existing-week-1')
    expect(preservedWeek?.weekDate?.toISOString()).toBe('2025-02-03T00:00:00.000Z')

    const filledWeek = getCalendarDateForWeek(60, calendar)
    expect(filledWeek?.toISOString()).toBe('2026-02-23T00:00:00.000Z')
  })
})
