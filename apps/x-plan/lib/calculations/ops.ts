import { addDays, differenceInCalendarDays } from 'date-fns'
import { coerceNumber, coercePercent, parseNumber, parsePercent, roundWeeks } from '@/lib/utils/numbers'
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
  plannedDefaultDate: Date | null
  actualPercent?: number | null
  actualAmount?: number | null
  actualDate?: Date | null
}

export interface PurchaseOrderBatchDerived {
  batchCode?: string | null
  productId: string
  quantity: number
  sellingPrice: number
  manufacturingCost: number
  freightCost: number
  tariffRate: number
  tacosPercent: number
  fbaFee: number
  amazonReferralRate: number
  storagePerMonth: number
  landedUnitCost: number
}

export interface PurchaseOrderDerived {
  id: string
  orderCode: string
  productId: string
  quantity: number
  batches: PurchaseOrderBatchDerived[]
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
  // Per-unit costs (weighted average from batches)
  sellingPrice: number
  manufacturingCost: number
  freightCost: number
  tariffRate: number
  tacosPercent: number
  fbaFee: number
  amazonReferralRate: number
  storagePerMonth: number
  landedUnitCost: number
  // Totals
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

const DEFAULT_MANUFACTURING_SPLIT: [number, number, number] = [0.5, 0.3, 0.2]
const DEFAULT_MANUFACTURING_LABELS = ['MFG Deposit (50%)', 'MFG Production (30%)', 'MFG Final (20%)'] as const

function normalizeSupplierPaymentSplit(
  split: readonly number[] | undefined,
  fallback: [number, number, number]
): [number, number, number] {
  if (!split || split.length === 0) {
    return fallback
  }

  const sanitized = split.slice(0, 3).map((value) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
  })

  while (sanitized.length < 3) {
    sanitized.push(0)
  }

  const total = sanitized.reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    return fallback
  }

  return sanitized.map((value) => (value > 0 ? value / total : 0)) as [number, number, number]
}

function resolveOverride(base: number, override?: number | null): number {
  const numeric = parseNumber(override)
  return numeric ?? base
}

function normalizePercentValue(value: number | null | undefined): number | null {
  return parsePercent(value)
}

function resolveStageWeeks(stageValue: number | null | undefined, fallback: number): number {
  return roundWeeks(stageValue, fallback)
}

function normalizePaymentIndex(index: number | null | undefined): number {
  if (index == null) return 1
  const numeric = Number(index)
  if (!Number.isFinite(numeric)) return 1
  return Math.max(1, Math.round(numeric))
}

function optionalNumber(value: number | null | undefined): number | null {
  return parseNumber(value)
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
  const productionComplete =
    order.productionComplete ??
    (productionStart ? addStageDuration(productionStart, productionWeeks) : null)

  const sourceBase = productionComplete ?? productionStart
  const sourceDeparture =
    order.sourceDeparture ??
    (sourceBase ? addStageDuration(sourceBase, sourceWeeks) : null)

  const oceanBase = sourceDeparture ?? sourceBase
  const portEta =
    order.portEta ??
    (oceanBase ? addStageDuration(oceanBase, oceanWeeks) : null)

  const inboundEta = order.inboundEta ?? portEta

  const finalBase = portEta ?? inboundEta ?? oceanBase
  const availableDate =
    order.availableDate ??
    (finalBase ? addStageDuration(finalBase, finalWeeks) : null)

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
  stageProfile: LeadTimeProfile
): Date | null {
  // Payment 1: at PO/production start date (50%)
  // Payment 2: at production end date (30%)
  // Payment 3: at arrival/inbound ETA (20%)
  if (index === 1) {
    return baseDates.productionStart
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
          quantity: coerceNumber(order.quantity),
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

  const derivedBatches: PurchaseOrderBatchDerived[] = []

  const orderManufacturingOverride = parseNumber(order.overrideManufacturingCost)
  const orderFreightOverride = parseNumber(order.overrideFreightCost)
  const orderTariffOverride = parsePercent(order.overrideTariffRate)

  let totalQuantity = 0
  let totalSellingPrice = 0
  let totalManufacturingCost = 0
  let totalFreightCost = 0
  let totalTacosPercent = 0
  let totalFbaFee = 0
  let totalReferralRate = 0
  let totalStoragePerMonth = 0
  let totalTariffCost = 0
  let totalAdvertisingCost = 0
  let totalLandedCost = 0

  for (const batch of batches) {
    const quantity = Math.max(0, coerceNumber(batch.quantity))
    if (quantity === 0) continue
    const product = productIndex.get(batch.productId)
    if (!product) continue

    const sellingPrice = resolveOverride(product.sellingPrice, batch.overrideSellingPrice ?? order.overrideSellingPrice)
    const manufacturingUnitCost = resolveOverride(
      product.manufacturingCost,
      batch.overrideManufacturingCost ?? orderManufacturingOverride ?? null,
    )
    const freightUnitCost = resolveOverride(
      product.freightCost,
      batch.overrideFreightCost ?? orderFreightOverride ?? null,
    )
    const tariffRateInput = resolveOverride(
      product.tariffRate,
      parsePercent(batch.overrideTariffRate ?? orderTariffOverride ?? null),
    )
    const tariffCostOverride = parseNumber(batch.overrideTariffCost)
    const tariffUnitCost = tariffCostOverride ?? manufacturingUnitCost * tariffRateInput
    const effectiveTariffRate =
      manufacturingUnitCost > 0 ? tariffUnitCost / manufacturingUnitCost : tariffRateInput
    const batchManufacturingTotal = manufacturingUnitCost * quantity
    const batchFreightTotal = freightUnitCost * quantity
    const batchTariffTotal = tariffUnitCost * quantity
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

    const advertisingCost = sellingPrice * tacosPercent
    const landedUnitCost = (batchManufacturingTotal + batchFreightTotal + batchTariffTotal) / Math.max(quantity, 1)

    derivedBatches.push({
      batchCode: batch.batchCode,
      productId: batch.productId,
      quantity,
      sellingPrice,
      manufacturingCost: manufacturingUnitCost,
      freightCost: freightUnitCost,
      tariffRate: effectiveTariffRate,
      tacosPercent,
      fbaFee,
      amazonReferralRate: referralRate,
      storagePerMonth,
      landedUnitCost,
    })

    totalQuantity += quantity
    totalSellingPrice += sellingPrice * quantity
    totalManufacturingCost += batchManufacturingTotal
    totalFreightCost += batchFreightTotal
    totalTacosPercent += tacosPercent * quantity
    totalFbaFee += fbaFee * quantity
    totalReferralRate += referralRate * quantity
    totalStoragePerMonth += storagePerMonth * quantity
    totalTariffCost += batchTariffTotal
    totalAdvertisingCost += advertisingCost * quantity
    totalLandedCost += landedUnitCost * quantity
  }

  const fallbackQuantity = Math.max(0, coerceNumber(order.quantity))
  const quantity = totalQuantity > 0 ? totalQuantity : fallbackQuantity
  const divisor = totalQuantity > 0 ? totalQuantity : quantity || 1

  const sellingPrice = divisor > 0 ? totalSellingPrice / divisor : 0
  const manufacturingCost = divisor > 0 ? totalManufacturingCost / divisor : 0
  const freightCost = divisor > 0 ? totalFreightCost / divisor : 0
  const tariffRate = totalManufacturingCost > 0 ? totalTariffCost / totalManufacturingCost : 0
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

  const manufacturingFractions = normalizeSupplierPaymentSplit(
    params.supplierPaymentSplit,
    DEFAULT_MANUFACTURING_SPLIT
  )
  const manufacturingAmounts = manufacturingFractions.map((fraction) => manufacturingTotal * fraction)
  const manufacturingLabels: readonly string[] = DEFAULT_MANUFACTURING_LABELS

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
      label: manufacturingLabels[0],
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
      label: manufacturingLabels[1],
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
      defaultDate: portDate ?? inboundEta ?? availableDate ?? freightDate ?? productionDate ?? depositDate ?? createdAt,
    },
    {
      index: 4,
      category: 'MANUFACTURING',
      label: manufacturingLabels[2],
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
    const expectedOverride = actualPayment ? optionalNumber(actualPayment.amountExpected) : null
    const paidAmount = actualPayment ? optionalNumber(actualPayment.amountPaid) : null
    const actualPercent =
      normalizePercentValue(actualPayment?.percentage) ??
      (paidAmount != null && supplierDenominator > 0 ? paidAmount / supplierDenominator : null)
    const dueDateSource = actualPayment?.dueDateSource ?? 'SYSTEM'
    const overrideDate =
      dueDateSource === 'USER' && actualPayment?.dueDate ? actualPayment.dueDate : null

    let plannedAmount = baseAmount
    if (amountOverride != null) {
      plannedAmount = amountOverride
    } else if (expectedOverride != null) {
      plannedAmount = expectedOverride
    } else if (percentOverride != null && supplierDenominator > 0) {
      plannedAmount = percentOverride * supplierDenominator
    }

    const plannedPercent = (() => {
      if (percentOverride != null) return percentOverride
      if (supplierDenominator > 0 && plannedAmount > 0) return plannedAmount / supplierDenominator
      return defaultPercent
    })()

    const plannedDefaultDate = dateOverride ?? defaultDate ?? createdAt
    const plannedDate = overrideDate ?? plannedDefaultDate
    const actualDate = overrideDate

    if (plannedAmount <= 0 && paidAmount == null) {
      continue
    }

    payments.push({
      paymentIndex: index,
      category,
      label,
      plannedPercent,
      plannedAmount,
      plannedDate,
      plannedDefaultDate,
      actualAmount: paidAmount,
      actualPercent,
      actualDate: actualDate ?? plannedDate,
    })
  }

  const totalPaidAmount = payments.reduce((sum, payment) => {
    const amount = coerceNumber(payment.actualAmount)
    return sum + amount
  }, 0)
  const percentDenominator = supplierDenominator > 0 ? supplierDenominator : poValue > 0 ? poValue : 1
  const totalPaidPercent = percentDenominator > 0 ? totalPaidAmount / percentDenominator : 0

  return {
    id: order.id,
    orderCode: order.orderCode,
    productId: order.productId,
    quantity,
    batches: derivedBatches,
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
    // Per-unit costs (weighted average from batches)
    sellingPrice,
    manufacturingCost,
    freightCost,
    tariffRate,
    tacosPercent,
    fbaFee,
    amazonReferralRate: referralRate,
    storagePerMonth,
    landedUnitCost,
    // Totals
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
