import { differenceInCalendarWeeks, isValid, startOfWeek } from 'date-fns'
import { SalesWeekInput } from './types'

export interface WeekCalendar {
  calendarStart: Date | null
  weekDates: Map<number, Date | null>
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

  for (const week of sorted) {
    weekDates.set(week.weekNumber, coerceDate(week.weekDate ?? null))
  }

  const calendarStart = Array.from(weekDates.values()).find((date): date is Date => Boolean(date)) ?? null

  return { calendarStart, weekDates }
}

export function weekNumberForDate(date: Date | null, calendar: WeekCalendar): number | null {
  if (!date || !calendar.calendarStart) return null
  const base = startOfWeek(calendar.calendarStart, { weekStartsOn: 0 })
  const target = startOfWeek(date, { weekStartsOn: 0 })
  const offset = differenceInCalendarWeeks(target, base)
  if (offset < 0) return null
  return offset + 1
}
