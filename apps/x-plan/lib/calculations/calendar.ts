import { addWeeks, differenceInCalendarWeeks, isValid, startOfWeek } from 'date-fns'
import { SalesWeekInput } from './types'

export interface WeekCalendar {
  calendarStart: Date | null
  weekDates: Map<number, Date | null>
}

export interface YearSegment {
  year: number
  startWeekNumber: number
  endWeekNumber: number
  weekCount: number
}

function coerceDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) return isValid(value) ? value : null
  const date = new Date(value)
  return isValid(date) ? date : null
}

export function buildWeekCalendar(salesWeeks: SalesWeekInput[]): WeekCalendar {
  const sorted = [...salesWeeks].sort((a, b) => a.weekNumber - b.weekNumber)
  const weekDates = new Map<number, Date | null>()

  let minWeekNumber: number | null = null
  let maxWeekNumber: number | null = null

  for (const week of sorted) {
    weekDates.set(week.weekNumber, coerceDate(week.weekDate ?? null))
    if (minWeekNumber == null || week.weekNumber < minWeekNumber) {
      minWeekNumber = week.weekNumber
    }
    if (maxWeekNumber == null || week.weekNumber > maxWeekNumber) {
      maxWeekNumber = week.weekNumber
    }
  }

  const calendarStart = Array.from(weekDates.values()).find((date): date is Date => Boolean(date)) ?? null

  if (minWeekNumber != null && maxWeekNumber != null) {
    if (calendarStart) {
      const base = startOfWeek(calendarStart, { weekStartsOn: 0 })
      for (let weekNumber = minWeekNumber; weekNumber <= maxWeekNumber; weekNumber += 1) {
        const existing = weekDates.get(weekNumber)
        if (!existing || !isValid(existing)) {
          weekDates.set(weekNumber, addWeeks(base, weekNumber - 1))
        }
      }
    } else {
      for (let weekNumber = minWeekNumber; weekNumber <= maxWeekNumber; weekNumber += 1) {
        if (!weekDates.has(weekNumber)) {
          weekDates.set(weekNumber, null)
        }
      }
    }
  }

  const ordered = new Map<number, Date | null>(
    Array.from(weekDates.entries()).sort((a, b) => a[0] - b[0])
  )

  return { calendarStart, weekDates: ordered }
}

export function getCalendarDateForWeek(weekNumber: number, calendar: WeekCalendar): Date | null {
  const direct = calendar.weekDates.get(weekNumber)
  if (direct && isValid(direct)) {
    return direct
  }

  if (!calendar.calendarStart) return null

  const base = startOfWeek(calendar.calendarStart, { weekStartsOn: 0 })
  return addWeeks(base, weekNumber - 1)
}

export function weekNumberForDate(date: Date | null, calendar: WeekCalendar): number | null {
  if (!date || !calendar.calendarStart) return null
  const base = startOfWeek(calendar.calendarStart, { weekStartsOn: 0 })
  const target = startOfWeek(date, { weekStartsOn: 0 })
  const offset = differenceInCalendarWeeks(target, base)
  if (offset < 0) return null
  return offset + 1
}

export function buildYearSegments(calendar: WeekCalendar): YearSegment[] {
  const segments = new Map<number, { min: number; max: number }>()

  for (const [weekNumber] of calendar.weekDates) {
    const date = getCalendarDateForWeek(weekNumber, calendar)
    if (!date) continue
    const year = date.getFullYear()
    const entry = segments.get(year)
    if (entry) {
      entry.min = Math.min(entry.min, weekNumber)
      entry.max = Math.max(entry.max, weekNumber)
    } else {
      segments.set(year, { min: weekNumber, max: weekNumber })
    }
  }

  return Array.from(segments.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, { min, max }]) => ({
      year,
      startWeekNumber: min,
      endWeekNumber: max,
      weekCount: max >= min ? max - min + 1 : 0,
    }))
}
