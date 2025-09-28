import type {
  Product,
  LeadStageTemplate,
  LeadTimeOverride,
  BusinessParameter,
  PurchaseOrder,
  PurchaseOrderPayment,
  BatchTableRow,
  SalesWeek,
  ProfitAndLossWeek,
  CashFlowWeek,
  MonthlySummary,
  QuarterlySummary,
  PurchaseOrderStatus,
} from '@prisma/client'
import {
  BusinessParameterInput,
  CashFlowWeekInput,
  LeadStageOverrideInput,
  LeadStageTemplateInput,
  MonthlySummaryInput,
  ProductInput,
  ProfitAndLossWeekInput,
  PurchaseOrderInput,
  PurchaseOrderPaymentInput,
  BatchTableRowInput,
  SalesWeekInput,
  QuarterlySummaryInput,
} from './types'

function toNumber(value: any): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const numeric = Number(value)
    return Number.isNaN(numeric) ? 0 : numeric
  }
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  const numeric = Number(value)
  return Number.isNaN(numeric) ? 0 : numeric
}

export function mapProducts(products: Product[]): ProductInput[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku ?? '',
    sellingPrice: toNumber(product.sellingPrice),
    manufacturingCost: toNumber(product.manufacturingCost),
    freightCost: toNumber(product.freightCost),
    tariffRate: toNumber(product.tariffRate),
    tacosPercent: toNumber(product.tacosPercent),
    fbaFee: toNumber(product.fbaFee),
    amazonReferralRate: toNumber(product.amazonReferralRate),
    storagePerMonth: toNumber(product.storagePerMonth),
  }))
}

export function mapLeadStageTemplates(stages: LeadStageTemplate[]): LeadStageTemplateInput[] {
  return stages.map((stage) => ({
    id: stage.id,
    label: stage.label,
    defaultWeeks: toNumber(stage.defaultWeeks),
    sequence: stage.sequence,
  }))
}

export function mapLeadOverrides(overrides: LeadTimeOverride[]): LeadStageOverrideInput[] {
  return overrides.map((override) => ({
    productId: override.productId,
    stageTemplateId: override.stageTemplateId,
    durationWeeks: toNumber(override.durationWeeks),
  }))
}

export function mapBusinessParameters(parameters: BusinessParameter[]): BusinessParameterInput[] {
  return parameters.map((parameter) => ({
    id: parameter.id,
    label: parameter.label,
    valueNumeric: parameter.valueNumeric ? toNumber(parameter.valueNumeric) : undefined,
    valueText: parameter.valueText ?? undefined,
  }))
}

export function mapPurchaseOrders(
  orders: Array<PurchaseOrder & { payments: PurchaseOrderPayment[]; batchTableRows: BatchTableRow[] }>
): PurchaseOrderInput[] {
  return orders.map((order) => {
    const batches = Array.isArray(order.batchTableRows)
      ? (order.batchTableRows as BatchTableRow[]).map((batch): BatchTableRowInput => ({
          id: batch.id,
          purchaseOrderId: batch.purchaseOrderId,
          batchCode: batch.batchCode ?? undefined,
          productId: batch.productId,
          quantity: batch.quantity != null ? Number(batch.quantity) : null,
          overrideSellingPrice: batch.overrideSellingPrice != null ? Number(batch.overrideSellingPrice) : null,
          overrideManufacturingCost:
            batch.overrideManufacturingCost != null ? Number(batch.overrideManufacturingCost) : null,
          overrideFreightCost: batch.overrideFreightCost != null ? Number(batch.overrideFreightCost) : null,
          overrideTariffRate: batch.overrideTariffRate != null ? Number(batch.overrideTariffRate) : null,
          overrideTacosPercent: batch.overrideTacosPercent != null ? Number(batch.overrideTacosPercent) : null,
          overrideFbaFee: batch.overrideFbaFee != null ? Number(batch.overrideFbaFee) : null,
          overrideReferralRate: batch.overrideReferralRate != null ? Number(batch.overrideReferralRate) : null,
          overrideStoragePerMonth:
            batch.overrideStoragePerMonth != null ? Number(batch.overrideStoragePerMonth) : null,
        }))
      : []

    const primaryBatch = batches[0]
    const totalBatchQuantity = batches.reduce((sum, batch) => sum + (batch.quantity ?? 0), 0)

    return {
      id: order.id,
      orderCode: order.orderCode,
      productId: primaryBatch?.productId ?? order.productId,
      quantity: batches.length > 0 ? totalBatchQuantity : toNumber(order.quantity),
      poDate: order.poDate ?? null,
      productionWeeks: order.productionWeeks != null ? toNumber(order.productionWeeks) : null,
      sourceWeeks: order.sourceWeeks != null ? toNumber(order.sourceWeeks) : null,
      oceanWeeks: order.oceanWeeks != null ? toNumber(order.oceanWeeks) : null,
      finalWeeks: order.finalWeeks != null ? toNumber(order.finalWeeks) : null,
      pay1Percent: order.pay1Percent != null ? toNumber(order.pay1Percent) : null,
      pay2Percent: order.pay2Percent != null ? toNumber(order.pay2Percent) : null,
      pay3Percent: order.pay3Percent != null ? toNumber(order.pay3Percent) : null,
      pay1Amount: order.pay1Amount != null ? toNumber(order.pay1Amount) : null,
      pay2Amount: order.pay2Amount != null ? toNumber(order.pay2Amount) : null,
      pay3Amount: order.pay3Amount != null ? toNumber(order.pay3Amount) : null,
      pay1Date: order.pay1Date ?? null,
      pay2Date: order.pay2Date ?? null,
      pay3Date: order.pay3Date ?? null,
      productionStart: order.productionStart ?? null,
      productionComplete: order.productionComplete ?? null,
      sourceDeparture: order.sourceDeparture ?? null,
      transportReference:
        typeof order.transportReference === 'string'
          ? order.transportReference
          : order.transportReference != null
            ? String(order.transportReference)
            : null,
      createdAt: order.createdAt ?? null,
      shipName: order.shipName ?? null,
      containerNumber: order.containerNumber ?? null,
      portEta: order.portEta ?? null,
      inboundEta: order.inboundEta ?? null,
      availableDate: order.availableDate ?? null,
      totalLeadDays: order.totalLeadDays ?? null,
      status: (typeof order.status === 'string' ? order.status : 'PLANNED') as PurchaseOrderStatus,
      statusIcon: typeof order.statusIcon === 'string' ? order.statusIcon : null,
      notes: typeof order.notes === 'string' ? order.notes : order.notes != null ? String(order.notes) : null,
      overrideSellingPrice: order.overrideSellingPrice != null ? toNumber(order.overrideSellingPrice) : null,
      overrideManufacturingCost: order.overrideManufacturingCost != null ? toNumber(order.overrideManufacturingCost) : null,
      overrideFreightCost: order.overrideFreightCost != null ? toNumber(order.overrideFreightCost) : null,
      overrideTariffRate: order.overrideTariffRate != null ? toNumber(order.overrideTariffRate) : null,
      overrideTacosPercent: order.overrideTacosPercent != null ? toNumber(order.overrideTacosPercent) : null,
      overrideFbaFee: order.overrideFbaFee != null ? toNumber(order.overrideFbaFee) : null,
      overrideReferralRate: order.overrideReferralRate != null ? toNumber(order.overrideReferralRate) : null,
      overrideStoragePerMonth: order.overrideStoragePerMonth != null ? toNumber(order.overrideStoragePerMonth) : null,
      payments: Array.isArray(order.payments)
        ? (order.payments as PurchaseOrderPayment[]).map((payment): PurchaseOrderPaymentInput => ({
            paymentIndex: payment.paymentIndex,
            percentage: payment.percentage != null ? toNumber(payment.percentage) : null,
            amountExpected: payment.amountExpected != null ? toNumber(payment.amountExpected) : null,
            amountPaid: payment.amountPaid != null ? toNumber(payment.amountPaid) : null,
            category: payment.category ?? null,
            label: payment.label ?? null,
            dueDate: payment.dueDate ?? null,
          }))
        : [],
      batchTableRows: batches,
    } as PurchaseOrderInput
  })
}

export function mapSalesWeeks(rows: SalesWeek[]): SalesWeekInput[] {
  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    weekNumber: row.weekNumber,
    weekDate: row.weekDate,
    stockStart: row.stockStart ?? null,
    actualSales: row.actualSales ?? null,
    forecastSales: row.forecastSales ?? null,
    finalSales: row.finalSales ?? null,
    stockWeeks: row.stockWeeks != null ? toNumber(row.stockWeeks) : null,
    stockEnd: row.stockEnd ?? null,
  }))
}

export function mapProfitAndLossWeeks(rows: ProfitAndLossWeek[]): ProfitAndLossWeekInput[] {
  return rows.map((row) => ({
    id: row.id,
    weekNumber: row.weekNumber,
    weekDate: row.weekDate,
    units: row.units ?? null,
    revenue: row.revenue != null ? toNumber(row.revenue) : null,
    cogs: row.cogs != null ? toNumber(row.cogs) : null,
    grossProfit: row.grossProfit != null ? toNumber(row.grossProfit) : null,
    grossMargin: row.grossMargin != null ? toNumber(row.grossMargin) : null,
    amazonFees: row.amazonFees != null ? toNumber(row.amazonFees) : null,
    ppcSpend: row.ppcSpend != null ? toNumber(row.ppcSpend) : null,
    fixedCosts: row.fixedCosts != null ? toNumber(row.fixedCosts) : null,
    totalOpex: row.totalOpex != null ? toNumber(row.totalOpex) : null,
    netProfit: row.netProfit != null ? toNumber(row.netProfit) : null,
  }))
}

export function mapCashFlowWeeks(rows: CashFlowWeek[]): CashFlowWeekInput[] {
  return rows.map((row) => ({
    id: row.id,
    weekNumber: row.weekNumber,
    weekDate: row.weekDate,
    amazonPayout: row.amazonPayout != null ? toNumber(row.amazonPayout) : null,
    inventorySpend: row.inventorySpend != null ? toNumber(row.inventorySpend) : null,
    fixedCosts: row.fixedCosts != null ? toNumber(row.fixedCosts) : null,
    netCash: row.netCash != null ? toNumber(row.netCash) : null,
    cashBalance: row.cashBalance != null ? toNumber(row.cashBalance) : null,
  }))
}

export function mapMonthlySummaries(rows: MonthlySummary[]): MonthlySummaryInput[] {
  return rows.map((row) => ({
    id: row.id,
    periodLabel: row.periodLabel,
    year: row.year,
    month: row.month,
    revenue: row.revenue != null ? toNumber(row.revenue) : null,
    cogs: row.cogs != null ? toNumber(row.cogs) : null,
    grossProfit: row.grossProfit != null ? toNumber(row.grossProfit) : null,
    amazonFees: row.amazonFees != null ? toNumber(row.amazonFees) : null,
    ppcSpend: row.ppcSpend != null ? toNumber(row.ppcSpend) : null,
    fixedCosts: row.fixedCosts != null ? toNumber(row.fixedCosts) : null,
    totalOpex: row.totalOpex != null ? toNumber(row.totalOpex) : null,
    netProfit: row.netProfit != null ? toNumber(row.netProfit) : null,
    amazonPayout: row.amazonPayout != null ? toNumber(row.amazonPayout) : null,
    inventorySpend: row.inventorySpend != null ? toNumber(row.inventorySpend) : null,
    netCash: row.netCash != null ? toNumber(row.netCash) : null,
    closingCash: row.closingCash != null ? toNumber(row.closingCash) : null,
  }))
}

export function mapQuarterlySummaries(rows: QuarterlySummary[]): QuarterlySummaryInput[] {
  return rows.map((row) => ({
    id: row.id,
    periodLabel: row.periodLabel,
    year: row.year,
    quarter: row.quarter,
    revenue: row.revenue != null ? toNumber(row.revenue) : null,
    cogs: row.cogs != null ? toNumber(row.cogs) : null,
    grossProfit: row.grossProfit != null ? toNumber(row.grossProfit) : null,
    amazonFees: row.amazonFees != null ? toNumber(row.amazonFees) : null,
    ppcSpend: row.ppcSpend != null ? toNumber(row.ppcSpend) : null,
    fixedCosts: row.fixedCosts != null ? toNumber(row.fixedCosts) : null,
    totalOpex: row.totalOpex != null ? toNumber(row.totalOpex) : null,
    netProfit: row.netProfit != null ? toNumber(row.netProfit) : null,
    amazonPayout: row.amazonPayout != null ? toNumber(row.amazonPayout) : null,
    inventorySpend: row.inventorySpend != null ? toNumber(row.inventorySpend) : null,
    netCash: row.netCash != null ? toNumber(row.netCash) : null,
    closingCash: row.closingCash != null ? toNumber(row.closingCash) : null,
  }))
}
