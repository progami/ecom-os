import { format, getQuarter } from 'date-fns'
import { coerceNumber } from '@/lib/utils/numbers'
import type { BusinessParameterMap, CashFlowWeekInput, ProfitAndLossWeekInput } from './types'
import type { PurchaseOrderDerived } from './ops'
import type { SalesWeekDerived } from './sales'
import { ProductCostSummary } from './product'
import { buildWeekCalendar, getCalendarDateForWeek, weekNumberForDate } from './calendar'

export interface ProfitAndLossWeekDerived {
  weekNumber: number
  weekDate: Date | null
  units: number
  revenue: number
  cogs: number
  grossProfit: number
  grossMargin: number
  amazonFees: number
  ppcSpend: number
  fixedCosts: number
  totalOpex: number
  netProfit: number
}

export interface FinancialSummaryRow {
  periodLabel: string
  revenue: number
  cogs: number
  grossProfit: number
  amazonFees: number
  ppcSpend: number
  fixedCosts: number
  totalOpex: number
  netProfit: number
}

export interface CashFlowWeekDerived {
  weekNumber: number
  weekDate: Date | null
  amazonPayout: number
  inventorySpend: number
  fixedCosts: number
  netCash: number
  cashBalance: number
}

export interface CashFlowSummaryRow {
  periodLabel: string
  amazonPayout: number
  inventorySpend: number
  fixedCosts: number
  netCash: number
  closingCash: number
}

function coerceDate(value: Date | string | number | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function computeProfitAndLoss(
  sales: SalesWeekDerived[],
  products: Map<string, ProductCostSummary>,
  businessParams: BusinessParameterMap,
  weeklyOverrides: ProfitAndLossWeekInput[]
): {
  weekly: ProfitAndLossWeekDerived[]
  monthly: FinancialSummaryRow[]
  quarterly: FinancialSummaryRow[]
} {
  const salesByWeek = new Map<number, SalesWeekDerived[]>()
  for (const row of sales) {
    const bucket = salesByWeek.get(row.weekNumber)
    if (bucket) {
      bucket.push(row)
    } else {
      salesByWeek.set(row.weekNumber, [row])
    }
  }

  const overridesByWeek = new Map<number, ProfitAndLossWeekInput>()
  for (const override of weeklyOverrides) {
    overridesByWeek.set(override.weekNumber, override)
  }

  const weekNumbers = Array.from(new Set([...salesByWeek.keys(), ...overridesByWeek.keys()])).sort(
    (a, b) => a - b
  )

  const weekly: ProfitAndLossWeekDerived[] = []

  for (const weekNumber of weekNumbers) {
    const salesRows = salesByWeek.get(weekNumber) ?? []
    const override = overridesByWeek.get(weekNumber)

    let weekDate: Date | null = null
    if (override?.weekDate) {
      weekDate = coerceDate(override.weekDate)
    }
    if (!weekDate) {
      weekDate = salesRows.find((row) => row.weekDate)?.weekDate ?? null
    }

    const derived = salesRows.reduce(
      (acc, row) => {
        // Use batch allocations if available (FIFO costing)
        if (row.batchAllocations && row.batchAllocations.length > 0) {
          for (const allocation of row.batchAllocations) {
            const units = allocation.quantity
            const revenue = units * allocation.sellingPrice
            const landedCost = units * allocation.landedUnitCost
            const referralFee = revenue * allocation.amazonReferralRate
            const fbaFees = units * allocation.fbaFee
            const storageFees = units * allocation.storagePerMonth
            const amazonFees = referralFee + fbaFees + storageFees
            const advertising = units * allocation.sellingPrice * allocation.tacosPercent

            acc.units += units
            acc.revenue += revenue
            acc.cogs += landedCost
            acc.amazonFees += amazonFees
            acc.ppcSpend += advertising
          }
        } else {
          // Fallback to product defaults (for backwards compatibility)
          const product = products.get(row.productId)
          if (!product) return acc
          const units = row.finalSales
          const revenue = units * product.sellingPrice
          const landedCost = units * product.landedUnitCost
          const referralFee = revenue * product.amazonReferralRate
          const fbaFees = units * product.fbaFee
          const storageFees = units * product.storagePerMonth
          const amazonFees = referralFee + fbaFees + storageFees
          const advertising = units * product.sellingPrice * product.tacosPercent

          acc.units += units
          acc.revenue += revenue
          acc.cogs += landedCost
          acc.amazonFees += amazonFees
          acc.ppcSpend += advertising
        }
        return acc
      },
      { units: 0, revenue: 0, cogs: 0, amazonFees: 0, ppcSpend: 0 }
    )

    const units = override?.units != null ? coerceNumber(override.units) : derived.units
    const revenue = override?.revenue != null ? coerceNumber(override.revenue) : derived.revenue
    const cogs = override?.cogs != null ? coerceNumber(override.cogs) : derived.cogs
    const grossProfit = override?.grossProfit != null ? coerceNumber(override.grossProfit) : revenue - cogs
    const amazonFees = override?.amazonFees != null ? coerceNumber(override.amazonFees) : derived.amazonFees
    const ppcSpend = override?.ppcSpend != null ? coerceNumber(override.ppcSpend) : derived.ppcSpend
    const fixedCosts = override?.fixedCosts != null ? coerceNumber(override.fixedCosts) : businessParams.weeklyFixedCosts
    const totalOpex = override?.totalOpex != null ? coerceNumber(override.totalOpex) : amazonFees + ppcSpend + fixedCosts
    const netProfit = override?.netProfit != null ? coerceNumber(override.netProfit) : grossProfit - totalOpex
    const grossMargin = revenue === 0 ? 0 : grossProfit / revenue

    weekly.push({
      weekNumber,
      weekDate,
      units,
      revenue,
      cogs,
      grossProfit,
      grossMargin,
      amazonFees,
      ppcSpend,
      fixedCosts,
      totalOpex,
      netProfit,
    })
  }

  const monthly = aggregateFinancialSummaries(weekly, 'month')
  const quarterly = aggregateFinancialSummaries(weekly, 'quarter')

  return { weekly, monthly, quarterly }
}

function aggregateFinancialSummaries(
  weekly: ProfitAndLossWeekDerived[],
  mode: 'month' | 'quarter'
): FinancialSummaryRow[] {
  const buckets = new Map<string, { label: string; totals: FinancialSummaryRow; sortKey: number }>()

  for (const row of weekly) {
    if (!row.weekDate) continue
    const periodKey = mode === 'month'
      ? format(row.weekDate, 'yyyy-MM')
      : `${row.weekDate.getFullYear()}-Q${getQuarter(row.weekDate)}`
    const periodLabel = mode === 'month'
      ? format(row.weekDate, 'MMM yyyy')
      : `Q${getQuarter(row.weekDate)} ${row.weekDate.getFullYear()}`

    if (!buckets.has(periodKey)) {
      const sortKey = mode === 'month'
        ? parseInt(format(row.weekDate, 'yyyyMM'), 10)
        : row.weekDate.getFullYear() * 10 + getQuarter(row.weekDate)
      buckets.set(periodKey, {
        label: periodLabel,
        sortKey,
        totals: {
          periodLabel: periodLabel,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          amazonFees: 0,
          ppcSpend: 0,
          fixedCosts: 0,
          totalOpex: 0,
          netProfit: 0,
        },
      })
    }

    const entry = buckets.get(periodKey)!
    entry.totals.revenue += row.revenue
    entry.totals.cogs += row.cogs
    entry.totals.grossProfit += row.grossProfit
    entry.totals.amazonFees += row.amazonFees
    entry.totals.ppcSpend += row.ppcSpend
    entry.totals.fixedCosts += row.fixedCosts
    entry.totals.totalOpex += row.totalOpex
    entry.totals.netProfit += row.netProfit
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((item) => item.totals)
}

export function computeCashFlow(
  weeklyPnl: ProfitAndLossWeekDerived[],
  purchaseOrders: PurchaseOrderDerived[],
  businessParams: BusinessParameterMap,
  cashOverrides: CashFlowWeekInput[]
): {
  weekly: CashFlowWeekDerived[]
  monthly: CashFlowSummaryRow[]
  quarterly: CashFlowSummaryRow[]
} {
  const calendar = buildWeekCalendar(
    weeklyPnl.map((row) => ({
      productId: 'aggregate',
      id: `${row.weekNumber}`,
      weekNumber: row.weekNumber,
      weekDate: row.weekDate ?? undefined,
    }))
  )

  const overridesByWeek = new Map<number, CashFlowWeekInput>()
  for (const override of cashOverrides) {
    overridesByWeek.set(override.weekNumber, override)
  }

  const revenueByWeek = new Map<number, number>()
  for (const row of weeklyPnl) {
    revenueByWeek.set(row.weekNumber, row.revenue)
  }

  const payoutDelay = Math.max(0, Math.round(businessParams.amazonPayoutDelayWeeks))
  const amazonPayoutByWeek = new Map<number, number>()
  for (const [weekNumber, revenue] of revenueByWeek.entries()) {
    const payoutWeek = weekNumber + payoutDelay
    amazonPayoutByWeek.set(payoutWeek, (amazonPayoutByWeek.get(payoutWeek) ?? 0) + revenue)
  }

  const inventorySpendByWeek = new Map<number, number>()
  for (const order of purchaseOrders) {
    for (const payment of order.plannedPayments) {
      const date = payment.actualDate ?? payment.plannedDate
      const weekNumber = weekNumberForDate(date ?? null, calendar)
      if (weekNumber == null) continue
      const amount = coerceNumber(payment.actualAmount ?? payment.plannedAmount)
      inventorySpendByWeek.set(weekNumber, (inventorySpendByWeek.get(weekNumber) ?? 0) + amount)
    }
  }

  const weekNumbers = Array.from(new Set([
    ...weeklyPnl.map((row) => row.weekNumber),
    ...amazonPayoutByWeek.keys(),
    ...inventorySpendByWeek.keys(),
    ...overridesByWeek.keys(),
  ])).sort((a, b) => a - b)

  const weekly: CashFlowWeekDerived[] = []
  let runningBalance = businessParams.startingCash

  for (const weekNumber of weekNumbers) {
    const override = overridesByWeek.get(weekNumber)
    const baseWeekDate = weeklyPnl.find((row) => row.weekNumber === weekNumber)?.weekDate ?? null
    const calendarWeekDate = getCalendarDateForWeek(weekNumber, calendar)
    const resolvedWeekDate = baseWeekDate ?? calendarWeekDate

    const amazonPayout = override?.amazonPayout != null
      ? coerceNumber(override.amazonPayout)
      : amazonPayoutByWeek.get(weekNumber) ?? 0
    const inventorySpend = override?.inventorySpend != null
      ? coerceNumber(override.inventorySpend)
      : inventorySpendByWeek.get(weekNumber) ?? 0
    const fixedCosts = override?.fixedCosts != null
      ? coerceNumber(override.fixedCosts)
      : businessParams.weeklyFixedCosts
    const netCash = override?.netCash != null
      ? coerceNumber(override.netCash)
      : amazonPayout - inventorySpend - fixedCosts

    const computedBalance = runningBalance + netCash
    const cashBalance = override?.cashBalance != null
      ? coerceNumber(override.cashBalance)
      : computedBalance

    runningBalance = cashBalance

    weekly.push({
      weekNumber,
      weekDate: resolvedWeekDate,
      amazonPayout,
      inventorySpend,
      fixedCosts,
      netCash,
      cashBalance,
    })
  }

  const monthly = aggregateCashSummaries(weekly, 'month')
  const quarterly = aggregateCashSummaries(weekly, 'quarter')

  return { weekly, monthly, quarterly }
}

function aggregateCashSummaries(
  weekly: CashFlowWeekDerived[],
  mode: 'month' | 'quarter'
): CashFlowSummaryRow[] {
  const buckets = new Map<string, { label: string; totals: CashFlowSummaryRow; sortKey: number }>()

  for (const row of weekly) {
    if (!row.weekDate) continue
    const periodKey = mode === 'month'
      ? format(row.weekDate, 'yyyy-MM')
      : `${row.weekDate.getFullYear()}-Q${getQuarter(row.weekDate)}`
    const periodLabel = mode === 'month'
      ? format(row.weekDate, 'MMM yyyy')
      : `Q${getQuarter(row.weekDate)} ${row.weekDate.getFullYear()}`

    if (!buckets.has(periodKey)) {
      const sortKey = mode === 'month'
        ? parseInt(format(row.weekDate, 'yyyyMM'), 10)
        : row.weekDate.getFullYear() * 10 + getQuarter(row.weekDate)
      buckets.set(periodKey, {
        label: periodLabel,
        sortKey,
        totals: {
          periodLabel: periodLabel,
          amazonPayout: 0,
          inventorySpend: 0,
          fixedCosts: 0,
          netCash: 0,
          closingCash: 0,
        },
      })
    }

    const entry = buckets.get(periodKey)!
    entry.totals.amazonPayout += row.amazonPayout
    entry.totals.inventorySpend += row.inventorySpend
    entry.totals.fixedCosts += row.fixedCosts
    entry.totals.netCash += row.netCash
    entry.totals.closingCash = row.cashBalance
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((item) => item.totals)
}
