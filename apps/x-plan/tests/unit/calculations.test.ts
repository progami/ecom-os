import { describe, expect, it } from 'vitest'
import { differenceInCalendarDays } from 'date-fns'
import {
  buildWeekCalendar,
  buildYearSegments,
  getCalendarDateForWeek,
} from '@/lib/calculations/calendar'
import {
  buildProductCostIndex,
  computeCashFlow,
  computeDashboardSummary,
  computeProductCostSummary,
  computeProfitAndLoss,
  computePurchaseOrderDerived,
  computeSalesPlan,
} from '@/lib/calculations'
import type {
  BusinessParameterMap,
  LeadTimeProfile,
  ProductInput,
  PurchaseOrderDerived,
  PurchaseOrderInput,
  SalesWeekInput,
} from '@/lib/calculations'

const product: ProductInput = {
  id: 'prod-1',
  name: 'Widget',
  sku: 'W-1',
  sellingPrice: 10,
  manufacturingCost: 3,
  freightCost: 1,
  tariffRate: 0.05,
  tacosPercent: 0.1,
  fbaFee: 2,
  amazonReferralRate: 0.15,
  storagePerMonth: 0.5,
}

const productSummary = computeProductCostSummary(product)
const productIndex = buildProductCostIndex([product])

const leadProfile: LeadTimeProfile = {
  productionWeeks: 1,
  sourcePrepWeeks: 0,
  oceanWeeks: 0,
  finalMileWeeks: 0,
}

const parameters: BusinessParameterMap = {
  startingCash: 1000,
  amazonPayoutDelayWeeks: 2,
  weeklyFixedCosts: 200,
  supplierPaymentTermsWeeks: 1,
  supplierPaymentSplit: [0.3, 0.3, 0.4],
  stockWarningWeeks: 4,
}

const productionStart = new Date('2024-01-01T00:00:00.000Z')
const arrivalDate = new Date('2024-01-15T00:00:00.000Z')

const purchaseOrderInput: PurchaseOrderInput = {
  id: 'po-1',
  orderCode: 'PO-1',
  productId: product.id,
  quantity: 100,
  productionWeeks: leadProfile.productionWeeks,
  sourcePrepWeeks: leadProfile.sourcePrepWeeks,
  oceanWeeks: leadProfile.oceanWeeks,
  finalMileWeeks: leadProfile.finalMileWeeks,
  productionStart,
  availableDate: arrivalDate,
  inboundEta: arrivalDate,
  status: 'PLANNED',
  payments: [],
}

const derivedOrder = computePurchaseOrderDerived(
  purchaseOrderInput,
  productSummary,
  leadProfile,
  parameters
)

const salesWeeks: SalesWeekInput[] = [
  {
    id: 'w1',
    productId: product.id,
    weekNumber: 1,
    weekDate: new Date('2024-01-01T00:00:00.000Z'),
    stockStart: 500,
    actualSales: 50,
    forecastSales: 60,
  },
  {
    id: 'w2',
    productId: product.id,
    weekNumber: 2,
    weekDate: new Date('2024-01-08T00:00:00.000Z'),
    actualSales: 60,
    forecastSales: 60,
  },
  {
    id: 'w3',
    productId: product.id,
    weekNumber: 3,
    weekDate: new Date('2024-01-15T00:00:00.000Z'),
    forecastSales: 70,
  },
]

const salesPlan = computeSalesPlan(salesWeeks, [derivedOrder])

describe('computePurchaseOrderDerived', () => {
  it('calculates landed cost and payment schedule', () => {
    expect(derivedOrder.plannedPoValue).toBeCloseTo(700)
    expect(derivedOrder.plannedPayments[0].plannedAmount).toBeCloseTo(210)
    expect(derivedOrder.plannedPayments[0].plannedPercent).toBeCloseTo(0.3)
    expect(
      differenceInCalendarDays(
        derivedOrder.plannedPayments[0].plannedDate!,
        productionStart
      )
    ).toBe(7)
    expect(
      differenceInCalendarDays(
        derivedOrder.productionComplete!,
        productionStart
      )
    ).toBe(7)
  })

  it('honours per-order cost overrides', () => {
    const overrideOrder: PurchaseOrderInput = {
      ...purchaseOrderInput,
      overrideManufacturingCost: 5,
      overrideFreightCost: 2,
      overrideTariffRate: 0.1,
      overrideTacosPercent: 0.2,
      overrideFbaFee: 1,
      overrideStoragePerMonth: 0.3,
    }

    const overridden = computePurchaseOrderDerived(
      overrideOrder,
      productSummary,
      leadProfile,
      parameters
    )

    expect(overridden.landedUnitCost).toBeCloseTo(5 + 2 + (overrideOrder.overrideSellingPrice ?? product.sellingPrice) * 0.1 + 1 + 0.3)
    expect(overridden.plannedPoValue).toBeCloseTo(overridden.landedUnitCost * overrideOrder.quantity)
  })
})

describe('computeSalesPlan', () => {
  it('derives final sales and ending inventory', () => {
    const week1 = salesPlan.find((row) => row.weekNumber === 1 && row.productId === product.id)
    const week3 = salesPlan.find((row) => row.weekNumber === 3 && row.productId === product.id)

    expect(week1).toBeDefined()
    expect(week1?.finalSales).toBe(50)
    expect(week1?.stockEnd).toBe(450)

    expect(week3).toBeDefined()
    expect(week3?.stockStart).toBe(490)
    expect(week3?.finalSales).toBe(70)
    expect(week3?.stockEnd).toBe(420)
  })
})

const profitResult = computeProfitAndLoss(
  salesPlan,
  productIndex,
  parameters,
  []
)

describe('computeProfitAndLoss', () => {
  it('aggregates weekly revenue and expenses', () => {
    const week1 = profitResult.weekly[0]
    expect(week1.weekNumber).toBe(1)
    expect(week1.revenue).toBeCloseTo(500)
    expect(week1.cogs).toBeCloseTo(350)
    expect(week1.grossProfit).toBeCloseTo(150)
    expect(week1.amazonFees).toBeCloseTo(175)
    expect(week1.ppcSpend).toBeCloseTo(50)
    expect(week1.fixedCosts).toBe(parameters.weeklyFixedCosts)
    expect(week1.netProfit).toBeCloseTo(-275)
  })
})

const cashResult = computeCashFlow(
  profitResult.weekly,
  [derivedOrder],
  parameters,
  []
)

describe('computeCashFlow', () => {
  it('delays payouts and offsets inventory spend', () => {
    const week1 = cashResult.weekly.find((row) => row.weekNumber === 1)
    const week2 = cashResult.weekly.find((row) => row.weekNumber === 2)
    const week3 = cashResult.weekly.find((row) => row.weekNumber === 3)

    expect(week1?.cashBalance).toBeCloseTo(800)
    expect(week2?.inventorySpend).toBeCloseTo(0)
    expect(week3?.amazonPayout).toBeCloseTo(500)
    expect(week3?.cashBalance).toBeCloseTo(900)
  })

  it('carries delayed payouts into future planning years', () => {
    const delayed = computeCashFlow(
      profitResult.weekly,
      [derivedOrder],
      { ...parameters, amazonPayoutDelayWeeks: 60 },
      []
    )

    const payoutWeek = delayed.weekly.find((row) => row.weekNumber === 61)
    expect(payoutWeek).toBeDefined()
    expect(payoutWeek?.amazonPayout).toBeCloseTo(500)
    expect(payoutWeek?.cashBalance).toBeGreaterThan(0)
  })
})

describe('computeDashboardSummary', () => {
  it('summarises revenue, cash, and pipeline', () => {
    const dashboard = computeDashboardSummary(
      profitResult.weekly,
      cashResult.weekly,
      [derivedOrder],
      salesPlan,
      productIndex
    )
    expect(dashboard.revenueYtd).toBeCloseTo(1800)
    expect(dashboard.cashBalance).toBeCloseTo(1800)
    expect(dashboard.pipeline).toEqual([{ status: 'PLANNED', quantity: 100 }])
    expect(dashboard.inventory[0]?.stockEnd).toBe(420)
  })
})

describe('calendar continuity', () => {
  it('fills missing weeks and derives year segments through 2027', () => {
    const multiYearWeeks: SalesWeekInput[] = [
      {
        id: 'w1',
        productId: product.id,
        weekNumber: 1,
        weekDate: new Date('2025-01-06T00:00:00.000Z'),
        stockStart: 500,
      },
      {
        id: 'w60',
        productId: product.id,
        weekNumber: 60,
        actualSales: 40,
      },
      {
        id: 'w120',
        productId: product.id,
        weekNumber: 120,
        forecastSales: 50,
      },
      {
        id: 'w156',
        productId: product.id,
        weekNumber: 156,
      },
    ]

    const calendar = buildWeekCalendar(multiYearWeeks)
    expect(calendar.calendarStart).toBeInstanceOf(Date)
    expect(calendar.weekDates.has(2)).toBe(true)

    const weekTwoDate = getCalendarDateForWeek(2, calendar)
    expect(weekTwoDate).toBeInstanceOf(Date)
    expect(weekTwoDate?.getFullYear()).toBe(2025)

    const segments = buildYearSegments(calendar)
    const years = segments.map((segment) => segment.year)
    expect(years).toEqual([2025, 2026, 2027])

    const segment2025 = segments.find((segment) => segment.year === 2025)
    const segment2026 = segments.find((segment) => segment.year === 2026)
    const segment2027 = segments.find((segment) => segment.year === 2027)

    expect(segment2025?.startWeekNumber).toBe(1)
    expect(segment2026?.startWeekNumber).toBe((segment2025?.endWeekNumber ?? 0) + 1)
    expect(segment2027?.endWeekNumber).toBe(156)

    const first2027Date = segment2027
      ? getCalendarDateForWeek(segment2027.startWeekNumber, calendar)
      : null
    expect(first2027Date?.getFullYear()).toBe(2027)
  })
})
