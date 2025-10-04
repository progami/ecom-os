import { isValid } from 'date-fns'
import { coerceNumber } from '@/lib/utils/numbers'
import { buildWeekCalendar, weekNumberForDate } from './calendar'
import type { PurchaseOrderDerived } from './ops'
import type { SalesWeekInput } from './types'

interface ComputeSalesPlanOptions {
  productIds?: string[]
  calendar?: ReturnType<typeof buildWeekCalendar>
}

const PLANNING_PLACEHOLDER_PRODUCT_ID = '__planning__'

export interface BatchAllocation {
  orderCode: string
  batchCode?: string | null
  quantity: number
  sellingPrice: number
  landedUnitCost: number
  manufacturingCost: number
  freightCost: number
  tariffRate: number
  tacosPercent: number
  fbaFee: number
  amazonReferralRate: number
  storagePerMonth: number
}

export interface SalesWeekDerived {
  productId: string
  weekNumber: number
  weekDate: Date | null
  stockStart: number
  arrivals: number
  arrivalOrders: Array<{ orderCode: string; shipName?: string | null; productId: string; quantity: number }>
  actualSales: number | null
  forecastSales: number | null
  finalSales: number
  finalPercentError: number | null
  stockEnd: number
  stockWeeks: number
  batchAllocations?: BatchAllocation[]
}

interface BatchInventory {
  orderCode: string
  batchCode?: string | null
  quantity: number
  arrivalWeek: number
  sellingPrice: number
  landedUnitCost: number
  manufacturingCost: number
  freightCost: number
  tariffRate: number
  tacosPercent: number
  fbaFee: number
  amazonReferralRate: number
  storagePerMonth: number
}

type ArrivalScheduleEntry = {
  quantity: number
  orders: Array<{ orderCode: string; shipName?: string | null; productId: string; quantity: number }>
  batches: BatchInventory[]
}

function buildArrivalSchedule(
  purchaseOrders: PurchaseOrderDerived[],
  calendar: ReturnType<typeof buildWeekCalendar>
): Map<string, ArrivalScheduleEntry> {
  const schedule = new Map<string, ArrivalScheduleEntry>()

  for (const order of purchaseOrders) {
    const arrivalDate = order.availableDate ?? order.inboundEta
    if (!arrivalDate) continue
    const weekNumber = weekNumberForDate(arrivalDate, calendar)
    if (weekNumber == null) continue
    const key = `${order.productId}:${weekNumber}`
    const entry = schedule.get(key) ?? { quantity: 0, orders: [], batches: [] }
    entry.quantity += order.quantity
    entry.orders.push({
      orderCode: order.orderCode,
      shipName: order.shipName ?? null,
      productId: order.productId,
      quantity: order.quantity,
    })

    // Add batch with costs
    entry.batches.push({
      orderCode: order.orderCode,
      batchCode: order.orderCode, // Use orderCode as batchCode for now
      quantity: order.quantity,
      arrivalWeek: weekNumber,
      sellingPrice: order.sellingPrice,
      landedUnitCost: order.landedUnitCost,
      manufacturingCost: order.manufacturingCost,
      freightCost: order.freightCost,
      tariffRate: order.tariffRate,
      tacosPercent: order.tacosPercent,
      fbaFee: order.fbaFee,
      amazonReferralRate: order.amazonReferralRate,
      storagePerMonth: order.storagePerMonth,
    })

    schedule.set(key, entry)
  }

  return schedule
}

function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value
}

/**
 * Allocate sales using FIFO from available batch inventory
 * Returns the batch allocations for the sales quantity
 */
function allocateSalesFIFO(
  salesQuantity: number,
  batchInventory: BatchInventory[]
): {  allocations: BatchAllocation[]; remainingBatches: BatchInventory[] } {
  if (salesQuantity <= 0 || batchInventory.length === 0) {
    return { allocations: [], remainingBatches: [...batchInventory] }
  }

  const allocations: BatchAllocation[] = []
  const remaining: BatchInventory[] = []
  let unallocated = salesQuantity

  // Sort batches by arrival week (FIFO - oldest first)
  const sortedBatches = [...batchInventory].sort((a, b) => a.arrivalWeek - b.arrivalWeek)

  for (const batch of sortedBatches) {
    if (unallocated <= 0) {
      remaining.push(batch)
      continue
    }

    const quantityToAllocate = Math.min(unallocated, batch.quantity)

    allocations.push({
      orderCode: batch.orderCode,
      batchCode: batch.batchCode,
      quantity: quantityToAllocate,
      sellingPrice: batch.sellingPrice,
      landedUnitCost: batch.landedUnitCost,
      manufacturingCost: batch.manufacturingCost,
      freightCost: batch.freightCost,
      tariffRate: batch.tariffRate,
      tacosPercent: batch.tacosPercent,
      fbaFee: batch.fbaFee,
      amazonReferralRate: batch.amazonReferralRate,
      storagePerMonth: batch.storagePerMonth,
    })

    const remainingQuantity = batch.quantity - quantityToAllocate
    if (remainingQuantity > 0) {
      remaining.push({ ...batch, quantity: remainingQuantity })
    }

    unallocated -= quantityToAllocate
  }

  return { allocations, remainingBatches: remaining }
}

export function computeSalesPlan(
  salesWeeks: SalesWeekInput[],
  purchaseOrders: PurchaseOrderDerived[],
  options: ComputeSalesPlanOptions = {}
): SalesWeekDerived[] {
  const sortedWeeks = [...salesWeeks].sort((a, b) => a.weekNumber - b.weekNumber)
  const calendar = options.calendar ?? buildWeekCalendar(sortedWeeks)
  const arrivalSchedule = buildArrivalSchedule(purchaseOrders, calendar)

  const results: SalesWeekDerived[] = []
  const productIds = new Set<string>(options.productIds ?? [])
  const weeksByProduct = new Map<string, Map<number, SalesWeekInput>>()

  for (const week of sortedWeeks) {
    if (!weeksByProduct.has(week.productId)) {
      weeksByProduct.set(week.productId, new Map())
    }
    weeksByProduct.get(week.productId)?.set(week.weekNumber, week)
    productIds.add(week.productId)
  }

  for (const order of purchaseOrders) {
    productIds.add(order.productId)
  }

  const weekNumbers = Array.from(calendar.weekDates.keys()).sort((a, b) => a - b)

  for (const productId of productIds) {
    if (!productId || productId === PLANNING_PLACEHOLDER_PRODUCT_ID) continue
    const stockEndSeries: number[] = []
    const productWeeks = weeksByProduct.get(productId)

    // Track FIFO batch inventory across weeks for this product
    let batchInventory: BatchInventory[] = []

    for (let index = 0; index < weekNumbers.length; index += 1) {
      const weekNumber = weekNumbers[index]
      const week = productWeeks?.get(weekNumber)
      const baseDate = calendar.weekDates.get(weekNumber)
      let weekDate: Date | null = null
      if (baseDate && isValid(baseDate)) {
        weekDate = baseDate
      } else if (week?.weekDate) {
        const tentative = week.weekDate instanceof Date ? week.weekDate : new Date(week.weekDate)
        weekDate = isValid(tentative) ? tentative : null
      }

      const arrivalEntry = arrivalSchedule.get(`${productId}:${weekNumber}`)
      const arrivals = arrivalEntry?.quantity ?? 0

      // Add arriving batches to inventory
      if (arrivalEntry) {
        batchInventory.push(...arrivalEntry.batches)
      }

      const previousEnd = index > 0 ? stockEndSeries[index - 1] : coerceNumber(week?.stockStart)
      const manualStart = week?.stockStart
      const baseStart = manualStart != null ? coerceNumber(manualStart) : previousEnd
      const stockStart = baseStart + arrivals

      const actualSales = week?.actualSales != null ? coerceNumber(week.actualSales) : null
      const forecastSales = week?.forecastSales != null ? coerceNumber(week.forecastSales) : null

      let computedFinalSales: number
      if (week?.finalSales != null) {
        computedFinalSales = clampNonNegative(Math.min(stockStart, coerceNumber(week.finalSales)))
      } else {
        const demand = actualSales != null ? actualSales : forecastSales ?? 0
        computedFinalSales = clampNonNegative(Math.min(stockStart, demand))
      }

      // Allocate sales using FIFO
      const { allocations, remainingBatches } = allocateSalesFIFO(computedFinalSales, batchInventory)
      batchInventory = remainingBatches

      const stockEnd = clampNonNegative(stockStart - computedFinalSales)
      let percentError: number | null = null
      if (actualSales != null && forecastSales != null && forecastSales !== 0) {
        percentError = (actualSales - forecastSales) / Math.abs(forecastSales)
      }
      stockEndSeries.push(stockEnd)

      results.push({
        productId,
        weekNumber,
        weekDate,
        stockStart,
        arrivals,
        arrivalOrders: arrivalEntry?.orders ?? [],
        actualSales,
        forecastSales,
        finalSales: computedFinalSales,
        finalPercentError: percentError,
        stockEnd,
        stockWeeks: 0, // updated after loop
        batchAllocations: allocations.length > 0 ? allocations : undefined,
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
        const coverageWeeks = depletionIndex - i + 1
        const current = productRows[i]
        if (current.stockStart <= 0 && current.finalSales <= 0 && current.stockEnd <= 0) {
          productRows[i].stockWeeks = 0
        } else {
          productRows[i].stockWeeks = coverageWeeks
        }
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
