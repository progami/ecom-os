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
  SalesWeekInput,
  QuarterlySummaryInput,
  type PurchaseOrderStatus,
} from './types'

export type NumericLike = number | string | { toNumber(): number } | null | undefined

export interface ProductRow {
  id: string
  name: string
  sku: string | null
  isActive: boolean
  sellingPrice: NumericLike
  manufacturingCost: NumericLike
  freightCost: NumericLike
  tariffRate: NumericLike
  tacosPercent: NumericLike
  fbaFee: NumericLike
  amazonReferralRate: NumericLike
  storagePerMonth: NumericLike
}

export interface LeadStageTemplateRow {
  id: string
  label: string
  defaultWeeks: NumericLike
  sequence: number
}

export interface LeadTimeOverrideRow {
  productId: string
  stageTemplateId: string
  durationWeeks: NumericLike
}

export interface BusinessParameterRow {
  id: string
  label: string
  valueNumeric: NumericLike
  valueText: string | null
}

export interface PurchaseOrderRow {
  id: string
  orderCode: string
  productId: string
  quantity: NumericLike
  productionWeeks: NumericLike
  sourcePrepWeeks: NumericLike
  oceanWeeks: NumericLike
  finalMileWeeks: NumericLike
  pay1Percent: NumericLike
  pay2Percent: NumericLike
  pay3Percent: NumericLike
  pay1Amount: NumericLike
  pay2Amount: NumericLike
  pay3Amount: NumericLike
  pay1Date: Date | null
  pay2Date: Date | null
  pay3Date: Date | null
  productionStart: Date | null
  productionComplete: Date | null
  sourceDeparture: Date | null
  transportReference: string | null
  portEta: Date | null
  inboundEta: Date | null
  availableDate: Date | null
  totalLeadDays: number | null
  status: PurchaseOrderStatus
  statusIcon: string | null
  notes: string | null
  overrideSellingPrice: NumericLike
  overrideManufacturingCost: NumericLike
  overrideFreightCost: NumericLike
  overrideTariffRate: NumericLike
  overrideTacosPercent: NumericLike
  overrideFbaFee: NumericLike
  overrideReferralRate: NumericLike
  overrideStoragePerMonth: NumericLike
  weeksUntilArrival?: number | null
}

export interface PurchaseOrderPaymentRow {
  id: string
  paymentIndex: number
  percentage: NumericLike
  amount: NumericLike
  dueDate: Date | null
  status: string | null
}

export interface SalesWeekRow {
  id: string
  productId: string
  weekNumber: number
  weekDate: Date | null
  stockStart: number | null
  actualSales: number | null
  forecastSales: number | null
  finalSales: number | null
  stockWeeks: NumericLike
  stockEnd: number | null
}

export interface ProfitAndLossWeekRow {
  id: string
  weekNumber: number
  weekDate: Date | null
  units: number | null
  revenue: NumericLike
  cogs: NumericLike
  grossProfit: NumericLike
  grossMargin: NumericLike
  amazonFees: NumericLike
  ppcSpend: NumericLike
  fixedCosts: NumericLike
  totalOpex: NumericLike
  netProfit: NumericLike
}

export interface CashFlowWeekRow {
  id: string
  weekNumber: number
  weekDate: Date | null
  amazonPayout: NumericLike
  inventorySpend: NumericLike
  fixedCosts: NumericLike
  netCash: NumericLike
  cashBalance: NumericLike
}

export interface MonthlySummaryRow {
  id: string
  periodLabel: string
  year: number
  month: number
  revenue: NumericLike
  cogs: NumericLike
  grossProfit: NumericLike
  amazonFees: NumericLike
  ppcSpend: NumericLike
  fixedCosts: NumericLike
  totalOpex: NumericLike
  netProfit: NumericLike
  amazonPayout: NumericLike
  inventorySpend: NumericLike
  netCash: NumericLike
  closingCash: NumericLike
}

export interface QuarterlySummaryRow {
  id: string
  periodLabel: string
  year: number
  quarter: number
  revenue: NumericLike
  cogs: NumericLike
  grossProfit: NumericLike
  amazonFees: NumericLike
  ppcSpend: NumericLike
  fixedCosts: NumericLike
  totalOpex: NumericLike
  netProfit: NumericLike
  amazonPayout: NumericLike
  inventorySpend: NumericLike
  netCash: NumericLike
  closingCash: NumericLike
}

function toNumber(value: NumericLike): number {
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

export function mapProducts(products: ProductRow[]): ProductInput[] {
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

export function mapLeadStageTemplates(stages: LeadStageTemplateRow[]): LeadStageTemplateInput[] {
  return stages.map((stage) => ({
    id: stage.id,
    label: stage.label,
    defaultWeeks: toNumber(stage.defaultWeeks),
    sequence: stage.sequence,
  }))
}

export function mapLeadOverrides(overrides: LeadTimeOverrideRow[]): LeadStageOverrideInput[] {
  return overrides.map((override) => ({
    productId: override.productId,
    stageTemplateId: override.stageTemplateId,
    durationWeeks: toNumber(override.durationWeeks),
  }))
}

export function mapBusinessParameters(parameters: BusinessParameterRow[]): BusinessParameterInput[] {
  return parameters.map((parameter) => ({
    id: parameter.id,
    label: parameter.label,
    valueNumeric: parameter.valueNumeric ? toNumber(parameter.valueNumeric) : undefined,
    valueText: parameter.valueText ?? undefined,
  }))
}

export function mapPurchaseOrders(
  orders: Array<PurchaseOrderRow & { payments: PurchaseOrderPaymentRow[] }>
): PurchaseOrderInput[] {
  return orders.map((order) => ({
    id: order.id,
    orderCode: order.orderCode,
    productId: order.productId,
    quantity: toNumber(order.quantity),
    productionWeeks: order.productionWeeks != null ? toNumber(order.productionWeeks) : null,
    sourcePrepWeeks: order.sourcePrepWeeks != null ? toNumber(order.sourcePrepWeeks) : null,
    oceanWeeks: order.oceanWeeks != null ? toNumber(order.oceanWeeks) : null,
    finalMileWeeks: order.finalMileWeeks != null ? toNumber(order.finalMileWeeks) : null,
    pay1Percent: order.pay1Percent != null ? toNumber(order.pay1Percent) : null,
    pay2Percent: order.pay2Percent != null ? toNumber(order.pay2Percent) : null,
    pay3Percent: order.pay3Percent != null ? toNumber(order.pay3Percent) : null,
    pay1Amount: order.pay1Amount != null ? toNumber(order.pay1Amount) : null,
    pay2Amount: order.pay2Amount != null ? toNumber(order.pay2Amount) : null,
    pay3Amount: order.pay3Amount != null ? toNumber(order.pay3Amount) : null,
    pay1Date: order.pay1Date,
    pay2Date: order.pay2Date,
    pay3Date: order.pay3Date,
    productionStart: order.productionStart,
    productionComplete: order.productionComplete,
    sourceDeparture: order.sourceDeparture,
    transportReference: order.transportReference ?? null,
    portEta: order.portEta,
    inboundEta: order.inboundEta,
    availableDate: order.availableDate,
    totalLeadDays: order.totalLeadDays ?? null,
    status: order.status,
    statusIcon: order.statusIcon ?? null,
    notes: order.notes ?? null,
    overrideSellingPrice: order.overrideSellingPrice != null ? toNumber(order.overrideSellingPrice) : null,
    overrideManufacturingCost: order.overrideManufacturingCost != null ? toNumber(order.overrideManufacturingCost) : null,
    overrideFreightCost: order.overrideFreightCost != null ? toNumber(order.overrideFreightCost) : null,
    overrideTariffRate: order.overrideTariffRate != null ? toNumber(order.overrideTariffRate) : null,
    overrideTacosPercent: order.overrideTacosPercent != null ? toNumber(order.overrideTacosPercent) : null,
    overrideFbaFee: order.overrideFbaFee != null ? toNumber(order.overrideFbaFee) : null,
    overrideReferralRate: order.overrideReferralRate != null ? toNumber(order.overrideReferralRate) : null,
    overrideStoragePerMonth: order.overrideStoragePerMonth != null ? toNumber(order.overrideStoragePerMonth) : null,
    payments: order.payments.map<PurchaseOrderPaymentInput>((payment) => ({
      paymentIndex: payment.paymentIndex,
      percentage: payment.percentage != null ? toNumber(payment.percentage) : null,
      amount: payment.amount != null ? toNumber(payment.amount) : null,
      paymentDate: payment.dueDate,
      status: payment.status,
    })),
  }))
}

export function mapSalesWeeks(rows: SalesWeekRow[]): SalesWeekInput[] {
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

export function mapProfitAndLossWeeks(rows: ProfitAndLossWeekRow[]): ProfitAndLossWeekInput[] {
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

export function mapCashFlowWeeks(rows: CashFlowWeekRow[]): CashFlowWeekInput[] {
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

export function mapMonthlySummaries(rows: MonthlySummaryRow[]): MonthlySummaryInput[] {
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

export function mapQuarterlySummaries(rows: QuarterlySummaryRow[]): QuarterlySummaryInput[] {
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
