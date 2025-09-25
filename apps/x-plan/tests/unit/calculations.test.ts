import { describe, expect, it } from 'vitest'
import { differenceInCalendarDays } from 'date-fns'
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
    expect(derivedOrder.plannedPoValue).toBeCloseTo(
      product.manufacturingCost * purchaseOrderInput.quantity +
        product.freightCost * purchaseOrderInput.quantity
    )
    expect(derivedOrder.plannedPayments[0].plannedAmount).toBeCloseTo(120)
    expect(derivedOrder.plannedPayments[0].plannedPercent).toBeCloseTo(0.3)
    expect(derivedOrder.manufacturingUnitCost).toBeCloseTo(product.manufacturingCost)
    expect(derivedOrder.freightUnitCost).toBeCloseTo(product.freightCost)
    expect(derivedOrder.manufacturingInvoice).toBeCloseTo(product.manufacturingCost * purchaseOrderInput.quantity)
    expect(derivedOrder.freightInvoice).toBeCloseTo(product.freightCost * purchaseOrderInput.quantity)
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
    expect(overridden.plannedPoValue).toBeCloseTo(
      (overrideOrder.overrideManufacturingCost ?? 0) * overrideOrder.quantity +
        (overrideOrder.overrideFreightCost ?? 0) * overrideOrder.quantity
    )
    expect(overridden.manufacturingUnitCost).toBeCloseTo(overrideOrder.overrideManufacturingCost ?? 0)
    expect(overridden.freightUnitCost).toBeCloseTo(overrideOrder.overrideFreightCost ?? 0)
    expect(overridden.manufacturingInvoice).toBeCloseTo((overrideOrder.overrideManufacturingCost ?? 0) * overrideOrder.quantity)
    expect(overridden.freightInvoice).toBeCloseTo((overrideOrder.overrideFreightCost ?? 0) * overrideOrder.quantity)
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
