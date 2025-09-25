import { addDays, differenceInCalendarDays } from 'date-fns'
import {
  BusinessParameterMap,
  LeadTimeProfile,
  PurchaseOrderInput,
  PurchaseOrderPaymentInput,
  PurchaseOrderStatus,
} from './types'
import { ProductCostSummary } from './product'

export interface PaymentPlanItem {
  paymentIndex: 1 | 2 | 3
  plannedPercent: number
  plannedAmount: number
  plannedDate: Date | null
  actualPercent?: number | null
  actualAmount?: number | null
  actualDate?: Date | null
  status?: string | null
}

export interface PurchaseOrderDerived {
  id: string
  orderCode: string
  productId: string
  quantity: number
  status: PurchaseOrderStatus
  statusIcon?: string | null
  notes?: string | null
  stageProfile: LeadTimeProfile
  productionStart: Date | null
  productionComplete: Date | null
  sourceDeparture: Date | null
  transportReference: string | null
  portEta: Date | null
  inboundEta: Date | null
  availableDate: Date | null
  totalLeadDays: number | null
  weeksUntilArrival: number | null
  landedUnitCost: number
  manufacturingUnitCost: number
  freightUnitCost: number
  manufacturingInvoice: number
  freightInvoice: number
  plannedPoValue: number
  plannedPayments: PaymentPlanItem[]
  payments: PurchaseOrderPaymentInput[]
  paidAmount: number
  paidPercent: number
  remainingAmount: number
  remainingPercent: number
}

const STATUS_ICON_MAP: Record<PurchaseOrderStatus, string> = {
  PLANNED: '📝',
  PRODUCTION: '🛠',
  IN_TRANSIT: '🚢',
  ARRIVED: '✅',
  CLOSED: '✔',
  CANCELLED: '✖',
}

const PAY_PERCENT_FIELDS = ['pay1Percent', 'pay2Percent', 'pay3Percent'] as const
const PAY_AMOUNT_FIELDS = ['pay1Amount', 'pay2Amount', 'pay3Amount'] as const
const PAY_DATE_FIELDS = ['pay1Date', 'pay2Date', 'pay3Date'] as const

function resolveOverride(base: number, override?: number | null): number {
  if (override == null || Number.isNaN(override)) return base
  return Number(override)
}

function toNumber(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0
  return Number(value)
}

function normalizePercentValue(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return null
  return numeric > 1 ? numeric / 100 : numeric
}

function percentOrSplit(value: number | null | undefined, fallback: number): number {
  const normalized = normalizePercentValue(value)
  if (normalized == null) return fallback
  return normalized
}

function resolveStageWeeks(stageValue: number | null | undefined, fallback: number): number {
  const numeric = toNumber(stageValue)
  return numeric > 0 ? numeric : fallback
}

function normalizePaymentIndex(index: number | null | undefined): 1 | 2 | 3 {
  if (index === 2) return 2
  if (index === 3) return 3
  return 1
}

function findPayment(
  payments: PurchaseOrderPaymentInput[] | undefined,
  index: number
): PurchaseOrderPaymentInput | undefined {
  if (!payments || payments.length === 0) return undefined
  return payments.find((payment) => normalizePaymentIndex(payment.paymentIndex) === index)
}

function inferProductionStart(
  order: PurchaseOrderInput,
  stageProfile: LeadTimeProfile,
  params: BusinessParameterMap
): Date | null {
  if (order.productionStart) return order.productionStart
  if (order.pay1Date) {
    return addDays(order.pay1Date, -Math.round(params.supplierPaymentTermsWeeks * 7))
  }
  if (order.availableDate) {
    const totalDays = Math.round(
      (stageProfile.productionWeeks +
        stageProfile.sourcePrepWeeks +
        stageProfile.oceanWeeks +
        stageProfile.finalMileWeeks) * 7
    )
    return addDays(order.availableDate, -totalDays)
  }
  if (order.inboundEta) {
    const totalDays = Math.round((stageProfile.finalMileWeeks) * 7)
    return addDays(order.inboundEta, -totalDays)
  }
  return null
}

function computeStageDate(
  current: Date | null,
  weeks: number
): Date | null {
  if (!current) return null
  const days = Math.round(weeks * 7)
  if (days === 0) return current
  return addDays(current, days)
}

function computeWeeksUntil(date: Date | null): number | null {
  if (!date) return null
  const diffDays = differenceInCalendarDays(date, new Date())
  if (!Number.isFinite(diffDays)) return null
  return Math.max(Math.ceil(diffDays / 7), 0)
}

function plannedPaymentDate(
  index: 1 | 2 | 3,
  baseDates: { productionStart: Date | null; productionComplete: Date | null; inboundEta: Date | null },
  stageProfile: LeadTimeProfile,
  params: BusinessParameterMap
): Date | null {
  if (index === 1) {
    if (!baseDates.productionStart) return null
    const daysOffset = Math.round(params.supplierPaymentTermsWeeks * 7)
    return addDays(baseDates.productionStart, daysOffset)
  }
  if (index === 2) {
    if (baseDates.productionComplete) return baseDates.productionComplete
    if (baseDates.productionStart) return computeStageDate(baseDates.productionStart, stageProfile.productionWeeks)
    return null
  }
  // index === 3
  if (baseDates.inboundEta) return baseDates.inboundEta
  return null
}

export function computePurchaseOrderDerived(
  order: PurchaseOrderInput,
  product: ProductCostSummary,
  stageProfile: LeadTimeProfile,
  params: BusinessParameterMap
): PurchaseOrderDerived {
  const sellingPrice = resolveOverride(product.sellingPrice, order.overrideSellingPrice)
  const manufacturingCost = resolveOverride(product.manufacturingCost, order.overrideManufacturingCost)
  const freightCost = resolveOverride(product.freightCost, order.overrideFreightCost)
  const tariffRate = resolveOverride(product.tariffRate, order.overrideTariffRate)
  const tacosPercent = resolveOverride(product.tacosPercent, order.overrideTacosPercent)
  const fbaFee = resolveOverride(product.fbaFee, order.overrideFbaFee)
  const referralRate = resolveOverride(product.amazonReferralRate, order.overrideReferralRate)
  const storagePerMonth = resolveOverride(product.storagePerMonth, order.overrideStoragePerMonth)

  const tariffCost = sellingPrice * tariffRate
  const advertisingCost = sellingPrice * tacosPercent
  const landedUnitCost = manufacturingCost + freightCost + tariffCost + fbaFee + storagePerMonth

  const quantity = Math.max(0, toNumber(order.quantity))
  const productionWeeks = resolveStageWeeks(order.productionWeeks, stageProfile.productionWeeks)
  const sourcePrepWeeks = resolveStageWeeks(order.sourcePrepWeeks, stageProfile.sourcePrepWeeks)
  const oceanWeeks = resolveStageWeeks(order.oceanWeeks, stageProfile.oceanWeeks)
  const finalMileWeeks = resolveStageWeeks(order.finalMileWeeks, stageProfile.finalMileWeeks)

  const resolvedProfile: LeadTimeProfile = {
    productionWeeks,
    sourcePrepWeeks,
    oceanWeeks,
    finalMileWeeks,
  }

  const productionStart = inferProductionStart(order, resolvedProfile, params)
  const productionComplete = order.productionComplete ?? computeStageDate(productionStart, productionWeeks)
  const sourceDeparture = order.sourceDeparture ?? computeStageDate(productionComplete, sourcePrepWeeks)
  const portEta = order.portEta ?? computeStageDate(sourceDeparture, oceanWeeks)
  const inboundEta = order.inboundEta ?? computeStageDate(portEta, finalMileWeeks)
  const availableDate = order.availableDate ?? inboundEta

  const totalLeadDays = order.totalLeadDays ?? Math.round(
    (productionWeeks + sourcePrepWeeks + oceanWeeks + finalMileWeeks) * 7
  )
  const weeksUntilArrival = computeWeeksUntil(inboundEta)

  const poValue = landedUnitCost * quantity
  const manufacturingInvoice = manufacturingCost * quantity
  const freightInvoice = freightCost * quantity

  const paymentSplits = params.supplierPaymentSplit
  const payments: PaymentPlanItem[] = []

  const baseDates = { productionStart, productionComplete, inboundEta }

  for (let index = 1 as 1 | 2 | 3; index <= 3; index = (index + 1) as 1 | 2 | 3) {
    const percentField = PAY_PERCENT_FIELDS[index - 1]
    const amountField = PAY_AMOUNT_FIELDS[index - 1]
    const dateField = PAY_DATE_FIELDS[index - 1]

    const percentOverride = normalizePercentValue(order[percentField])
    const amountOverride = order[amountField]
    const dateOverride = order[dateField]

    const plannedPercent = percentOrSplit(percentOverride ?? null, paymentSplits[index - 1] ?? 0)
    const plannedAmount = poValue * plannedPercent
    const plannedDate = plannedPaymentDate(index, baseDates, resolvedProfile, params)

    const actualPayment = findPayment(order.payments, index)
    const recordedAmount = actualPayment?.amount ?? amountOverride
    const actualAmount = recordedAmount != null ? toNumber(recordedAmount) : 0
    const recordedPercent = actualPayment?.percentage ?? percentOverride
    const actualPercent = normalizePercentValue(recordedPercent) ?? (poValue > 0 ? actualAmount / poValue : 0)
    const actualDate = actualPayment?.dueDate ?? dateOverride ?? plannedDate

    payments.push({
      paymentIndex: index,
      plannedPercent,
      plannedAmount,
      plannedDate,
      actualAmount,
      actualPercent,
      actualDate,
      status: actualPayment?.status ?? null,
    })
  }

  const totalPaidAmount = payments.reduce((sum, payment) => {
    const amount = toNumber(payment.actualAmount)
    return sum + amount
  }, 0)
  const totalPaidPercent = poValue > 0 ? totalPaidAmount / poValue : 0

  return {
    id: order.id,
    orderCode: order.orderCode,
    productId: order.productId,
    quantity,
    status: order.status,
    statusIcon: order.statusIcon ?? STATUS_ICON_MAP[order.status],
    notes: order.notes ?? null,
    stageProfile: resolvedProfile,
    productionStart,
    productionComplete,
    sourceDeparture,
    transportReference: order.transportReference ?? null,
    portEta,
    inboundEta,
    availableDate,
    totalLeadDays,
    weeksUntilArrival,
    landedUnitCost,
    manufacturingUnitCost: manufacturingCost,
    freightUnitCost: freightCost,
    manufacturingInvoice,
    freightInvoice,
    plannedPoValue: poValue,
    plannedPayments: payments,
    payments: order.payments ?? [],
    paidAmount: totalPaidAmount,
    paidPercent: totalPaidPercent,
    remainingAmount: Math.max(poValue - totalPaidAmount, 0),
    remainingPercent: Math.max(1 - totalPaidPercent, 0),
  }
}
