import { isValid } from 'date-fns'
import { buildWeekCalendar, weekNumberForDate } from './calendar'
import type { PurchaseOrderDerived } from './ops'
import type { SalesWeekInput } from './types'

export interface SalesWeekDerived {
  productId: string
  weekNumber: number
  weekDate: Date | null
  stockStart: number
  arrivals: number
  actualSales: number | null
  forecastSales: number | null
  finalSales: number
  stockEnd: number
  stockWeeks: number
}

function toNumber(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0
  return Number(value)
}

function buildArrivalSchedule(
  purchaseOrders: PurchaseOrderDerived[],
  calendar: ReturnType<typeof buildWeekCalendar>
): Map<string, number> {
  const schedule = new Map<string, number>()

  for (const order of purchaseOrders) {
    const arrivalDate = order.availableDate ?? order.inboundEta
    if (!arrivalDate) continue
    const weekNumber = weekNumberForDate(arrivalDate, calendar)
    if (weekNumber == null) continue
    const key = `${order.productId}:${weekNumber}`
    const current = schedule.get(key) ?? 0
    schedule.set(key, current + order.quantity)
  }

  return schedule
}

function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value
}

export function computeSalesPlan(
  salesWeeks: SalesWeekInput[],
  purchaseOrders: PurchaseOrderDerived[]
): SalesWeekDerived[] {
  const sortedWeeks = [...salesWeeks].sort((a, b) => a.weekNumber - b.weekNumber)
  const calendar = buildWeekCalendar(sortedWeeks)
  const arrivalSchedule = buildArrivalSchedule(purchaseOrders, calendar)

  const results: SalesWeekDerived[] = []
  const productIds = Array.from(new Set(sortedWeeks.map((week) => week.productId)))

  for (const productId of productIds) {
    const weekRows = sortedWeeks.filter((item) => item.productId === productId)
    const stockEndSeries: number[] = []

    for (let index = 0; index < weekRows.length; index += 1) {
      const week = weekRows[index]
      const baseDate = calendar.weekDates.get(week.weekNumber)
      let weekDate: Date | null = null
      if (baseDate && isValid(baseDate)) {
        weekDate = baseDate
      } else if (week.weekDate) {
        const tentative = week.weekDate instanceof Date ? week.weekDate : new Date(week.weekDate)
        weekDate = isValid(tentative) ? tentative : null
      }
      const arrivals = arrivalSchedule.get(`${productId}:${week.weekNumber}`) ?? 0
      const previousEnd = index > 0 ? stockEndSeries[index - 1] : toNumber(week.stockStart)
      const manualStart = week.stockStart
      const baseStart = manualStart != null ? toNumber(manualStart) : previousEnd
      const stockStart = baseStart + arrivals

      const actualSales = week.actualSales != null ? toNumber(week.actualSales) : null
      const forecastSales = week.forecastSales != null ? toNumber(week.forecastSales) : null

      let computedFinalSales: number
      if (week.finalSales != null) {
        computedFinalSales = clampNonNegative(Math.min(stockStart, toNumber(week.finalSales)))
      } else {
        const demand = actualSales != null ? actualSales : forecastSales ?? 0
        computedFinalSales = clampNonNegative(Math.min(stockStart, demand))
      }

      const stockEnd = clampNonNegative(stockStart - computedFinalSales)
      stockEndSeries.push(stockEnd)

      results.push({
        productId,
        weekNumber: week.weekNumber,
        weekDate,
        stockStart,
        arrivals,
        actualSales,
        forecastSales,
        finalSales: computedFinalSales,
        stockEnd,
        stockWeeks: 0, // updated after loop
      })
    }

    // Compute weeks of coverage
    const productRows = results.filter((row) => row.productId === productId).sort((a, b) => a.weekNumber - b.weekNumber)
    for (let i = 0; i < productRows.length; i += 1) {
      let depletionIndex: number | null = null
      for (let j = i; j < productRows.length; j += 1) {
        if (productRows[j].stockEnd <= 0) {
          depletionIndex = j
          break
        }
      }
      if (depletionIndex == null) {
        productRows[i].stockWeeks = Number.POSITIVE_INFINITY
      } else {
        productRows[i].stockWeeks = depletionIndex - i + 1
      }
    }
  }

  return results.sort((a, b) => {
    if (a.weekNumber === b.weekNumber) {
      return a.productId.localeCompare(b.productId)
    }
    return a.weekNumber - b.weekNumber
  })
}
