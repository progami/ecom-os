import { addDays, differenceInCalendarDays } from 'date-fns'
import {
  BusinessParameterMap,
  LeadTimeProfile,
  PurchaseOrderInput,
  PurchaseOrderPaymentInput,
  PurchaseOrderStatus,
} from './types'
import { ProductCostSummary } from './product'

export type PaymentCategory = 'MANUFACTURING' | 'FREIGHT' | 'TARIFF' | 'OTHER'

export interface PaymentPlanItem {
  paymentIndex: number
  category: PaymentCategory
  label: string
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
  shipName?: string | null
  containerNumber?: string | null
  createdAt?: Date | null
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
  manufacturingCostTotal: number
  freightCostTotal: number
  tariffCostTotal: number
  supplierCostTotal: number
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

function resolveStageWeeks(stageValue: number | null | undefined, fallback: number): number {
  const numeric = toNumber(stageValue)
  return numeric > 0 ? numeric : fallback
}

function normalizePaymentIndex(index: number | null | undefined): number {
  if (index == null) return 1
  const numeric = Number(index)
  if (!Number.isFinite(numeric)) return 1
  return Math.max(1, Math.round(numeric))
}

function optionalNumber(value: number | null | undefined): number | null {
  if (value == null) return null
  if (Number.isNaN(value)) return null
  const numeric = Number(value)
  return Number.isNaN(numeric) ? null : numeric
}

function findPayment(
  payments: PurchaseOrderPaymentInput[] | undefined,
  index: number
): PurchaseOrderPaymentInput | undefined {
  if (!payments || payments.length === 0) return undefined
  return payments.find((payment) => normalizePaymentIndex(payment.paymentIndex) === index)
}

function inferProductionStart(order: PurchaseOrderInput): Date | null {
  if (order.poDate) return order.poDate
  if (order.productionStart) return order.productionStart
  return null
}

function addStageDuration(start: Date, weeks: number): Date {
  const days = Math.max(0, Math.round(weeks * 7))
  if (days === 0) return start
  return addDays(start, days)
}

function buildStageSchedule(
  order: PurchaseOrderInput,
  stageProfile: LeadTimeProfile,
  createdAt: Date
) {
  const productionWeeks = resolveStageWeeks(order.productionWeeks, stageProfile.productionWeeks)
  const sourceWeeks = resolveStageWeeks(order.sourceWeeks, stageProfile.sourceWeeks)
  const oceanWeeks = resolveStageWeeks(order.oceanWeeks, stageProfile.oceanWeeks)
  const finalWeeks = resolveStageWeeks(order.finalWeeks, stageProfile.finalWeeks)

  const productionStart = inferProductionStart(order) ?? createdAt
  const productionComplete = addStageDuration(productionStart, productionWeeks)

  const sourceDeparture = addStageDuration(productionComplete, sourceWeeks)
  const portEta = addStageDuration(sourceDeparture, oceanWeeks)
  const inboundEta = portEta
  const availableDate = addStageDuration(portEta, finalWeeks)

  return {
    productionWeeks,
    sourceWeeks,
    oceanWeeks,
    finalWeeks,
    productionStart,
    productionComplete,
    sourceDeparture,
    portEta,
    inboundEta,
    availableDate,
  }
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
    if (baseDates.productionStart) return addStageDuration(baseDates.productionStart, stageProfile.productionWeeks)
    return null
  }
  // index === 3
  if (baseDates.inboundEta) return baseDates.inboundEta
  return null
}

export function computePurchaseOrderDerived(
  order: PurchaseOrderInput,
  productIndex: Map<string, ProductCostSummary>,
  stageProfile: LeadTimeProfile,
  params: BusinessParameterMap
): PurchaseOrderDerived {
  const batches = Array.isArray(order.batchTableRows) && order.batchTableRows.length > 0
    ? order.batchTableRows
    : [
        {
          id: order.id,
          purchaseOrderId: order.id,
          batchCode: order.orderCode,
          productId: order.productId,
          quantity: toNumber(order.quantity),
          overrideSellingPrice: order.overrideSellingPrice,
          overrideManufacturingCost: order.overrideManufacturingCost,
          overrideFreightCost: order.overrideFreightCost,
          overrideTariffRate: order.overrideTariffRate,
          overrideTacosPercent: order.overrideTacosPercent,
          overrideFbaFee: order.overrideFbaFee,
          overrideReferralRate: order.overrideReferralRate,
          overrideStoragePerMonth: order.overrideStoragePerMonth,
        },
      ]

  let totalQuantity = 0
  let totalSellingPrice = 0
  let totalManufacturingCost = 0
  let totalFreightCost = 0
  let totalTariffRate = 0
  let totalTacosPercent = 0
  let totalFbaFee = 0
  let totalReferralRate = 0
  let totalStoragePerMonth = 0
  let totalTariffCost = 0
  let totalAdvertisingCost = 0
  let totalLandedCost = 0

  for (const batch of batches) {
    const quantity = Math.max(0, toNumber(batch.quantity))
    if (quantity === 0) continue
    const product = productIndex.get(batch.productId)
    if (!product) continue

    const sellingPrice = resolveOverride(product.sellingPrice, batch.overrideSellingPrice ?? order.overrideSellingPrice)
    const manufacturingCost = resolveOverride(
      product.manufacturingCost,
      batch.overrideManufacturingCost ?? order.overrideManufacturingCost
    )
    const freightCost = resolveOverride(product.freightCost, batch.overrideFreightCost ?? order.overrideFreightCost)
    const tariffRate = resolveOverride(product.tariffRate, batch.overrideTariffRate ?? order.overrideTariffRate)
    const tacosPercent = resolveOverride(product.tacosPercent, batch.overrideTacosPercent ?? order.overrideTacosPercent)
    const fbaFee = resolveOverride(product.fbaFee, batch.overrideFbaFee ?? order.overrideFbaFee)
    const referralRate = resolveOverride(
      product.amazonReferralRate,
      batch.overrideReferralRate ?? order.overrideReferralRate
    )
    const storagePerMonth = resolveOverride(
      product.storagePerMonth,
      batch.overrideStoragePerMonth ?? order.overrideStoragePerMonth
    )

    const tariffCost = manufacturingCost * tariffRate
    const advertisingCost = sellingPrice * tacosPercent
    const landedUnitCost = manufacturingCost + freightCost + tariffCost + fbaFee + storagePerMonth

    totalQuantity += quantity
    totalSellingPrice += sellingPrice * quantity
    totalManufacturingCost += manufacturingCost * quantity
    totalFreightCost += freightCost * quantity
    totalTariffRate += tariffRate * quantity
    totalTacosPercent += tacosPercent * quantity
    totalFbaFee += fbaFee * quantity
    totalReferralRate += referralRate * quantity
    totalStoragePerMonth += storagePerMonth * quantity
    totalTariffCost += tariffCost * quantity
    totalAdvertisingCost += advertisingCost * quantity
    totalLandedCost += landedUnitCost * quantity
  }

  const fallbackQuantity = Math.max(0, toNumber(order.quantity))
  const quantity = totalQuantity > 0 ? totalQuantity : fallbackQuantity
  const divisor = totalQuantity > 0 ? totalQuantity : quantity || 1

  const sellingPrice = divisor > 0 ? totalSellingPrice / divisor : 0
  const manufacturingCost = divisor > 0 ? totalManufacturingCost / divisor : 0
  const freightCost = divisor > 0 ? totalFreightCost / divisor : 0
  const tariffRate = divisor > 0 ? totalTariffRate / divisor : 0
  const tacosPercent = divisor > 0 ? totalTacosPercent / divisor : 0
  const fbaFee = divisor > 0 ? totalFbaFee / divisor : 0
  const referralRate = divisor > 0 ? totalReferralRate / divisor : 0
  const storagePerMonth = divisor > 0 ? totalStoragePerMonth / divisor : 0
  const tariffCost = divisor > 0 ? totalTariffCost / divisor : 0
  const advertisingCost = divisor > 0 ? totalAdvertisingCost / divisor : 0
  const landedUnitCost = divisor > 0 ? totalLandedCost / divisor : 0
  const createdAt = order.createdAt ?? new Date()
  const schedule = buildStageSchedule(order, stageProfile, createdAt)

  const resolvedProfile: LeadTimeProfile = {
    productionWeeks: schedule.productionWeeks,
    sourceWeeks: schedule.sourceWeeks,
    oceanWeeks: schedule.oceanWeeks,
    finalWeeks: schedule.finalWeeks,
  }

  const {
    productionStart,
    productionComplete,
    sourceDeparture,
    portEta,
    inboundEta,
    availableDate,
  } = schedule

  const totalLeadDays = Math.round(
    (schedule.productionWeeks + schedule.sourceWeeks + schedule.oceanWeeks + schedule.finalWeeks) * 7
  )
  const weeksUntilArrival = computeWeeksUntil(availableDate)

  const poValue = landedUnitCost * quantity

  const payments: PaymentPlanItem[] = []

  const manufacturingTotal = totalManufacturingCost > 0 ? totalManufacturingCost : manufacturingCost * quantity
  const freightTotal = totalFreightCost > 0 ? totalFreightCost : freightCost * quantity
  const tariffTotal = totalTariffCost > 0 ? totalTariffCost : tariffCost * quantity
  const supplierCostTotal = manufacturingTotal + freightTotal + tariffTotal
  const supplierDenominator = supplierCostTotal > 0 ? supplierCostTotal : Math.max(poValue, 0)

  const depositDate = order.poDate ?? productionStart ?? createdAt
  const productionDate = productionComplete ?? (depositDate ? addStageDuration(depositDate, schedule.productionWeeks) : depositDate)
  const freightDate = sourceDeparture ?? (productionDate ? addStageDuration(productionDate, schedule.sourceWeeks) : productionDate)
  const portDate = portEta ?? (freightDate ? addStageDuration(freightDate, schedule.oceanWeeks) : freightDate)

  const manufacturingFractions: [number, number, number] = [0.25, 0.25, 0.5]
  const manufacturingAmounts = manufacturingFractions.map((fraction) => manufacturingTotal * fraction)

  const paymentDefinitions: Array<{
    index: number
    category: PaymentCategory
    label: string
    baseAmount: number
    defaultPercent: number
    defaultDate: Date | null
    percentField?: (typeof PAY_PERCENT_FIELDS)[number]
    amountField?: (typeof PAY_AMOUNT_FIELDS)[number]
    dateField?: (typeof PAY_DATE_FIELDS)[number]
  }> = [
    {
      index: 1,
      category: 'MANUFACTURING',
      label: 'MFG Deposit (25%)',
      baseAmount: manufacturingAmounts[0] ?? 0,
      defaultPercent: supplierDenominator > 0 ? (manufacturingAmounts[0] ?? 0) / supplierDenominator : 0,
      defaultDate: depositDate ?? createdAt,
      percentField: PAY_PERCENT_FIELDS[0],
      amountField: PAY_AMOUNT_FIELDS[0],
      dateField: PAY_DATE_FIELDS[0],
    },
    {
      index: 2,
      category: 'MANUFACTURING',
      label: 'MFG Production (25%)',
      baseAmount: manufacturingAmounts[1] ?? 0,
      defaultPercent: supplierDenominator > 0 ? (manufacturingAmounts[1] ?? 0) / supplierDenominator : 0,
      defaultDate: productionDate ?? depositDate ?? createdAt,
      percentField: PAY_PERCENT_FIELDS[1],
      amountField: PAY_AMOUNT_FIELDS[1],
      dateField: PAY_DATE_FIELDS[1],
    },
    {
      index: 3,
      category: 'FREIGHT',
      label: 'Freight (100%)',
      baseAmount: freightTotal,
      defaultPercent: supplierDenominator > 0 ? freightTotal / supplierDenominator : 0,
      defaultDate: freightDate ?? productionDate ?? depositDate ?? createdAt,
    },
    {
      index: 4,
      category: 'MANUFACTURING',
      label: 'MFG Final (50%)',
      baseAmount: manufacturingAmounts[2] ?? 0,
      defaultPercent: supplierDenominator > 0 ? (manufacturingAmounts[2] ?? 0) / supplierDenominator : 0,
      defaultDate: portDate ?? inboundEta ?? availableDate ?? freightDate ?? productionDate ?? depositDate ?? createdAt,
      percentField: PAY_PERCENT_FIELDS[2],
      amountField: PAY_AMOUNT_FIELDS[2],
      dateField: PAY_DATE_FIELDS[2],
    },
    {
      index: 5,
      category: 'TARIFF',
      label: 'Tariff (100%)',
      baseAmount: tariffTotal,
      defaultPercent: supplierDenominator > 0 ? tariffTotal / supplierDenominator : 0,
      defaultDate: portDate ?? inboundEta ?? availableDate ?? freightDate ?? productionDate ?? depositDate ?? createdAt,
    },
  ]

  for (const definition of paymentDefinitions) {
    const { index, category, label, baseAmount, defaultPercent, defaultDate, percentField, amountField, dateField } = definition

    const percentOverride = percentField ? normalizePercentValue(order[percentField]) : null
    const amountOverride = amountField ? optionalNumber(order[amountField]) : null
    const dateOverride = dateField ? order[dateField] ?? null : null

    const actualPayment = findPayment(order.payments, index)
    const actualAmount = optionalNumber(actualPayment?.amount)
    const actualPercent =
      normalizePercentValue(actualPayment?.percentage) ??
      (actualAmount != null && supplierDenominator > 0 ? actualAmount / supplierDenominator : null)
    const actualDate = actualPayment?.dueDate ?? null

    let plannedAmount = baseAmount
    if (amountOverride != null) {
      plannedAmount = amountOverride
    } else if (percentOverride != null && supplierDenominator > 0) {
      plannedAmount = percentOverride * supplierDenominator
    }

    const plannedPercent = (() => {
      if (percentOverride != null) return percentOverride
      if (supplierDenominator > 0 && plannedAmount > 0) return plannedAmount / supplierDenominator
      return defaultPercent
    })()

    const plannedDate = dateOverride ?? defaultDate ?? createdAt

    if (plannedAmount <= 0 && actualAmount == null) {
      continue
    }

    payments.push({
      paymentIndex: index,
      category,
      label,
      plannedPercent,
      plannedAmount,
      plannedDate,
      actualAmount,
      actualPercent,
      actualDate: actualDate ?? plannedDate,
      status: actualPayment?.status ?? null,
    })
  }

  const totalPaidAmount = payments.reduce((sum, payment) => {
    const amount = toNumber(payment.actualAmount)
    return sum + amount
  }, 0)
  const percentDenominator = supplierDenominator > 0 ? supplierDenominator : poValue > 0 ? poValue : 1
  const totalPaidPercent = percentDenominator > 0 ? totalPaidAmount / percentDenominator : 0

  return {
    id: order.id,
    orderCode: order.orderCode,
    productId: order.productId,
    quantity,
    status: order.status,
    statusIcon: order.statusIcon ?? STATUS_ICON_MAP[order.status],
    notes: order.notes ?? null,
    shipName: order.shipName ?? null,
    containerNumber: order.containerNumber ?? order.transportReference ?? null,
    createdAt,
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
    manufacturingCostTotal: manufacturingTotal,
    freightCostTotal: freightTotal,
    tariffCostTotal: tariffTotal,
    supplierCostTotal,
    plannedPoValue: poValue,
    plannedPayments: payments,
    payments: order.payments ?? [],
    paidAmount: totalPaidAmount,
    paidPercent: totalPaidPercent,
    remainingAmount: Math.max(percentDenominator - totalPaidAmount, 0),
    remainingPercent: Math.max(1 - totalPaidPercent, 0),
  }
}
