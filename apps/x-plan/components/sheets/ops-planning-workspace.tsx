'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  OpsPlanningGrid,
  type OpsInputRow,
} from '@/components/sheets/ops-planning-grid'
import { PurchaseTimeline } from '@/components/sheets/purchase-timeline'
import type { OpsTimelineRow } from '@/components/sheets/ops-planning-timeline'
import { OpsPlanningCostGrid, type OpsBatchRow } from '@/components/sheets/ops-planning-cost-grid'
import {
  PurchasePaymentsGrid,
  type PurchasePaymentRow,
  type PaymentSummary,
} from '@/components/sheets/purchase-payments-grid'
import { createTimelineOrderFromDerived, type PurchaseTimelineOrder } from '@/lib/planning/timeline'
import { getISOWeek } from 'date-fns'
import {
  buildProductCostIndex,
  computePurchaseOrderDerived,
  type BusinessParameterMap,
  type ProductCostSummary,
  type ProductInput,
  type PurchaseOrderInput,
  type BatchTableRowInput,
  type PurchaseOrderPaymentInput,
  type PurchaseOrderStatus,
  type LeadTimeProfile,
} from '@/lib/calculations'
import { formatNumericInput, formatPercentInput, parseNumericInput } from '@/components/sheets/validators'

const BATCH_NUMERIC_PRECISION = {
  quantity: 0,
  sellingPrice: 2,
  manufacturingCost: 2,
  freightCost: 2,
  fbaFee: 2,
  storagePerMonth: 2,
} as const

const BATCH_PERCENT_PRECISION = {
  tariffRate: 4,
  tacosPercent: 4,
  referralRate: 4,
} as const

export type PurchaseOrderSerialized = {
  id: string
  orderCode: string
  productId: string
  quantity: number
  poDate?: string | null
  productionWeeks?: number | null
  sourceWeeks?: number | null
  oceanWeeks?: number | null
  finalWeeks?: number | null
  pay1Percent?: number | null
  pay2Percent?: number | null
  pay3Percent?: number | null
  pay1Amount?: number | null
  pay2Amount?: number | null
  pay3Amount?: number | null
  pay1Date?: string | null
  pay2Date?: string | null
  pay3Date?: string | null
  productionStart?: string | null
  productionComplete?: string | null
  sourceDeparture?: string | null
  transportReference?: string | null
  shipName?: string | null
  containerNumber?: string | null
  portEta?: string | null
  inboundEta?: string | null
  availableDate?: string | null
  totalLeadDays?: number | null
  status: PurchaseOrderStatus
  notes?: string | null
  createdAt?: string | null
  payments?: Array<{
    paymentIndex: number
    percentage?: number | null
    amount?: number | null
    amountExpected?: number | null
    amountPaid?: number | null
    dueDate?: string | null
    dueDateDefault?: string | null
    dueDateSource?: 'SYSTEM' | 'USER'
    category?: string | null
    label?: string | null
    status?: string | null
  }>
  overrideSellingPrice?: number | null
  overrideManufacturingCost?: number | null
  overrideFreightCost?: number | null
  overrideTariffRate?: number | null
  overrideTacosPercent?: number | null
  overrideFbaFee?: number | null
  overrideReferralRate?: number | null
  overrideStoragePerMonth?: number | null
  batchTableRows?: Array<{
    id: string
    batchCode?: string | null
    productId: string
    quantity: number
    overrideSellingPrice?: number | null
    overrideManufacturingCost?: number | null
    overrideFreightCost?: number | null
    overrideTariffRate?: number | null
    overrideTacosPercent?: number | null
    overrideFbaFee?: number | null
    overrideReferralRate?: number | null
    overrideStoragePerMonth?: number | null
  }>
}

export type OpsPlanningCalculatorPayload = {
  parameters: BusinessParameterMap
  products: ProductInput[]
  leadProfiles: Array<LeadTimeProfile & { productId: string }>
  purchaseOrders: PurchaseOrderSerialized[]
}

interface OpsPlanningWorkspaceProps {
  poTableRows: OpsInputRow[]
  batchTableRows: OpsBatchRow[]
  timeline: OpsTimelineRow[]
  timelineOrders: PurchaseTimelineOrder[]
  payments: PurchasePaymentRow[]
  calculator: OpsPlanningCalculatorPayload
  timelineMonths: { start: string; end: string; label: string }[]
  mode?: 'tabular' | 'visual'
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

const DEFAULT_PROFILE: LeadTimeProfile = {
  productionWeeks: 0,
  sourceWeeks: 0,
  oceanWeeks: 0,
  finalWeeks: 0,
}

function coerceToLocalDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function toIsoDateString(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(`${iso}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return ''
  return dateFormatter.format(date).replace(',', '')
}

function deriveIsoWeek(iso: string | null | undefined): string {
  if (!iso) return ''
  const [yearStr, monthStr, dayStr] = iso.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  const dayNumber = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return String(week)
}

function formatDisplayDate(value?: string | Date | null) {
  const date = coerceToLocalDate(value)
  if (!date) return ''
  return dateFormatter.format(date).replace(',', '')
}

function normalizePercent(value: string | number | null | undefined) {
  return formatPercentInput(value, 4)
}

const DEFAULT_PAYMENT_LABELS: Record<number, string> = {
  1: 'Manufacturing Deposit (25%)',
  2: 'Manufacturing Production (25%)',
  3: 'Freight (100%)',
  4: 'Manufacturing Final (50%)',
  5: 'Tariff (100%)',
}

function resolvePaymentLabel(category: string | undefined, label: string | undefined, paymentIndex: number): string {
  const trimmedLabel = label?.trim()
  if (trimmedLabel) return trimmedLabel

  const normalizedCategory = category?.trim().toLowerCase()
  if (normalizedCategory === 'manufacturing') {
    return DEFAULT_PAYMENT_LABELS[paymentIndex] ?? 'Manufacturing'
  }
  if (normalizedCategory === 'freight') return DEFAULT_PAYMENT_LABELS[3]
  if (normalizedCategory === 'tariff') return DEFAULT_PAYMENT_LABELS[5]
  if (normalizedCategory) return category!.trim()

  return DEFAULT_PAYMENT_LABELS[paymentIndex] ?? `Payment ${paymentIndex}`
}

function normalizePaymentRows(rows: PurchasePaymentRow[]): PurchasePaymentRow[] {
  return rows.map((payment) => {
    const dueDateIso = toIsoDateString(payment.dueDateIso ?? payment.dueDate)
    const dueDateDefaultIso = toIsoDateString(payment.dueDateDefaultIso ?? payment.dueDateDefault)
    const week = deriveIsoWeek(dueDateIso) ?? payment.weekNumber ?? ''
    return {
      ...payment,
      label: resolvePaymentLabel(payment.category, payment.label, payment.paymentIndex),
      dueDate: formatIsoDate(dueDateIso),
      dueDateIso,
      dueDateDefault: formatIsoDate(dueDateDefaultIso),
      dueDateDefaultIso,
      dueDateSource: payment.dueDateSource ?? 'SYSTEM',
      percentage: normalizePercent(payment.percentage),
      weekNumber: week,
      amountExpected: formatNumericInput(payment.amountExpected, 2),
      amountPaid: formatNumericInput(payment.amountPaid, 2),
    }
  })
}

function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    if (value.trim() === '') return null
    return parseNumericInput(value)
  }
  return parseNumericInput(value)
}

function parseNumber(value: string | number | null | undefined): number | null {
  return toNumber(value)
}

function parseInteger(value: string | number | null | undefined, fallback: number): number {
  const numeric = toNumber(value)
  return numeric == null ? fallback : Math.round(numeric)
}

function parsePercent(value: string | number | null | undefined): number | null {
  const numeric = toNumber(value)
  if (numeric == null) return null
  return numeric > 1 ? numeric / 100 : numeric
}

function normalizeStageWeeks(value: number | null | undefined): number {
  if (value == null) return 1
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 1
  return numeric
}

function deserializeOrders(purchaseOrders: PurchaseOrderSerialized[]): PurchaseOrderInput[] {
  return purchaseOrders.map((order) => ({
    id: order.id,
    orderCode: order.orderCode,
    productId: order.productId,
    quantity: order.quantity,
    poDate: parseDateValue(order.poDate),
    productionWeeks: normalizeStageWeeks(order.productionWeeks ?? null),
    sourceWeeks: normalizeStageWeeks(order.sourceWeeks ?? null),
    oceanWeeks: normalizeStageWeeks(order.oceanWeeks ?? null),
    finalWeeks: normalizeStageWeeks(order.finalWeeks ?? null),
    pay1Percent: order.pay1Percent ?? null,
    pay2Percent: order.pay2Percent ?? null,
    pay3Percent: order.pay3Percent ?? null,
    pay1Amount: order.pay1Amount ?? null,
    pay2Amount: order.pay2Amount ?? null,
    pay3Amount: order.pay3Amount ?? null,
    pay1Date: parseDateValue(order.pay1Date),
    pay2Date: parseDateValue(order.pay2Date),
    pay3Date: parseDateValue(order.pay3Date),
    productionStart: parseDateValue(order.productionStart),
    productionComplete: parseDateValue(order.productionComplete),
    sourceDeparture: parseDateValue(order.sourceDeparture),
    transportReference: order.transportReference ?? null,
    shipName: order.shipName ?? null,
    containerNumber: order.containerNumber ?? order.transportReference ?? null,
    createdAt: parseDateValue(order.createdAt),
    portEta: parseDateValue(order.portEta),
    inboundEta: parseDateValue(order.inboundEta),
    availableDate: parseDateValue(order.availableDate),
    totalLeadDays: order.totalLeadDays ?? null,
    status: order.status,
    notes: order.notes ?? null,
    payments:
      order.payments?.map((payment): PurchaseOrderPaymentInput => ({
        paymentIndex: payment.paymentIndex,
        percentage: payment.percentage ?? null,
        amountExpected:
          payment.amountExpected ?? (payment.amount != null ? payment.amount : null),
        amountPaid: payment.amountPaid ?? null,
        dueDate: parseDateValue(payment.dueDate ?? null),
        dueDateDefault: parseDateValue(payment.dueDateDefault ?? null),
        dueDateSource: payment.dueDateSource ?? 'SYSTEM',
      })) ?? [],
    overrideSellingPrice: order.overrideSellingPrice ?? null,
    overrideManufacturingCost: order.overrideManufacturingCost ?? null,
    overrideFreightCost: order.overrideFreightCost ?? null,
    overrideTariffRate: order.overrideTariffRate ?? null,
    overrideTacosPercent: order.overrideTacosPercent ?? null,
    overrideFbaFee: order.overrideFbaFee ?? null,
    overrideReferralRate: order.overrideReferralRate ?? null,
    overrideStoragePerMonth: order.overrideStoragePerMonth ?? null,
    batchTableRows:
      order.batchTableRows?.map((batch) => ({
        id: batch.id,
        purchaseOrderId: order.id,
        batchCode: batch.batchCode ?? undefined,
        productId: batch.productId,
        quantity: batch.quantity,
        overrideSellingPrice: batch.overrideSellingPrice ?? null,
        overrideManufacturingCost: batch.overrideManufacturingCost ?? null,
        overrideFreightCost: batch.overrideFreightCost ?? null,
        overrideTariffRate: batch.overrideTariffRate ?? null,
        overrideTacosPercent: batch.overrideTacosPercent ?? null,
        overrideFbaFee: batch.overrideFbaFee ?? null,
        overrideReferralRate: batch.overrideReferralRate ?? null,
        overrideStoragePerMonth: batch.overrideStoragePerMonth ?? null,
      })) ?? [],
  }))
}

function mergeOrders(existing: PurchaseOrderInput[], rows: OpsInputRow[]): PurchaseOrderInput[] {
  const existingMap = new Map(existing.map((order) => [order.id, order]))
  return rows.map((row) => {
    const base = existingMap.get(row.id)
    if (!base) return {
      id: row.id,
      orderCode: row.orderCode,
      productId: row.productId,
      quantity: parseInteger(row.quantity, 0),
      poDate: parseDateValue(row.poDate),
      productionWeeks: normalizeStageWeeks(parseNumber(row.productionWeeks)),
      sourceWeeks: normalizeStageWeeks(parseNumber(row.sourceWeeks)),
      oceanWeeks: normalizeStageWeeks(parseNumber(row.oceanWeeks)),
      finalWeeks: normalizeStageWeeks(parseNumber(row.finalWeeks)),
      pay1Percent: null,
      pay2Percent: null,
      pay3Percent: null,
      pay1Amount: null,
      pay2Amount: null,
      pay3Amount: null,
      pay1Date: parseDateValue(row.pay1Date),
      pay2Date: null,
      pay3Date: null,
      productionStart: null,
      productionComplete: null,
      sourceDeparture: null,
      transportReference: row.containerNumber ? row.containerNumber : null,
      shipName: row.shipName ? row.shipName : null,
      containerNumber: row.containerNumber ? row.containerNumber : null,
      createdAt: new Date(),
      portEta: null,
      inboundEta: null,
      availableDate: null,
      totalLeadDays: null,
      status: (row.status as PurchaseOrderStatus) ?? 'PLANNED',
      notes: row.notes ? row.notes : null,
      payments: [],
      overrideSellingPrice: parseNumber(row.sellingPrice),
      overrideManufacturingCost: parseNumber(row.manufacturingCost),
      overrideFreightCost: parseNumber(row.freightCost),
      overrideTariffRate: parsePercent(row.tariffRate),
      overrideTacosPercent: parsePercent(row.tacosPercent),
      overrideFbaFee: parseNumber(row.fbaFee),
      overrideReferralRate: parsePercent(row.referralRate),
      overrideStoragePerMonth: parseNumber(row.storagePerMonth),
      batchTableRows: [],
    }

    return {
      ...base,
      orderCode: row.orderCode,
      productId: row.productId,
      quantity: parseInteger(row.quantity, base.quantity ?? 0),
      pay1Date: parseDateValue(row.pay1Date),
      productionWeeks: normalizeStageWeeks(parseNumber(row.productionWeeks)),
      sourceWeeks: normalizeStageWeeks(parseNumber(row.sourceWeeks)),
      oceanWeeks: normalizeStageWeeks(parseNumber(row.oceanWeeks)),
      finalWeeks: normalizeStageWeeks(parseNumber(row.finalWeeks)),
      poDate: parseDateValue(row.poDate),
      transportReference: row.containerNumber
        ? row.containerNumber
        : base.containerNumber ?? base.transportReference ?? null,
      shipName: row.shipName ? row.shipName : base.shipName ?? null,
      containerNumber: row.containerNumber ? row.containerNumber : base.containerNumber ?? base.transportReference ?? null,
      createdAt: base.createdAt ?? new Date(),
      status: (row.status as PurchaseOrderStatus) ?? base.status,
      notes: row.notes ? row.notes : null,
      overrideSellingPrice: parseNumber(row.sellingPrice),
      overrideManufacturingCost: parseNumber(row.manufacturingCost),
      overrideFreightCost: parseNumber(row.freightCost),
      overrideTariffRate: parsePercent(row.tariffRate),
      overrideTacosPercent: parsePercent(row.tacosPercent),
      overrideFbaFee: parseNumber(row.fbaFee),
      overrideReferralRate: parsePercent(row.referralRate),
      overrideStoragePerMonth: parseNumber(row.storagePerMonth),
    }
  })
}

function buildPaymentsByOrder(paymentRows: PurchasePaymentRow[]): Map<string, PurchaseOrderPaymentInput[]> {
  const map = new Map<string, PurchaseOrderPaymentInput[]>()
  for (const payment of paymentRows) {
    const list = map.get(payment.purchaseOrderId) ?? []
    const percentage = null
    const amountExpected = null
    const amountPaid = parseNumericInput(payment.amountPaid) ?? null
    const dueDate = parseDateValue(payment.dueDateIso ?? payment.dueDate)
    const dueDateDefault = parseDateValue(payment.dueDateDefaultIso ?? payment.dueDateDefault)
    list.push({
      paymentIndex: payment.paymentIndex,
      percentage,
      amountExpected,
      amountPaid,
      category: payment.category ?? null,
      label: payment.label ?? null,
      dueDate,
      dueDateDefault,
      dueDateSource: payment.dueDateSource ?? 'SYSTEM',
    })
    map.set(payment.purchaseOrderId, list)
  }
  return map
}

function formatCurrencyValue(value: number): string {
  if (!Number.isFinite(value)) return ''
  return currencyFormatter.format(value)
}

function formatPercentValue(value: number): string {
  if (!Number.isFinite(value)) return ''
  return `${(value * 100).toFixed(1)}%`
}

function buildTimelineRowsFromData(params: {
  orders: PurchaseOrderInput[]
  rows: OpsInputRow[]
  payments: PurchasePaymentRow[]
  productIndex: Map<string, ProductCostSummary>
  leadProfiles: Map<string, LeadTimeProfile>
  parameters: BusinessParameterMap
}): {
  timelineRows: OpsTimelineRow[]
  timelineOrders: PurchaseTimelineOrder[]
  derivedMap: Map<string, ReturnType<typeof computePurchaseOrderDerived>>
} {
  const { orders, rows, payments, productIndex, leadProfiles, parameters } = params
  const ordersById = new Map(orders.map((order) => [order.id, order]))
  const paymentsByOrder = buildPaymentsByOrder(payments)
  const derivedMap = new Map<string, ReturnType<typeof computePurchaseOrderDerived>>()

  const timelineRows = rows.map((row): OpsTimelineRow => {
    const order = ordersById.get(row.id)
    if (!order) {
      return {
        id: row.id,
        orderCode: row.orderCode,
        productName: row.productName,
        landedUnitCost: '',
        poValue: '',
        paidAmount: '',
        paidPercent: '',
        productionStart: '',
        productionComplete: '',
        sourceDeparture: '',
        portEta: '',
        inboundEta: '',
        availableDate: '',
        totalLeadDays: '',
        weeksUntilArrival: '',
      }
    }

    if (!productIndex.has(order.productId)) {
      return {
        id: order.id,
        orderCode: order.orderCode,
        productName: row.productName,
        landedUnitCost: '',
        poValue: '',
        paidAmount: '',
        paidPercent: '',
        productionStart: '',
        productionComplete: '',
        sourceDeparture: '',
        portEta: '',
        inboundEta: '',
        availableDate: '',
        totalLeadDays: '',
        weeksUntilArrival: '',
      }
    }

    const profile = leadProfiles.get(order.productId) ?? DEFAULT_PROFILE
    const paymentsOverride = paymentsByOrder.get(order.id) ?? order.payments ?? []
    const derived = computePurchaseOrderDerived(
      { ...order, payments: paymentsOverride },
      productIndex,
      profile,
      parameters
    )
    derivedMap.set(order.id, derived)

    return {
      id: derived.id,
      orderCode: derived.orderCode,
      productName: row.productName,
      landedUnitCost: formatCurrencyValue(derived.landedUnitCost),
      poValue: formatCurrencyValue(derived.plannedPoValue),
      paidAmount: formatCurrencyValue(derived.paidAmount),
      paidPercent: formatPercentValue(derived.paidPercent),
      productionStart: formatDisplayDate(derived.productionStart),
      productionComplete: formatDisplayDate(derived.productionComplete),
      sourceDeparture: formatDisplayDate(derived.sourceDeparture),
      portEta: formatDisplayDate(derived.portEta),
      inboundEta: formatDisplayDate(derived.inboundEta),
      availableDate: formatDisplayDate(derived.availableDate),
      totalLeadDays: derived.totalLeadDays != null ? String(derived.totalLeadDays) : '',
      weeksUntilArrival: derived.weeksUntilArrival != null ? String(derived.weeksUntilArrival) : '',
    }
  })

  const timelineOrders = rows
    .map((row) => {
      const derived = derivedMap.get(row.id)
      if (!derived) return null
      return createTimelineOrderFromDerived({ derived, productName: row.productName })
    })
    .filter((order): order is PurchaseTimelineOrder => Boolean(order))

  return { timelineRows, timelineOrders, derivedMap }
}

function summaryLineFor(summary: PaymentSummary): string {
  const parts: string[] = []
  parts.push(`Plan ${currencyFormatter.format(summary.plannedAmount)}`)
  if (summary.plannedAmount > 0) {
    const paidPercent = Math.max(summary.actualPercent * 100, 0).toFixed(1)
    parts.push(`Paid ${currencyFormatter.format(summary.actualAmount)} (${paidPercent}%)`)
    if (summary.remainingAmount > 0.01) {
      parts.push(`Remaining ${currencyFormatter.format(summary.remainingAmount)}`)
    } else if (summary.remainingAmount < -0.01) {
      parts.push(`Cleared (+${currencyFormatter.format(Math.abs(summary.remainingAmount))})`)
    } else {
      parts.push('Cleared')
    }
  } else {
    parts.push(`Paid ${currencyFormatter.format(summary.actualAmount)}`)
  }
  return parts.join(' • ')
}

function formatPaymentWeekNumber(date: Date | null | undefined): string {
  if (!date) return ''
  const normalized = coerceToLocalDate(date)
  if (!normalized) return ''
  return String(getISOWeek(normalized))
}

type PaymentUpdatePayload = {
  id: string
  values: Record<string, string | null | undefined>
}

export function OpsPlanningWorkspace({
  poTableRows,
  batchTableRows,
  timeline,
  timelineOrders,
  payments,
  calculator,
  timelineMonths,
  mode = 'tabular',
}: OpsPlanningWorkspaceProps) {
  const isVisualMode = mode === 'visual'
  const router = useRouter()
  const productIndex = useMemo(() => buildProductCostIndex(calculator.products), [calculator.products])
  const productNameIndex = useMemo(() => new Map(calculator.products.map((product) => [product.id, product.name])), [calculator.products])
  const productOptions = useMemo(() => calculator.products.map((product) => ({ id: product.id, name: product.name })), [calculator.products])
  const leadProfileMap = useMemo(() => {
    const map = new Map<string, LeadTimeProfile>()
    for (const profile of calculator.leadProfiles) {
      map.set(profile.productId, {
        productionWeeks: Number(profile.productionWeeks ?? 0),
        sourceWeeks: Number(profile.sourceWeeks ?? 0),
        oceanWeeks: Number(profile.oceanWeeks ?? 0),
        finalWeeks: Number(profile.finalWeeks ?? 0),
      })
    }
    return map
  }, [calculator.leadProfiles])

  const initialOrders = useMemo(() => deserializeOrders(calculator.purchaseOrders), [calculator.purchaseOrders])

  const buildBatchRow = useCallback(
    (order: PurchaseOrderInput, batch: BatchTableRowInput): OpsBatchRow => ({
      id: batch.id,
      purchaseOrderId: order.id,
      orderCode: order.orderCode,
      batchCode: batch.batchCode ?? undefined,
      productId: batch.productId,
      productName: productNameIndex.get(batch.productId) ?? '',
      quantity:
        batch.quantity == null
          ? ''
          : formatNumericInput(batch.quantity, BATCH_NUMERIC_PRECISION.quantity),
      sellingPrice: formatNumericInput(batch.overrideSellingPrice, BATCH_NUMERIC_PRECISION.sellingPrice),
      manufacturingCost: formatNumericInput(
        batch.overrideManufacturingCost,
        BATCH_NUMERIC_PRECISION.manufacturingCost
      ),
      freightCost: formatNumericInput(batch.overrideFreightCost, BATCH_NUMERIC_PRECISION.freightCost),
      tariffRate: formatPercentInput(batch.overrideTariffRate, BATCH_PERCENT_PRECISION.tariffRate),
      tacosPercent: formatPercentInput(batch.overrideTacosPercent, BATCH_PERCENT_PRECISION.tacosPercent),
      fbaFee: formatNumericInput(batch.overrideFbaFee, BATCH_NUMERIC_PRECISION.fbaFee),
      referralRate: formatPercentInput(batch.overrideReferralRate, BATCH_PERCENT_PRECISION.referralRate),
      storagePerMonth: formatNumericInput(
        batch.overrideStoragePerMonth,
        BATCH_NUMERIC_PRECISION.storagePerMonth
      ),
    }),
    [productNameIndex]
  )

  const initialBatchRows = useMemo(() => {
    if (batchTableRows.length > 0) return batchTableRows
    const rows: OpsBatchRow[] = []
    for (const order of initialOrders) {
      for (const batch of order.batchTableRows ?? []) {
        rows.push(buildBatchRow(order, batch))
      }
    }
    return rows
  }, [batchTableRows, initialOrders, buildBatchRow])

  const initialPayments = useMemo(() => normalizePaymentRows(payments), [payments])
  const initialTimelineResult = useMemo(
    () =>
      buildTimelineRowsFromData({
        orders: initialOrders,
        rows: poTableRows,
        payments: initialPayments,
        productIndex,
        leadProfiles: leadProfileMap,
        parameters: calculator.parameters,
      }),
    [initialOrders, poTableRows, initialPayments, productIndex, leadProfileMap, calculator.parameters]
  )

  const [inputRows, setInputRows] = useState<OpsInputRow[]>(poTableRows)
  const [timelineRows, setTimelineRows] = useState<OpsTimelineRow[]>(
    initialTimelineResult.timelineRows.length ? initialTimelineResult.timelineRows : timeline
  )
  const [timelineOrdersState, setTimelineOrdersState] = useState<PurchaseTimelineOrder[]>(
    initialTimelineResult.timelineOrders.length ? initialTimelineResult.timelineOrders : timelineOrders
  )
  const [orders, setOrders] = useState<PurchaseOrderInput[]>(initialOrders)
  const [paymentRows, setPaymentRows] = useState<PurchasePaymentRow[]>(initialPayments)
  const [batchRows, setBatchRows] = useState<OpsBatchRow[]>(initialBatchRows)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(poTableRows[0]?.id ?? null)
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null)
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false)
  const [newOrderCode, setNewOrderCode] = useState('')
  const [isAddingPayment, setIsAddingPayment] = useState(false)
  const [isPending, startTransition] = useTransition()

  const inputRowsRef = useRef(inputRows)
  const ordersRef = useRef(orders)
  const paymentRowsRef = useRef(paymentRows)
  const batchRowsRef = useRef(batchRows)
  const derivedMapRef = useRef(initialTimelineResult.derivedMap)
  const timelineOrdersRef = useRef(timelineOrdersState)
  useEffect(() => {
    inputRowsRef.current = inputRows
  }, [inputRows])

useEffect(() => {
  ordersRef.current = orders
}, [orders])

useEffect(() => {
  paymentRowsRef.current = paymentRows
}, [paymentRows])

useEffect(() => {
  timelineOrdersRef.current = timelineOrdersState
}, [timelineOrdersState])

useEffect(() => {
  batchRowsRef.current = batchRows
}, [batchRows])

useEffect(() => {
  setBatchRows(initialBatchRows)
  batchRowsRef.current = initialBatchRows
}, [initialBatchRows])

  const syncPaymentExpectations = useCallback(
    (ordersToSync: string[]) => {
      if (!ordersToSync.length) return
      const targetIds = new Set(ordersToSync)
      const updates: PaymentUpdatePayload[] = []

      setPaymentRows((previous) => {
        const next = previous.map((row) => {
          if (!targetIds.has(row.purchaseOrderId)) return row
          const derived = derivedMapRef.current.get(row.purchaseOrderId)
          if (!derived) return row
          const planned = derived.plannedPayments.find((item) => item.paymentIndex === row.paymentIndex)
          if (!planned) return row

          const expectedValue = formatNumericInput(planned.plannedAmount, 2)
          const percentValue = normalizePercent(planned.plannedPercent)
          const paidNumeric = parseNumericInput(row.amountPaid)
          const plannedDefaultIso = toIsoDateString(planned.plannedDefaultDate ?? planned.plannedDate)
          const plannedDefaultDisplay = formatIsoDate(plannedDefaultIso)
          const plannedWeek = deriveIsoWeek(plannedDefaultIso)

          const rowDueDateSource = row.dueDateSource ?? 'SYSTEM'
          const rowDueDateIso = row.dueDateIso ?? toIsoDateString(row.dueDate)
          const rowValues: Record<string, string | null | undefined> = {}
          let mutated = false
          let nextRow = row

          const ensureClone = () => {
            if (!mutated) {
              nextRow = { ...row }
              mutated = true
            }
          }

          if (plannedDefaultIso !== row.dueDateDefaultIso) {
            ensureClone()
            nextRow.dueDateDefaultIso = plannedDefaultIso
            nextRow.dueDateDefault = plannedDefaultDisplay
            rowValues.dueDateDefault = plannedDefaultIso ?? ''
          }

          if (rowDueDateSource !== 'USER') {
            if (plannedDefaultIso !== rowDueDateIso) {
              ensureClone()
              nextRow.dueDateIso = plannedDefaultIso
              nextRow.dueDate = plannedDefaultDisplay
              nextRow.dueDateSource = 'SYSTEM'
              nextRow.weekNumber = plannedWeek
              rowValues.dueDate = plannedDefaultIso ?? ''
              rowValues.dueDateSource = 'SYSTEM'
            } else if (nextRow.weekNumber !== plannedWeek) {
              ensureClone()
              nextRow.weekNumber = plannedWeek
            }
          } else if (rowDueDateIso) {
            const manualWeek = deriveIsoWeek(rowDueDateIso)
            if (manualWeek !== row.weekNumber) {
              ensureClone()
              nextRow.weekNumber = manualWeek
            }
          }

          if (paidNumeric == null || paidNumeric === 0) {
            rowValues.amountExpected = expectedValue
            rowValues.percentage = percentValue
            ensureClone()
            nextRow.amountExpected = expectedValue
            nextRow.percentage = percentValue
          } else if (row.amountExpected !== expectedValue) {
            rowValues.amountExpected = expectedValue
            ensureClone()
            nextRow.amountExpected = expectedValue
          }

          if (Object.keys(rowValues).length > 0) {
            updates.push({
              id: row.id,
              values: rowValues,
            })
          }

          return nextRow
        })
        paymentRowsRef.current = next
        return next
      })

      if (updates.length > 0) {
        void fetch('/api/v1/x-plan/purchase-order-payments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        }).catch((error) => {
          console.error('Failed to sync payment expectations', error)
        })
      }
    },
    []
  )

  const applyTimelineUpdate = useCallback(
    (nextOrders: PurchaseOrderInput[], nextInputRows: OpsInputRow[], nextPayments: PurchasePaymentRow[]) => {
      const { timelineRows: newTimelineRows, timelineOrders: newTimelineOrders, derivedMap } = buildTimelineRowsFromData({
        orders: nextOrders,
        rows: nextInputRows,
        payments: nextPayments,
        productIndex,
        leadProfiles: leadProfileMap,
        parameters: calculator.parameters,
      })
      derivedMapRef.current = derivedMap
      setTimelineRows(newTimelineRows)
      setTimelineOrdersState(newTimelineOrders)
      syncPaymentExpectations(Array.from(derivedMap.keys()))
    },
    [productIndex, leadProfileMap, calculator.parameters, syncPaymentExpectations]
  )

  useEffect(() => {
    setInputRows(poTableRows)
    applyTimelineUpdate(ordersRef.current, poTableRows, paymentRowsRef.current)
  }, [poTableRows, applyTimelineUpdate])

  useEffect(() => {
    const ordersFromServer = deserializeOrders(calculator.purchaseOrders)
    setOrders(ordersFromServer)
    ordersRef.current = ordersFromServer
    applyTimelineUpdate(ordersFromServer, inputRowsRef.current, paymentRowsRef.current)
  }, [calculator.purchaseOrders, applyTimelineUpdate])

  useEffect(() => {
    const normalized = normalizePaymentRows(payments)
    setPaymentRows(normalized)
    paymentRowsRef.current = normalized
    applyTimelineUpdate(ordersRef.current, inputRowsRef.current, normalized)
  }, [payments, applyTimelineUpdate])

  useEffect(() => {
    if (inputRows.length === 0) {
      setActiveOrderId(null)
      return
    }
    if (!activeOrderId || !inputRows.some((row) => row.id === activeOrderId)) {
      setActiveOrderId(inputRows[0].id)
    }
  }, [inputRows, activeOrderId])

  useEffect(() => {
    if (!activeOrderId) {
      setActiveBatchId(null)
      return
    }
    const firstBatch = batchRows.find((row) => row.purchaseOrderId === activeOrderId)
    setActiveBatchId(firstBatch?.id ?? null)
  }, [activeOrderId, batchRows])

  const handleInputRowsChange = useCallback(
    (updatedRows: OpsInputRow[]) => {
      setInputRows(updatedRows)
      const mergedOrders = mergeOrders(ordersRef.current, updatedRows)
      setOrders(mergedOrders)
      ordersRef.current = mergedOrders
      inputRowsRef.current = updatedRows
      applyTimelineUpdate(mergedOrders, updatedRows, paymentRowsRef.current)
    },
    [applyTimelineUpdate]
  )

  const handlePaymentRowsChange = useCallback(
    (rows: PurchasePaymentRow[]) => {
      if (!activeOrderId) return
      const normalized = normalizePaymentRows(rows)
      const existing = paymentRowsRef.current.filter((row) => row.purchaseOrderId !== activeOrderId)
      const next = [...existing, ...normalized]
      paymentRowsRef.current = next
      setPaymentRows(next)
      applyTimelineUpdate(ordersRef.current, inputRowsRef.current, next)
    },
    [activeOrderId, applyTimelineUpdate]
  )

  const handleBatchRowsChange = useCallback((updatedRows: OpsBatchRow[]) => {
    setBatchRows((previous) => {
      const map = new Map(previous.map((row) => [row.id, row]))
      for (const updated of updatedRows) {
        const existing = map.get(updated.id) ?? updated
        map.set(updated.id, { ...existing, ...updated })
      }
      const next = Array.from(map.values())
      batchRowsRef.current = next
      return next
    })

    const rowsByOrder = new Map<string, OpsBatchRow[]>()
    for (const row of updatedRows) {
      const list = rowsByOrder.get(row.purchaseOrderId) ?? []
      list.push(row)
      rowsByOrder.set(row.purchaseOrderId, list)
    }

    setOrders((previous) => {
      const next = previous.map((order) => {
        const updates = rowsByOrder.get(order.id)
        if (!updates || updates.length === 0) return order
        const batches = [...(order.batchTableRows ?? [])]
        for (const update of updates) {
          const batchIndex = batches.findIndex((batch) => batch.id === update.id)
          if (batchIndex === -1) continue
          batches[batchIndex] = {
            ...batches[batchIndex],
            productId: update.productId,
            quantity: parseInteger(update.quantity, batches[batchIndex].quantity ?? 0),
            overrideSellingPrice: parseNumber(update.sellingPrice),
            overrideManufacturingCost: parseNumber(update.manufacturingCost),
            overrideFreightCost: parseNumber(update.freightCost),
            overrideTariffRate: parsePercent(update.tariffRate),
            overrideTacosPercent: parsePercent(update.tacosPercent),
            overrideFbaFee: parseNumber(update.fbaFee),
            overrideReferralRate: parsePercent(update.referralRate),
            overrideStoragePerMonth: parseNumber(update.storagePerMonth),
          } as BatchTableRowInput
        }
        const totalQuantity = batches.reduce((sum, batch) => sum + (batch.quantity ?? 0), 0)
        return { ...order, batchTableRows: batches, quantity: totalQuantity }
      })
      ordersRef.current = next
      return next
    })

    applyTimelineUpdate(ordersRef.current, inputRowsRef.current, paymentRowsRef.current)
  }, [applyTimelineUpdate])

  const handleSelectBatch = useCallback((batchId: string) => {
    setActiveBatchId(batchId)
  }, [])

  const handleAddBatch = useCallback(() => {
    const orderId = activeOrderId
    if (!orderId) {
      toast.error('Select a purchase order first')
      return
    }
    const order = ordersRef.current.find((item) => item.id === orderId)
    const defaultProductId = order?.productId ?? productOptions[0]?.id
    if (!defaultProductId) {
      toast.error('Add a product before creating batches')
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/v1/x-plan/purchase-orders/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purchaseOrderId: orderId, productId: defaultProductId, quantity: 0 }),
        })
        if (!response.ok) {
          let message = 'Failed to add batch'
          try {
            const errorPayload = await response.json()
            if (typeof errorPayload?.error === 'string') message = errorPayload.error
          } catch (error) {
            // ignore
          }
          throw new Error(message)
        }
        const payload = (await response.json()) as { batch?: { id: string; purchaseOrderId: string; productId: string; quantity: number; batchCode?: string | null } }
        const created = payload.batch
        if (!created) throw new Error('Missing batch payload')
        const nextRow: OpsBatchRow = {
          id: created.id,
          purchaseOrderId: created.purchaseOrderId,
          orderCode: order?.orderCode ?? '',
          batchCode: created.batchCode ?? undefined,
          productId: created.productId,
          productName: productNameIndex.get(created.productId) ?? '',
          quantity: formatNumericInput(created.quantity ?? 0, 0),
          sellingPrice: '',
          manufacturingCost: '',
          freightCost: '',
          tariffRate: '',
          tacosPercent: '',
          fbaFee: '',
          referralRate: '',
          storagePerMonth: '',
        }
        setBatchRows((previous) => {
          const next = [...previous, nextRow]
          batchRowsRef.current = next
          return next
        })
        setOrders((previous) => {
          const next = previous.map((order) => {
            if (order.id !== created.purchaseOrderId) return order
            const batches = [...(order.batchTableRows ?? []), {
              id: created.id,
              purchaseOrderId: created.purchaseOrderId,
              batchCode: created.batchCode ?? undefined,
              productId: created.productId,
              quantity: created.quantity,
              overrideSellingPrice: null,
              overrideManufacturingCost: null,
              overrideFreightCost: null,
              overrideTariffRate: null,
              overrideTacosPercent: null,
              overrideFbaFee: null,
              overrideReferralRate: null,
              overrideStoragePerMonth: null,
            } satisfies BatchTableRowInput]
            return {
              ...order,
              batchTableRows: batches,
              quantity: batches.reduce((sum, batch) => sum + (batch.quantity ?? 0), 0),
            }
          })
          ordersRef.current = next
          return next
        })
        applyTimelineUpdate(ordersRef.current, inputRowsRef.current, paymentRowsRef.current)
        setActiveBatchId(created.id)
        toast.success('Batch added')
      } catch (error) {
        console.error(error)
        toast.error(error instanceof Error ? error.message : 'Unable to add batch')
      }
    })
  }, [activeOrderId, applyTimelineUpdate, productNameIndex, productOptions, startTransition])

  const handleDeleteBatch = useCallback(() => {
    const batchId = activeBatchId
    if (!batchId) return
    const batch = batchRowsRef.current.find((row) => row.id === batchId)
    if (!batch) return

    const confirmRemoval = window.confirm('Remove this batch from the purchase order?')
    if (!confirmRemoval) return

    startTransition(async () => {
      try {
        const response = await fetch('/api/v1/x-plan/purchase-orders/batches', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: batchId }),
        })
        if (!response.ok) throw new Error('Failed to delete batch')
        setBatchRows((previous) => {
          const next = previous.filter((row) => row.id !== batchId)
          batchRowsRef.current = next
          return next
        })
        setOrders((previous) => {
        const next = previous.map((order) => {
          if (order.id !== batch.purchaseOrderId) return order
          const batches = (order.batchTableRows ?? []).filter((item) => item.id !== batchId)
          return {
            ...order,
            batchTableRows: batches,
            quantity: batches.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
          }
        })
          ordersRef.current = next
          return next
        })
        applyTimelineUpdate(ordersRef.current, inputRowsRef.current, paymentRowsRef.current)
        toast.success('Batch removed')
      } catch (error) {
        console.error(error)
        toast.error('Unable to delete batch')
      }
    })
  }, [activeBatchId, applyTimelineUpdate, startTransition])

  const orderSummaries = useMemo(() => {
    const summaries = new Map<string, PaymentSummary>()

    for (const row of timelineRows) {
      const derived = derivedMapRef.current.get(row.id)
      const plannedAmount = derived?.supplierCostTotal ?? derived?.plannedPoValue ?? 0
      const plannedPercent = plannedAmount > 0 ? 1 : 0
      summaries.set(row.id, {
        plannedAmount,
        plannedPercent,
        actualAmount: 0,
        actualPercent: 0,
        remainingAmount: plannedAmount,
        remainingPercent: plannedPercent,
      })
    }

    for (const payment of paymentRows) {
      const summary = summaries.get(payment.purchaseOrderId)
      if (!summary) continue
      const amountPaid = parseNumericInput(payment.amountPaid)
      if (!Number.isFinite(amountPaid) || amountPaid == null || amountPaid <= 0) {
        continue
      }
      summary.actualAmount += amountPaid

      const percentFromPayment = Number(payment.percentage ?? 0)
      if (Number.isFinite(percentFromPayment) && percentFromPayment > 0) {
        summary.actualPercent += percentFromPayment
      } else if (summary.plannedAmount > 0) {
        summary.actualPercent += amountPaid / summary.plannedAmount
      }
    }

    for (const summary of summaries.values()) {
      summary.remainingAmount = Math.max(summary.plannedAmount - summary.actualAmount, 0)
      summary.remainingPercent = Math.max(summary.plannedPercent - summary.actualPercent, 0)
    }

    return summaries
  }, [timelineRows, paymentRows])

  const handleAddPayment = useCallback(async () => {
    const orderId = activeOrderId
    if (!orderId) {
      toast.error('Select a purchase order first')
      return
    }
    const summary = orderSummaries.get(orderId)
    if (isFullyAllocated(summary)) {
      toast.error('This PO is already fully cleared')
      return
    }
    const matchingPayments = paymentRowsRef.current.filter((row) => row.purchaseOrderId === orderId)
    const nextIndex = matchingPayments.length ? Math.max(...matchingPayments.map((row) => row.paymentIndex)) + 1 : 1

    setIsAddingPayment(true)
    try {
      const response = await fetch('/api/v1/x-plan/purchase-order-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseOrderId: orderId, paymentIndex: nextIndex }),
      })

      if (!response.ok) {
        let message = 'Failed to add payment'
        try {
          const errorPayload = await response.json()
          if (typeof errorPayload?.error === 'string') message = errorPayload.error
        } catch (error) {
          // ignore JSON parse issues
        }
        throw new Error(message)
      }

      const created = (await response.json()) as PurchasePaymentRow
      const [normalizedCreated] = normalizePaymentRows([created])

      setPaymentRows((previous) => {
        const next = [...previous, normalizedCreated]
        paymentRowsRef.current = next
        applyTimelineUpdate(ordersRef.current, inputRowsRef.current, next)
        return next
      })

      toast.success('Payment added')
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Unable to add payment')
    } finally {
      setIsAddingPayment(false)
    }
  }, [activeOrderId, applyTimelineUpdate, orderSummaries])

  const visiblePayments = !activeOrderId
    ? ([] as PurchasePaymentRow[])
    : paymentRows
        .filter((payment) => payment.purchaseOrderId === activeOrderId)
        .map((payment) => {
          const derived = derivedMapRef.current.get(payment.purchaseOrderId)
          if (!derived || !derived.plannedPayments.length) return payment

          const planned = derived.plannedPayments.find((item) => item.paymentIndex === payment.paymentIndex)
          if (!planned) return payment

          const expectedValue = formatNumericInput(planned.plannedAmount, 2)
          const paidNumeric = parseNumericInput(payment.amountPaid)
          const shouldUpdatePercent = paidNumeric == null || paidNumeric === 0
          const percentValue = shouldUpdatePercent
            ? formatPercentInput(planned.plannedPercent ?? 0, 4)
            : payment.percentage

          if (payment.amountExpected === expectedValue && payment.percentage === percentValue) {
            return payment
          }

          return {
            ...payment,
            amountExpected: expectedValue,
            percentage: percentValue,
          }
        })

  const visibleBatches = useMemo(() => {
    if (!activeOrderId) return [] as OpsBatchRow[]
    const matchingRows = batchRows.filter((batch) => batch.purchaseOrderId === activeOrderId)
    if (matchingRows.length > 0) return matchingRows

    const order = ordersRef.current.find((item) => item.id === activeOrderId)
    if (!order || !Array.isArray(order.batchTableRows) || order.batchTableRows.length === 0) return []
    return order.batchTableRows.map((batch) => buildBatchRow(order, batch))
  }, [activeOrderId, batchRows, buildBatchRow])

  const isFullyAllocated = (summary: PaymentSummary | undefined) => {
    if (!summary) return false
    const amountTolerance = Math.max(summary.plannedAmount * 0.001, 0.01)
    const percentTolerance = Math.max(summary.plannedPercent * 0.001, 0.001)
    const amountCleared = summary.plannedAmount > 0 && summary.remainingAmount <= amountTolerance
    const percentCleared = summary.plannedPercent > 0 && summary.remainingPercent <= percentTolerance
    return amountCleared || percentCleared
  }

  const summaryLine = useMemo(() => {
    if (!activeOrderId) return null
    const summary = orderSummaries.get(activeOrderId)
    if (!summary) return null
    return summaryLineFor(summary)
  }, [orderSummaries, activeOrderId])

  const handleCostSync = useCallback(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router])

  const handleDeleteOrder = useCallback(
    (orderId: string) => {
      if (!orderId) return
      const confirmRemoval = window.confirm(
        'Remove this purchase order? Associated payments and timeline stages will also be deleted.'
      )
      if (!confirmRemoval) return

      startTransition(async () => {
        try {
          const response = await fetch('/api/v1/x-plan/purchase-orders', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: orderId }),
          })
          if (!response.ok) throw new Error('Failed to delete purchase order')
          if (activeOrderId === orderId) {
            setActiveOrderId(null)
          }
          setBatchRows((previous) => {
            const next = previous.filter((row) => row.purchaseOrderId !== orderId)
            batchRowsRef.current = next
            return next
          })
          toast.success('Purchase order removed')
          router.refresh()
        } catch (error) {
          console.error(error)
          toast.error('Unable to delete purchase order')
        }
      })
    },
    [activeOrderId, router, startTransition]
  )

  const handleCreateOrder = useCallback(() => {
    const trimmedCode = newOrderCode.trim()

    const defaultProductId = productOptions[0]?.id
    if (!defaultProductId) {
      toast.error('Create a product before adding purchase orders')
      return
    }

    startTransition(async () => {
      try {
        const basePayload: Record<string, unknown> = { productId: defaultProductId }
        const requestPayload = trimmedCode.length
          ? { ...basePayload, orderCode: trimmedCode }
          : basePayload

        const createRequest = (body: Record<string, unknown>) =>
          fetch('/api/v1/x-plan/purchase-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

        let response = await createRequest(requestPayload)
        let autoGenerated = false

        if (!response.ok && response.status === 409 && trimmedCode.length) {
          // Duplicate code – fall back to letting the server generate a unique one.
          response = await createRequest(basePayload)
          autoGenerated = response.ok
        }

        if (!response.ok) {
          let message = 'Failed to create purchase order'
          try {
            const errorPayload = await response.json()
            if (typeof errorPayload?.error === 'string') {
              message = errorPayload.error
            }
          } catch (error) {
            // ignore JSON parse errors
          }
          throw new Error(message)
        }

        const result = await response.json().catch(() => null)
        const createdId = result?.order?.id as string | undefined
        if (createdId) {
          setActiveOrderId(createdId)
        }
        setIsCreateOrderOpen(false)
        setNewOrderCode('')
        toast.success(autoGenerated ? 'Purchase order created with a new generated code' : 'Purchase order created')
        router.refresh()
      } catch (error) {
        console.error(error)
        toast.error('Unable to create purchase order')
      }
    })
  }, [newOrderCode, productOptions, router, startTransition])

  return (
    <div className="space-y-6">
      {!isVisualMode && (
        <>
          <OpsPlanningGrid
            rows={inputRows}
            activeOrderId={activeOrderId}
            onSelectOrder={(orderId) => setActiveOrderId(orderId)}
            onRowsChange={handleInputRowsChange}
            onCreateOrder={() => setIsCreateOrderOpen(true)}
            onDeleteOrder={handleDeleteOrder}
            disableCreate={isPending || productOptions.length === 0}
            disableDelete={isPending}
          />

          {isCreateOrderOpen ? (
            <section className="space-y-4 rounded-xl border border-dashed border-[#0b3a52] bg-[#06182b]/85 p-4 shadow-[0_26px_55px_rgba(1,12,24,0.25)] backdrop-blur-sm">
              <header className="space-y-1">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">
                  New purchase order
                </h3>
                <p className="text-xs text-slate-200/80">
                  Set the PO identifier now — assign cost details and the target product in the batch cost table below.
                </p>
              </header>
              <form
                className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.5fr)_auto]"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleCreateOrder()
                }}
              >
                <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">
                  Order code
                  <input
                    type="text"
                    value={newOrderCode}
                    onChange={(event) => setNewOrderCode(event.target.value)}
                    placeholder="Auto-generate if blank"
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition focus:outline-none focus:ring-2 focus:ring-cyan-400/60 hover:border-cyan-300/50"
                  />
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOrderOpen(false)}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-[#00c2b9] px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#002430] shadow-[0_12px_24px_rgba(0,194,185,0.25)] transition enabled:hover:bg-[#00a39e] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Create
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <OpsPlanningCostGrid
            rows={visibleBatches}
            activeOrderId={activeOrderId}
            activeBatchId={activeBatchId}
            onSelectOrder={(orderId) => setActiveOrderId(orderId)}
            onSelectBatch={handleSelectBatch}
            onRowsChange={handleBatchRowsChange}
            onAddBatch={handleAddBatch}
            onDeleteBatch={handleDeleteBatch}
            disableAdd={isPending || !activeOrderId}
            disableDelete={isPending}
            products={productOptions}
            onSync={handleCostSync}
          />
          <PurchasePaymentsGrid
            payments={visiblePayments}
            activeOrderId={activeOrderId}
            onSelectOrder={(orderId) => setActiveOrderId(orderId)}
            onAddPayment={handleAddPayment}
            onRowsChange={handlePaymentRowsChange}
            isLoading={isPending || isAddingPayment}
            orderSummaries={orderSummaries}
            summaryLine={summaryLine ?? undefined}
          />
        </>
      )}

      {isVisualMode && (
        <PurchaseTimeline
          orders={timelineOrdersState}
          activeOrderId={activeOrderId}
          onSelectOrder={(orderId) => setActiveOrderId(orderId)}
          months={timelineMonths}
        />
      )}
    </div>
  )
}
