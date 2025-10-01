import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { OpsPlanningWorkspace } from '@/components/sheets/ops-planning-workspace'
import { ProductSetupWorkspace } from '@/components/sheets/product-setup-workspace'
import { SalesPlanningGrid, SalesPlanningFocusControl, SalesPlanningFocusProvider } from '@/components/sheets/sales-planning-grid'
import { SalesPlanningVisual } from '@/components/sheets/sales-planning-visual'
import { ProfitAndLossGrid } from '@/components/sheets/fin-planning-pl-grid'
import { CashFlowGrid } from '@/components/sheets/fin-planning-cash-grid'
import { SheetViewToggle, type SheetViewMode } from '@/components/sheet-view-toggle'
import { FinancialTrendsSection, type FinancialMetricDefinition } from '@/components/sheets/financial-trends-section'
import type { OpsInputRow } from '@/components/sheets/ops-planning-grid'
import type { OpsTimelineRow } from '@/components/sheets/ops-planning-timeline'
import type { PurchasePaymentRow } from '@/components/sheets/purchase-payments-grid'
import type { OpsPlanningCalculatorPayload, PurchaseOrderSerialized } from '@/components/sheets/ops-planning-workspace'
import prisma from '@/lib/prisma'
import {
  Prisma,
  type BatchTableRow,
  type PurchaseOrder,
  type PurchaseOrderPayment,
} from '@prisma/client'
import { getSheetConfig } from '@/lib/sheets'
import { getWorkbookStatus } from '@/lib/workbook'
import { WorkbookLayout } from '@/components/workbook-layout'
import {
  mapProducts,
  mapLeadStageTemplates,
  mapLeadOverrides,
  mapBusinessParameters,
  mapPurchaseOrders,
  mapProfitAndLossWeeks,
  mapCashFlowWeeks,
} from '@/lib/calculations/adapters'
import {
  buildProductCostIndex,
  buildLeadTimeProfiles,
  getLeadTimeProfile,
  normalizeBusinessParameters,
  computePurchaseOrderDerived,
  computeSalesPlan,
  computeProfitAndLoss,
  computeCashFlow,
  type SalesWeekDerived,
  type PurchaseOrderDerived,
  type PurchaseOrderInput,
  type LeadTimeProfile,
  type BusinessParameterMap,
} from '@/lib/calculations'
import type { ProductCostSummary } from '@/lib/calculations/product'
import { createTimelineOrderFromDerived, type PurchaseTimelineOrder } from '@/lib/planning/timeline'
import { addMonths, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns'
import { getCalendarDateForWeek, type YearSegment } from '@/lib/calculations/calendar'
import { findYearSegment, loadPlanningCalendar, resolveActiveYear } from '@/lib/planning'
import type { PlanningCalendar } from '@/lib/planning'

const SALES_METRICS = ['stockStart', 'actualSales', 'forecastSales', 'finalSales', 'finalSalesError', 'stockWeeks', 'stockEnd'] as const
type SalesMetric = (typeof SALES_METRICS)[number]

type SalesRow = {
  weekNumber: string
  weekDate: string
  [key: string]: string
}

function toIsoDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

function formatDisplayDate(value: Date | number | string | null | undefined): string {
  if (value == null) return ''
  if (typeof value === 'string') {
    const t = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const d = new Date(`${t}T00:00:00Z`)
      return Number.isNaN(d.getTime()) ? '' : format(d, 'MMM d yyyy')
    }
    const d = new Date(t)
    return Number.isNaN(d.getTime()) ? '' : format(d, 'MMM d yyyy')
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '' : format(d, 'MMM d yyyy')
  }
  return format(value, 'MMM d yyyy')
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return ''
  return formatDisplayDate(value)
}

function deriveIsoWeek(iso: string | null | undefined): string {
  if (!iso) return ''
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  const dayNumber = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return String(week)
}

function toNumberSafe(value: number | bigint | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  const numeric = Number(value)
  return Number.isNaN(numeric) ? 0 : numeric
}

function formatNumeric(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null || Number.isNaN(value)) return ''
  return Number(value).toFixed(fractionDigits)
}

function formatPercentDecimal(value: number | null | undefined, fractionDigits = 4): string {
  if (value == null || Number.isNaN(value)) return ''
  return Number(value).toFixed(fractionDigits)
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return `$${formatNumeric(value)}`
}

function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value == null || Number.isNaN(value)) return ''
  return `${(Number(value) * 100).toFixed(fractionDigits)}%`
}

const DEFAULT_PAYMENT_LABELS: Record<number, string> = {
  1: 'Manufacturing Deposit (25%)',
  2: 'Manufacturing Production (25%)',
  3: 'Freight (100%)',
  4: 'Manufacturing Final (50%)',
  5: 'Tariff (100%)',
}

function buildPaymentLabel(category?: string | null, index?: number): string {
  const normalizedCategory = category?.trim().toLowerCase()
  if (normalizedCategory === 'manufacturing' && index != null) {
    return DEFAULT_PAYMENT_LABELS[index] ?? 'Manufacturing'
  }
  if (normalizedCategory === 'freight') return DEFAULT_PAYMENT_LABELS[3]
  if (normalizedCategory === 'tariff') return DEFAULT_PAYMENT_LABELS[5]

  const explicitLabel = category?.trim()
  if (explicitLabel) return explicitLabel

  if (index != null && Number.isFinite(index)) {
    return DEFAULT_PAYMENT_LABELS[index] ?? `Payment ${index}`
  }

  return 'Payment'
}

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function serializePurchaseOrder(order: PurchaseOrderInput): PurchaseOrderSerialized {
  return {
    id: order.id,
    orderCode: order.orderCode,
    productId: order.productId,
    quantity: Number(order.quantity ?? 0),
    poDate: serializeDate(order.poDate),
    productionWeeks: order.productionWeeks ?? null,
    sourceWeeks: order.sourceWeeks ?? null,
    oceanWeeks: order.oceanWeeks ?? null,
    finalWeeks: order.finalWeeks ?? null,
    pay1Percent: order.pay1Percent ?? null,
    pay2Percent: order.pay2Percent ?? null,
    pay3Percent: order.pay3Percent ?? null,
    pay1Amount: order.pay1Amount ?? null,
    pay2Amount: order.pay2Amount ?? null,
    pay3Amount: order.pay3Amount ?? null,
    pay1Date: serializeDate(order.pay1Date),
    pay2Date: serializeDate(order.pay2Date),
    pay3Date: serializeDate(order.pay3Date),
    productionStart: serializeDate(order.productionStart),
    productionComplete: serializeDate(order.productionComplete),
    sourceDeparture: serializeDate(order.sourceDeparture),
    transportReference: order.transportReference ?? null,
    createdAt: serializeDate(order.createdAt),
    shipName: order.shipName ?? null,
    containerNumber: order.containerNumber ?? null,
    portEta: serializeDate(order.portEta),
    inboundEta: serializeDate(order.inboundEta),
    availableDate: serializeDate(order.availableDate),
    totalLeadDays: order.totalLeadDays ?? null,
    status: order.status,
    notes: order.notes ?? null,
    payments:
      order.payments?.map((payment) => ({
        paymentIndex: payment.paymentIndex,
        percentage: payment.percentage ?? null,
        amountExpected: payment.amountExpected ?? null,
        amountPaid: payment.amountPaid ?? null,
        category: payment.category ?? null,
        label: payment.label ?? null,
        dueDate: serializeDate(payment.dueDate),
        dueDateDefault: serializeDate(payment.dueDateDefault ?? null),
        dueDateSource: payment.dueDateSource,
      })) ?? [],
    overrideSellingPrice: order.overrideSellingPrice ?? null,
    overrideManufacturingCost: order.overrideManufacturingCost ?? null,
    overrideFreightCost: order.overrideFreightCost ?? null,
    overrideTariffRate: order.overrideTariffRate ?? null,
    overrideTacosPercent: order.overrideTacosPercent ?? null,
    overrideFbaFee: order.overrideFbaFee ?? null,
    overrideReferralRate: order.overrideReferralRate ?? null,
    overrideStoragePerMonth: order.overrideStoragePerMonth ?? null,
    batchTableRows: order.batchTableRows?.map((batch) => ({
      id: batch.id,
      batchCode: batch.batchCode ?? null,
      productId: batch.productId,
      quantity: toNumberSafe(batch.quantity),
      overrideSellingPrice: batch.overrideSellingPrice ?? null,
      overrideManufacturingCost: batch.overrideManufacturingCost ?? null,
      overrideFreightCost: batch.overrideFreightCost ?? null,
      overrideTariffRate: batch.overrideTariffRate ?? null,
      overrideTacosPercent: batch.overrideTacosPercent ?? null,
      overrideFbaFee: batch.overrideFbaFee ?? null,
      overrideReferralRate: batch.overrideReferralRate ?? null,
      overrideStoragePerMonth: batch.overrideStoragePerMonth ?? null,
    })) ?? [],
  }
}

function buildWeekRange(segment: YearSegment | null, calendar: PlanningCalendar['calendar']): number[] {
  if (segment) {
    return Array.from({ length: segment.weekCount }, (_, index) => segment.startWeekNumber + index)
  }
  const min = calendar.minWeekNumber
  const max = calendar.maxWeekNumber
  if (min == null || max == null) return []
  const weeks: number[] = []
  for (let week = min; week <= max; week += 1) {
    weeks.push(week)
  }
  return weeks
}

function isWeekInSegment(weekNumber: number, segment: YearSegment | null): boolean {
  if (!segment) return true
  return weekNumber >= segment.startWeekNumber && weekNumber <= segment.endWeekNumber
}

function filterSummaryByYear<T extends { periodLabel: string }>(rows: T[], year: number | null): T[] {
  if (year == null) return rows
  const suffix = String(year)
  return rows.filter((row) => row.periodLabel.trim().endsWith(suffix))
}

function resolveViewMode(value: string | string[] | undefined): SheetViewMode {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate === 'visual' ? 'visual' : 'tabular'
}

function VisualPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      <p className="mt-2 text-sm">{description}</p>
    </div>
  )
}

function limitRows<T>(rows: T[], limit: number): T[] {
  if (rows.length <= limit) return rows
  return rows.slice(-limit)
}

function buildTrendSeries<T>(rows: T[], key: Extract<keyof T, string>) {
  const labels: string[] = []
  const values: number[] = []

  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const record = row as Record<string, unknown>
    const raw = record[key]
    const numeric = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(numeric)) continue

    let label = ''
    if ('periodLabel' in record && typeof record.periodLabel === 'string' && record.periodLabel.trim()) {
      label = record.periodLabel
    } else if ('weekDate' in record) {
      const weekDate = record.weekDate as Date | string | number | null | undefined
      if (weekDate != null) {
        const formatted = formatDisplayDate(weekDate)
        if (formatted) {
          label = formatted
        }
      }
    }

    if (!label && 'weekNumber' in record) {
      const weekValue = record.weekNumber as string | number | null | undefined
      if (weekValue != null && !(typeof weekValue === 'string' && weekValue.trim() === '')) {
        label = `W${weekValue}`
      }
    }

    labels.push(label)
    values.push(Number(numeric))
  }

  return { labels, values }
}

type SheetPageProps = {
  params: Promise<{ sheet: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type BusinessParameterView = {
  id: string
  label: string
  value: string
  type: 'numeric' | 'text'
}

type NestedHeaderCell =
  | string
  | { label: string; colspan?: number; rowspan?: number; title?: string }

const FINANCE_PARAMETER_LABELS = new Set(
  ['amazon payout delay (weeks)', 'starting cash', 'weekly fixed costs'].map((label) => label.toLowerCase())
)
const SALES_PARAMETER_LABELS = new Set(['weeks of stock warning threshold'].map((label) => label.toLowerCase()))
const OPERATIONS_PARAMETER_EXCLUDES = new Set([
  'product ordering',
  'supplier payment split 1 (%)',
  'supplier payment split 2 (%)',
  'supplier payment split 3 (%)',
  'supplier payment terms (weeks)',
])

function isFinanceParameterLabel(label: string) {
  return FINANCE_PARAMETER_LABELS.has(label.trim().toLowerCase())
}

function isSalesParameterLabel(label: string) {
  return SALES_PARAMETER_LABELS.has(label.trim().toLowerCase())
}

function columnKey(productIndex: number, metric: SalesMetric) {
  return `p${productIndex}_${metric}`
}

function metricHeader(metric: SalesMetric): NestedHeaderCell {
  switch (metric) {
    case 'stockStart':
      return 'Stock Start'
    case 'actualSales':
      return 'Actual Sales'
    case 'forecastSales':
      return 'Fcst Sales'
    case 'finalSales':
      return 'Final Sales'
    case 'finalSalesError':
      return {
        label: '% Error',
        title: 'Percent error between actual and forecast sales when both values are present.',
      }
    case 'stockWeeks':
      return {
        label: 'Stock (Weeks)',
        title:
          'Weeks of stock = number of future weeks until projected inventory reaches zero using Final Sales (Actuals when present, otherwise Forecast) and scheduled arrivals.',
      }
    case 'stockEnd':
      return 'Stock End'
    default:
      return metric
  }
}

async function getProductSetupView() {
  const [products, businessParameters] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: 'asc' } }),
    prisma.businessParameter.findMany({ orderBy: { label: 'asc' } }),
  ])

  const activeProducts = products.filter((product) => {
    const sku = product.sku?.trim()
    return product.isActive && sku && sku.length > 0
  })

  const parameterInputs = mapBusinessParameters(businessParameters)

  const operationsParameters = parameterInputs
    .filter((parameter) => {
      const normalized = parameter.label.trim().toLowerCase()
      return (
        !isFinanceParameterLabel(parameter.label) &&
        !isSalesParameterLabel(parameter.label) &&
        !OPERATIONS_PARAMETER_EXCLUDES.has(normalized)
      )
    })
    .map<BusinessParameterView>((parameter) => ({
      id: parameter.id,
      label: parameter.label,
      value:
        parameter.valueNumeric != null
          ? formatNumeric(parameter.valueNumeric)
          : parameter.valueText ?? '',
      type: parameter.valueNumeric != null ? 'numeric' : 'text',
    }))

  const salesParameters = parameterInputs
    .filter((parameter) => isSalesParameterLabel(parameter.label))
    .map<BusinessParameterView>((parameter) => ({
      id: parameter.id,
      label: parameter.label,
      value:
        parameter.valueNumeric != null
          ? formatNumeric(parameter.valueNumeric)
          : parameter.valueText ?? '',
      type: parameter.valueNumeric != null ? 'numeric' : 'text',
    }))

  const financeParameters = parameterInputs
    .filter((parameter) => isFinanceParameterLabel(parameter.label))
    .map<BusinessParameterView>((parameter) => ({
      id: parameter.id,
      label: parameter.label,
      value:
        parameter.valueNumeric != null
          ? formatNumeric(parameter.valueNumeric)
          : parameter.valueText ?? '',
      type: parameter.valueNumeric != null ? 'numeric' : 'text',
    }))

  const productRows = activeProducts
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((product) => ({
      id: product.id,
      sku: product.sku ?? '',
      name: product.name,
    }))

  return {
    products: productRows,
    operationsParameters,
    salesParameters,
    financeParameters,
  }
}

async function loadOperationsContext() {
  const prismaAny = prisma as any
  const batchTableRowDelegate: typeof prisma.batchTableRow | undefined = prismaAny.batchTableRow

  const [products, leadStages, overrides, businessParameters, purchaseOrders, batchTableRows] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: 'asc' } }),
    prisma.leadStageTemplate.findMany({ orderBy: { sequence: 'asc' } }),
    prisma.leadTimeOverride.findMany(),
    prisma.businessParameter.findMany({ orderBy: { label: 'asc' } }),
    prisma.purchaseOrder.findMany({
      orderBy: { orderCode: 'asc' },
      include: {
        payments: { orderBy: { paymentIndex: 'asc' } },
      },
    }),
    batchTableRowDelegate
      ? batchTableRowDelegate
          .findMany({ orderBy: [{ purchaseOrderId: 'asc' }, { createdAt: 'asc' }] })
          .catch(() => [] as BatchTableRow[])
      : Promise.resolve([] as BatchTableRow[]),
  ])

  const productInputs = mapProducts(products)
  const productIndex = buildProductCostIndex(productInputs)
  const productNameById = new Map(products.map((product) => [product.id, product.name]))
  const leadProfiles = buildLeadTimeProfiles(
    mapLeadStageTemplates(leadStages),
    mapLeadOverrides(overrides),
    productInputs.map((product) => product.id)
  )
  const parameters = normalizeBusinessParameters(mapBusinessParameters(businessParameters))
  const batchesByOrder = new Map<string, typeof batchTableRows>()
  for (const batch of batchTableRows) {
    const list = batchesByOrder.get(batch.purchaseOrderId) ?? []
    list.push(batch)
    batchesByOrder.set(batch.purchaseOrderId, list)
  }

  const purchaseOrdersWithBatches = purchaseOrders.map((order) => ({
    ...order,
    batchTableRows: (batchesByOrder.get(order.id) ?? []) as BatchTableRow[],
  })) as Array<
    (typeof purchaseOrders)[number] & {
      payments: PurchaseOrderPayment[]
      batchTableRows: BatchTableRow[]
    }
  >

  const purchaseOrderInputsInitial = mapPurchaseOrders(purchaseOrdersWithBatches)

  await ensureDefaultSupplierInvoices({
    purchaseOrders: purchaseOrdersWithBatches,
    purchaseOrderInputs: purchaseOrderInputsInitial,
    productIndex,
    leadProfiles,
    parameters,
  })

  const purchaseOrderInputs = mapPurchaseOrders(purchaseOrdersWithBatches)

  return {
    productInputs,
    productIndex,
    productNameById,
    leadProfiles,
    parameters,
    purchaseOrderInputs,
    rawPurchaseOrders: purchaseOrdersWithBatches,
  }
}

async function ensureDefaultSupplierInvoices({
  purchaseOrders,
  purchaseOrderInputs,
  productIndex,
  leadProfiles,
  parameters,
}: {
  purchaseOrders: Array<PurchaseOrder & { payments: PurchaseOrderPayment[]; batchTableRows: BatchTableRow[] }>
  purchaseOrderInputs: PurchaseOrderInput[]
  productIndex: Map<string, ProductCostSummary>
  leadProfiles: Map<string, LeadTimeProfile>
  parameters: BusinessParameterMap
}) {
  for (let index = 0; index < purchaseOrders.length; index += 1) {
    const record = purchaseOrders[index]
    const input = purchaseOrderInputs[index]
    if (!input) continue
    const profile = getLeadTimeProfile(input.productId, leadProfiles)
    if (!profile) continue
    const derived = computePurchaseOrderDerived(input, productIndex, profile, parameters)
    if (!derived.plannedPayments.length) continue

    const existingByIndex = new Map<number, PurchaseOrderPayment>()
    for (const payment of record.payments) {
      existingByIndex.set(payment.paymentIndex, payment)
    }

    const updates: Promise<PurchaseOrderPayment | null>[] = []

    for (const planned of derived.plannedPayments) {
      const amountValue = Number.isFinite(planned.plannedAmount) ? Number(planned.plannedAmount) : 0
      if (amountValue <= 0) continue
      const percentValue =
        planned.plannedPercent != null && Number.isFinite(planned.plannedPercent)
          ? Number(planned.plannedPercent)
          : null
      const dueDateDefault =
        planned.plannedDefaultDate ?? planned.plannedDate ?? input.poDate ?? record.poDate ?? record.createdAt ?? new Date()
      const dueDate = dueDateDefault

      const percentageDecimal = percentValue != null ? new Prisma.Decimal(percentValue.toFixed(4)) : null
      const amountExpectedDecimal = new Prisma.Decimal(amountValue.toFixed(2))

      const existing = existingByIndex.get(planned.paymentIndex)

      const existingAmountExpected = existing?.amountExpected != null ? Number(existing.amountExpected) : null
      const existingPercent = existing?.percentage != null ? Number(existing.percentage) : null
      const amountTolerance = Math.max(Math.abs(amountValue) * 0.001, 0.01)
      const percentTolerance = 0.0001
      const hasManualAmount =
        existingAmountExpected != null && Math.abs(existingAmountExpected - amountValue) > amountTolerance
      const hasManualPercent =
        existingPercent != null && percentValue != null && Math.abs(existingPercent - percentValue) > percentTolerance
      const existingDueDateSource = existing?.dueDateSource ?? 'SYSTEM'

      if (existing?.amountPaid != null) {
        continue
      }

      if (existing) {
        const updatePayload: UpdatePaymentInput = {
          paymentIndex: planned.paymentIndex,
          category: planned.category,
          label: planned.label,
          dueDateDefault,
        }

        if (existingDueDateSource === 'SYSTEM') {
          updatePayload.dueDate = dueDate
          updatePayload.dueDateSource = 'SYSTEM'
        }

        if (!hasManualAmount) {
          updatePayload.amountExpected = amountExpectedDecimal
          updatePayload.percentage = percentageDecimal
        } else if (!hasManualPercent && percentageDecimal != null) {
          updatePayload.percentage = percentageDecimal
        }

        if (Object.keys(updatePayload).length > 0) {
          updates.push(updatePurchaseOrderPayment(existing.id, updatePayload))
        }
      } else {
        updates.push(
          createPurchaseOrderPayment({
            purchaseOrderId: record.id,
            paymentIndex: planned.paymentIndex,
            dueDate,
            dueDateDefault,
            dueDateSource: 'SYSTEM',
            percentage: percentageDecimal,
            amountExpected: amountExpectedDecimal,
            category: planned.category,
            label: planned.label,
          })
        )
      }
    }

    if (updates.length > 0) {
      const results = await Promise.all(updates)
      for (const result of results) {
        if (!result) continue
        const idx = record.payments.findIndex((payment) => payment.paymentIndex === result.paymentIndex)
        if (idx === -1) {
          record.payments.push(result)
        } else {
          record.payments[idx] = result
        }
      }
      record.payments.sort((a, b) => a.paymentIndex - b.paymentIndex)
    }
  }
}

type PaymentDueDateSource = 'SYSTEM' | 'USER'

const PAYMENT_METADATA_MISSING_REGEX = /Unknown argument `(?:category|label|amountExpected|amountPaid)`/

function isMissingPaymentMetadataError(error: unknown): error is { message: string } {
  if (typeof error !== 'object' || error === null) return false
  const message = 'message' in error ? (error as { message?: unknown }).message : undefined
  return typeof message === 'string' && PAYMENT_METADATA_MISSING_REGEX.test(message)
}

type SeedPaymentInput = {
  purchaseOrderId: string
  paymentIndex: number
  dueDate: Date
  dueDateDefault: Date
  dueDateSource: PaymentDueDateSource
  percentage: Prisma.Decimal | null
  amountExpected: Prisma.Decimal
  amountPaid?: Prisma.Decimal | null
  category?: string
  label?: string
}

type UpdatePaymentInput = {
  paymentIndex?: number
  dueDate?: Date
  dueDateDefault?: Date
  dueDateSource?: PaymentDueDateSource
  percentage?: Prisma.Decimal | null
  amountExpected?: Prisma.Decimal | null
  amountPaid?: Prisma.Decimal | null
  category?: string
  label?: string
}

async function createPurchaseOrderPayment(data: SeedPaymentInput): Promise<PurchaseOrderPayment | null> {
  try {
    return await prisma.purchaseOrderPayment.create({ data })
  } catch (error) {
    if (isMissingPaymentMetadataError(error)) {
      const { amountExpected, dueDateDefault, ...fallback } = data
      console.warn(
        '[x-plan] purchase_order_payment.metadata-missing: run `pnpm --filter @ecom-os/x-plan prisma:migrate:deploy` to add amountExpected/amountPaid metadata columns'
      )
      const legacyData: Record<string, unknown> = {
        ...fallback,
      }
      if (dueDateDefault != null) {
        legacyData.dueDate = dueDateDefault
      }
      legacyData.amount = amountExpected
      return prisma.purchaseOrderPayment
        .create({ data: legacyData })
        .catch((fallbackError) => {
          console.error('Failed to seed supplier payment (fallback)', fallbackError)
          return null
        })
    }

    console.error('Failed to seed supplier payment', error)
    return null
  }
}

async function updatePurchaseOrderPayment(
  id: string,
  data: UpdatePaymentInput
): Promise<PurchaseOrderPayment | null> {
  try {
    return await prisma.purchaseOrderPayment.update({
      where: { id },
      data,
    })
  } catch (error) {
    if (isMissingPaymentMetadataError(error)) {
      const { amountExpected, dueDateDefault, ...fallback } = data
      console.warn(
        '[x-plan] purchase_order_payment.metadata-missing: run `pnpm --filter @ecom-os/x-plan prisma:migrate:deploy` to add amountExpected/amountPaid metadata columns'
      )
      const legacyData: Record<string, unknown> = {
        ...fallback,
      }
      if (amountExpected != null) legacyData.amount = amountExpected
      if (dueDateDefault != null) legacyData.dueDate = dueDateDefault
      return prisma.purchaseOrderPayment
        .update({ where: { id }, data: legacyData })
        .catch((fallbackError) => {
          console.error('Failed to update supplier payment (fallback)', fallbackError)
          return null
        })
    }

    console.error('Failed to update supplier payment', error)
    return null
  }
}

function deriveOrders(context: Awaited<ReturnType<typeof loadOperationsContext>>) {
  return context.purchaseOrderInputs
    .map((order) => {
      if (!context.productIndex.has(order.productId)) return null
      const profile = getLeadTimeProfile(order.productId, context.leadProfiles)
      const productNames = Array.isArray(order.batchTableRows) && order.batchTableRows.length > 1
        ? order.batchTableRows
            .map((batch) => context.productNameById.get(batch.productId) ?? '')
            .filter(Boolean)
            .slice(0, 3)
            .join(', ') + (order.batchTableRows.length > 3 ? '…' : '')
        : context.productNameById.get(order.productId) ?? ''
      return {
        derived: computePurchaseOrderDerived(order, context.productIndex, profile, context.parameters),
        input: order,
        productName: productNames,
      }
    })
    .filter((item): item is { derived: PurchaseOrderDerived; input: typeof context.purchaseOrderInputs[number]; productName: string } =>
      Boolean(item)
    )
}

async function loadFinancialData(planning: PlanningCalendar) {
  const operations = await loadOperationsContext()
  const derivedOrders = deriveOrders(operations)
  const salesPlan = computeSalesPlan(planning.salesWeeks, derivedOrders.map((item) => item.derived), {
    productIds: operations.productInputs.map((product) => product.id),
    calendar: planning.calendar,
  })
  const profitOverrideRows = await prisma.profitAndLossWeek.findMany({ orderBy: { weekNumber: 'asc' } })
  const cashOverrideRows = await prisma.cashFlowWeek.findMany({ orderBy: { weekNumber: 'asc' } })

  const profitOverrides = mapProfitAndLossWeeks(
    profitOverrideRows.filter(
      (row) => row.updatedAt != null && row.createdAt != null && row.updatedAt.getTime() > row.createdAt.getTime()
    )
  )
  const cashOverrides = mapCashFlowWeeks(
    cashOverrideRows.filter(
      (row) => row.updatedAt != null && row.createdAt != null && row.updatedAt.getTime() > row.createdAt.getTime()
    )
  )
  const profit = computeProfitAndLoss(salesPlan, operations.productIndex, operations.parameters, profitOverrides)
  const cash = computeCashFlow(
    profit.weekly,
    derivedOrders.map((item) => item.derived),
    operations.parameters,
    cashOverrides
  )
  return { operations, derivedOrders, salesPlan, profit, cash }
}

type FinancialData = Awaited<ReturnType<typeof loadFinancialData>>

async function getOpsPlanningView(planning?: PlanningCalendar, activeSegment?: YearSegment | null): Promise<{
  poTableRows: OpsInputRow[]
  batchTableRows: Array<{
    id: string
    purchaseOrderId: string
    orderCode: string
    batchCode?: string
    productId: string
    productName: string
    quantity: string
    sellingPrice: string
    manufacturingCost: string
    freightCost: string
    tariffRate: string
    tacosPercent: string
    fbaFee: string
    referralRate: string
    storagePerMonth: string
  }>
  timelineRows: OpsTimelineRow[]
  timelineOrders: PurchaseTimelineOrder[]
  payments: PurchasePaymentRow[]
  calculator: OpsPlanningCalculatorPayload
  timelineMonths: { start: string; end: string; label: string }[]
}> {
  const context = await loadOperationsContext()
  const { rawPurchaseOrders } = context

  const derivedOrders = deriveOrders(context)

  const inputRows: OpsInputRow[] = derivedOrders.map(({ input, productName }) => ({
    id: input.id,
    productId: input.productId,
    orderCode: input.orderCode,
    poDate: formatDate(input.poDate ?? null),
    productName,
    shipName: input.shipName ?? '',
    containerNumber: input.containerNumber ?? input.transportReference ?? '',
    quantity: formatNumeric(input.quantity ?? null, 0),
    pay1Date: formatDate(input.pay1Date ?? null),
    productionWeeks: formatNumeric(input.productionWeeks ?? null),
    sourceWeeks: formatNumeric(input.sourceWeeks ?? null),
    oceanWeeks: formatNumeric(input.oceanWeeks ?? null),
    finalWeeks: formatNumeric(input.finalWeeks ?? null),
    sellingPrice: formatNumeric(input.overrideSellingPrice ?? null),
    manufacturingCost: formatNumeric(input.overrideManufacturingCost ?? null),
    freightCost: formatNumeric(input.overrideFreightCost ?? null),
    tariffRate: formatPercentDecimal(input.overrideTariffRate ?? null),
    tacosPercent: formatPercentDecimal(input.overrideTacosPercent ?? null),
    fbaFee: formatNumeric(input.overrideFbaFee ?? null),
    referralRate: formatPercentDecimal(input.overrideReferralRate ?? null),
    storagePerMonth: formatNumeric(input.overrideStoragePerMonth ?? null),
    status: input.status,
    notes: input.notes ?? '',
  }))

  const timelineRows: OpsTimelineRow[] = derivedOrders.map(({ derived, productName }) => ({
    id: derived.id,
    orderCode: derived.orderCode,
    productName,
    landedUnitCost: formatCurrency(derived.landedUnitCost),
    poValue: formatCurrency(derived.plannedPoValue),
    paidAmount: formatCurrency(derived.paidAmount),
    paidPercent: formatPercent(derived.paidPercent),
    productionStart: formatDate(derived.productionStart),
    productionComplete: formatDate(derived.productionComplete),
    sourceDeparture: formatDate(derived.sourceDeparture),
    portEta: formatDate(derived.portEta),
    inboundEta: formatDate(derived.inboundEta),
    availableDate: formatDate(derived.availableDate),
    totalLeadDays: derived.totalLeadDays != null ? String(derived.totalLeadDays) : '',
    weeksUntilArrival: derived.weeksUntilArrival != null ? String(derived.weeksUntilArrival) : '',
  }))

  const timelineOrders: PurchaseTimelineOrder[] = derivedOrders.map(({ derived, productName }) =>
    createTimelineOrderFromDerived({ derived, productName })
  )

  let timelineMonths: { start: string; end: string; label: string }[] = []
  if (planning) {
    const segment = activeSegment ?? planning.yearSegments[0] ?? null
    if (segment) {
      const segmentStartDate = getCalendarDateForWeek(segment.startWeekNumber, planning.calendar)
      const segmentEndDate = getCalendarDateForWeek(segment.endWeekNumber, planning.calendar)
      if (segmentStartDate && segmentEndDate) {
        let cursor = startOfMonth(segmentStartDate)
        const finalDate = endOfMonth(segmentEndDate)
        const buckets: { start: string; end: string; label: string }[] = []
        while (cursor.getTime() <= finalDate.getTime()) {
          const bucketStart = cursor
          const bucketEnd = endOfMonth(cursor)
          buckets.push({
            start: bucketStart.toISOString(),
            end: bucketEnd.toISOString(),
            label: format(bucketStart, 'MMM'),
          })
          cursor = addMonths(cursor, 1)
        }
        timelineMonths = buckets
      }
    }
  }

  const derivedByOrderId = new Map(derivedOrders.map((item) => [item.derived.id, item.derived]))

  const payments = rawPurchaseOrders.flatMap((order) => {
    const derived = derivedByOrderId.get(order.id)
    const denominator = derived?.supplierCostTotal ?? derived?.plannedPoValue ?? 0

    return order.payments.map((payment) => {
      const amountExpectedNumeric = payment.amountExpected != null ? Number(payment.amountExpected) : null
      const amountPaidNumeric = payment.amountPaid != null ? Number(payment.amountPaid) : null
      const percentNumeric =
        payment.percentage != null
          ? Number(payment.percentage)
          : denominator > 0 && amountPaidNumeric != null
            ? amountPaidNumeric / denominator
            : null
      const dueDateIso = toIsoDate(payment.dueDate ?? null)
      const dueDateDefaultIso = toIsoDate(payment.dueDateDefault ?? payment.dueDate ?? null)
      const weekNumber = deriveIsoWeek(dueDateIso)

      return {
        id: payment.id,
        purchaseOrderId: order.id,
        orderCode: order.orderCode,
        category: payment.category ?? '',
        label: payment.label ?? buildPaymentLabel(payment.category, payment.paymentIndex),
        weekNumber,
        paymentIndex: payment.paymentIndex,
        dueDate: formatDate(dueDateIso),
        dueDateIso,
        dueDateDefault: formatDate(dueDateDefaultIso),
        dueDateDefaultIso,
        dueDateSource: payment.dueDateSource ?? 'SYSTEM',
        percentage: formatPercentDecimal(percentNumeric),
        amountExpected: formatNumeric(amountExpectedNumeric),
        amountPaid: formatNumeric(amountPaidNumeric),
      }
    })
  })

  const leadProfilesPayload = Array.from(context.leadProfiles.entries()).map(([productId, profile]) => ({
    productId,
    productionWeeks: Number(profile.productionWeeks ?? 0),
    sourceWeeks: Number(profile.sourceWeeks ?? 0),
    oceanWeeks: Number(profile.oceanWeeks ?? 0),
    finalWeeks: Number(profile.finalWeeks ?? 0),
  }))

  const batchRows = rawPurchaseOrders.flatMap((order) => {
    if (!Array.isArray(order.batchTableRows) || order.batchTableRows.length === 0) return []
    return order.batchTableRows.map((batch) => ({
      id: batch.id,
      purchaseOrderId: order.id,
      orderCode: order.orderCode,
      batchCode: batch.batchCode ?? undefined,
      productId: batch.productId,
      productName: context.productNameById.get(batch.productId) ?? '',
      quantity: formatNumeric(toNumberSafe(batch.quantity), 0),
      sellingPrice: formatNumeric(batch.overrideSellingPrice ?? order.overrideSellingPrice ?? null),
      manufacturingCost: formatNumeric(batch.overrideManufacturingCost ?? order.overrideManufacturingCost ?? null),
      freightCost: formatNumeric(batch.overrideFreightCost ?? order.overrideFreightCost ?? null),
      tariffRate: formatPercentDecimal(batch.overrideTariffRate ?? order.overrideTariffRate ?? null),
      tacosPercent: formatPercentDecimal(batch.overrideTacosPercent ?? order.overrideTacosPercent ?? null),
      fbaFee: formatNumeric(batch.overrideFbaFee ?? order.overrideFbaFee ?? null),
      referralRate: formatPercentDecimal(batch.overrideReferralRate ?? order.overrideReferralRate ?? null),
      storagePerMonth: formatNumeric(batch.overrideStoragePerMonth ?? order.overrideStoragePerMonth ?? null),
    }))
  })

  const calculator: OpsPlanningCalculatorPayload = {
    parameters: context.parameters,
    products: context.productInputs,
    leadProfiles: leadProfilesPayload,
    purchaseOrders: context.purchaseOrderInputs.map(serializePurchaseOrder),
  }

  return {
    poTableRows: inputRows,
    batchTableRows: batchRows,
    timelineRows,
    timelineOrders,
    payments,
    calculator,
    timelineMonths,
  }
}

function getSalesPlanningView(
  financialData: FinancialData,
  planning: PlanningCalendar,
  activeSegment: YearSegment | null
) {
  const context = financialData.operations
  const productList = [...context.productInputs].sort((a, b) => a.name.localeCompare(b.name))
  const weeks = buildWeekRange(activeSegment, planning.calendar)
  const weekNumbers = weeks.length
    ? weeks
    : Array.from(new Set(financialData.salesPlan.map((row) => row.weekNumber))).sort((a, b) => a - b)
  const weekSet = new Set(weekNumbers)
  const columnMeta: Record<string, { productId: string; field: string }> = {}
  const columnKeys: string[] = []
  const hasProducts = productList.length > 0
  const nestedHeaders: NestedHeaderCell[][] = hasProducts
    ? [
        ['', '', ''],
        ['Week', 'Date', 'Inbound PO'],
      ]
    : [['Week', 'Date', 'Inbound PO']]

  productList.forEach((product, productIdx) => {
    nestedHeaders[0].push({ label: product.name, colspan: SALES_METRICS.length })
    if (hasProducts) {
      nestedHeaders[1]?.push(...SALES_METRICS.map((metric) => metricHeader(metric)))
    }
    SALES_METRICS.forEach((metric) => {
      const key = columnKey(productIdx, metric)
      columnKeys.push(key)
      columnMeta[key] = { productId: product.id, field: metric }
    })
  })

  const salesLookup = new Map<string, SalesWeekDerived>()
  financialData.salesPlan.forEach((row) => {
    if (!weekSet.size || weekSet.has(row.weekNumber)) {
      salesLookup.set(`${row.productId}-${row.weekNumber}`, row)
    }
  })

  const rows = weekNumbers.map((weekNumber) => {
    const calendarDate = getCalendarDateForWeek(weekNumber, planning.calendar)
    const row: SalesRow = {
      weekNumber: String(weekNumber),
      weekDate: calendarDate ? formatDate(calendarDate) : '',
    }

    const inboundSummary: InboundSummary = new Map()
    for (const product of productList) {
      const derived = salesLookup.get(`${product.id}-${weekNumber}`)
      for (const order of derived?.arrivalOrders ?? []) {
        addToInboundSummary(inboundSummary, order.shipName, product.name, order.quantity)
      }
    }
    row.arrivalDetail = formatInboundSummary(inboundSummary)

    productList.forEach((product, productIdx) => {
      const keyRoot = `${product.id}-${weekNumber}`
      const derived = salesLookup.get(keyRoot)
      if (!row.weekDate && derived?.weekDate) {
        row.weekDate = formatDate(derived.weekDate)
      }

      SALES_METRICS.forEach((metric) => {
        const key = columnKey(productIdx, metric)
        switch (metric) {
          case 'stockStart':
            row[key] = formatNumeric(derived?.stockStart ?? null, 0)
            break
          case 'actualSales':
            row[key] = formatNumeric(derived?.actualSales ?? null, 0)
            break
          case 'forecastSales':
            row[key] = formatNumeric(derived?.forecastSales ?? null, 0)
            break
          case 'finalSales':
            row[key] = formatNumeric(derived?.finalSales ?? null, 0)
            break
          case 'finalSalesError':
            row[key] = formatPercent(derived?.finalPercentError ?? null, 1)
            break
          case 'stockWeeks':
            if (derived?.stockWeeks == null) {
              row[key] = ''
            } else if (!Number.isFinite(derived.stockWeeks)) {
              row[key] = '∞'
            } else {
              row[key] = String(derived.stockWeeks)
            }
            break
          case 'stockEnd':
            row[key] = formatNumeric(derived?.stockEnd ?? null, 0)
            break
          default:
            break
        }
      })
    })

    return row
  })

  return {
    rows,
    columnMeta,
    columnKeys,
    nestedHeaders,
    productOptions: productList.map((product) => ({ id: product.id, name: product.name })),
    stockWarningWeeks: context.parameters.stockWarningWeeks,
  }
}

type InboundSummary = Map<string, { shipName: string | null; items: Map<string, number> }>

function addToInboundSummary(
  summary: InboundSummary,
  shipName: string | null | undefined,
  productName: string,
  quantity: number
) {
  const key = shipName ?? '—'
  const entry = summary.get(key) ?? { shipName: shipName ?? null, items: new Map() }
  const current = entry.items.get(productName) ?? 0
  entry.items.set(productName, current + quantity)
  summary.set(key, entry)
}

function formatInboundSummary(summary: InboundSummary): string {
  if (!summary.size) return ''
  const lines: string[] = []
  summary.forEach((entry) => {
    const ship = entry.shipName && entry.shipName.trim().length ? entry.shipName : '—'
    const skuParts = Array.from(entry.items.entries())
      .filter(([, qty]) => Number.isFinite(qty) && qty > 0)
      .map(([name, qty]) => `(${name}, ${formatNumeric(qty, 0)})`)
    lines.push(skuParts.length ? `${ship} - ${skuParts.join(', ')}` : ship)
  })
  return lines.join('\n')
}

function getProfitAndLossView(
  financialData: FinancialData,
  activeSegment: YearSegment | null,
  activeYear: number | null
) {
  const { weekly, monthly, quarterly } = financialData.profit
  const filteredWeekly = weekly.filter((entry) => isWeekInSegment(entry.weekNumber, activeSegment))
  const monthlySummary = filterSummaryByYear(monthly, activeYear)
  const quarterlySummary = filterSummaryByYear(quarterly, activeYear)

  return {
    weekly: filteredWeekly.map((entry) => ({
      weekNumber: String(entry.weekNumber),
      weekDate: entry.weekDate ? formatDate(entry.weekDate) : '',
      units: formatNumeric(entry.units, 0),
      revenue: formatNumeric(entry.revenue),
      cogs: formatNumeric(entry.cogs),
      grossProfit: formatNumeric(entry.grossProfit),
      grossMargin: formatPercentDecimal(entry.grossMargin),
      amazonFees: formatNumeric(entry.amazonFees),
      ppcSpend: formatNumeric(entry.ppcSpend),
      fixedCosts: formatNumeric(entry.fixedCosts),
      totalOpex: formatNumeric(entry.totalOpex),
      netProfit: formatNumeric(entry.netProfit),
    })),
    monthlySummary: monthlySummary.map((entry) => ({
      periodLabel: entry.periodLabel,
      revenue: formatNumeric(entry.revenue),
      cogs: formatNumeric(entry.cogs),
      grossProfit: formatNumeric(entry.grossProfit),
      amazonFees: formatNumeric(entry.amazonFees),
      ppcSpend: formatNumeric(entry.ppcSpend),
      fixedCosts: formatNumeric(entry.fixedCosts),
      totalOpex: formatNumeric(entry.totalOpex),
      netProfit: formatNumeric(entry.netProfit),
    })),
    quarterlySummary: quarterlySummary.map((entry) => ({
      periodLabel: entry.periodLabel,
      revenue: formatNumeric(entry.revenue),
      cogs: formatNumeric(entry.cogs),
      grossProfit: formatNumeric(entry.grossProfit),
      amazonFees: formatNumeric(entry.amazonFees),
      ppcSpend: formatNumeric(entry.ppcSpend),
      fixedCosts: formatNumeric(entry.fixedCosts),
      totalOpex: formatNumeric(entry.totalOpex),
      netProfit: formatNumeric(entry.netProfit),
    })),
  }
}

function getCashFlowView(
  financialData: FinancialData,
  activeSegment: YearSegment | null,
  _activeYear: number | null
) {
  const { weekly } = financialData.cash
  const filteredWeekly = weekly.filter((entry) => isWeekInSegment(entry.weekNumber, activeSegment))

  return {
    weekly: filteredWeekly.map((entry) => ({
      weekNumber: String(entry.weekNumber),
      weekDate: entry.weekDate ? formatDate(entry.weekDate) : '',
      amazonPayout: formatNumeric(entry.amazonPayout),
      inventorySpend: formatNumeric(entry.inventorySpend),
      fixedCosts: formatNumeric(entry.fixedCosts),
      netCash: formatNumeric(entry.netCash),
      cashBalance: formatNumeric(entry.cashBalance),
    })),
  }
}

export default async function SheetPage({ params, searchParams }: SheetPageProps) {
  const [routeParams, rawSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ])
  const config = getSheetConfig(routeParams.sheet)
  if (!config) notFound()

  const [workbookStatus, planningCalendar] = await Promise.all([
    getWorkbookStatus(),
    loadPlanningCalendar(),
  ])
  const sheetStatus = workbookStatus.sheets.find((item) => item.slug === config.slug)
  const parsedSearch = rawSearchParams as Record<string, string | string[] | undefined>
  const activeYear = resolveActiveYear(parsedSearch.year, planningCalendar.yearSegments)
  const activeSegment = findYearSegment(activeYear, planningCalendar.yearSegments)
  const viewMode = resolveViewMode(parsedSearch.view)

  const controls: ReactNode[] = []
  let contextPane: React.ReactNode = null
  let wrapLayout: (node: ReactNode) => ReactNode = (node) => node
  let tabularContent: React.ReactNode = null
  let visualContent: React.ReactNode = null

  const getFinancialData = () => loadFinancialData(planningCalendar)

  switch (config.slug) {
    case '1-product-setup': {
      const view = await getProductSetupView()
      tabularContent = (
        <ProductSetupWorkspace
          products={view.products}
          operationsParameters={view.operationsParameters}
          salesParameters={view.salesParameters}
          financeParameters={view.financeParameters}
        />
      )
      // Product setup doesn't need visual mode
      visualContent = null
      break
    }
    case '2-ops-planning': {
      const view = await getOpsPlanningView(planningCalendar, activeSegment)
      tabularContent = (
        <OpsPlanningWorkspace
          poTableRows={view.poTableRows}
          batchTableRows={view.batchTableRows}
          timeline={view.timelineRows}
          timelineOrders={view.timelineOrders}
          payments={view.payments}
          calculator={view.calculator}
          timelineMonths={view.timelineMonths}
          mode="tabular"
        />
      )
      visualContent = (
        <OpsPlanningWorkspace
          poTableRows={view.poTableRows}
          batchTableRows={view.batchTableRows}
          timeline={view.timelineRows}
          timelineOrders={view.timelineOrders}
          payments={view.payments}
          calculator={view.calculator}
          timelineMonths={view.timelineMonths}
          mode="visual"
        />
      )
      break
    }
    case '3-sales-planning': {
      const data = await getFinancialData()
      const view = getSalesPlanningView(data, planningCalendar, activeSegment)
      controls.push(<SalesPlanningFocusControl key="sales-focus" productOptions={view.productOptions} />)
      wrapLayout = (node) => <SalesPlanningFocusProvider>{node}</SalesPlanningFocusProvider>
      tabularContent = (
        <SalesPlanningGrid
          rows={view.rows}
          columnMeta={view.columnMeta}
          columnKeys={view.columnKeys}
          nestedHeaders={view.nestedHeaders}
          productOptions={view.productOptions}
          stockWarningWeeks={view.stockWarningWeeks}
        />
      )
      visualContent = (
        <SalesPlanningVisual
          rows={view.rows}
          columnMeta={view.columnMeta}
          columnKeys={view.columnKeys}
          productOptions={view.productOptions}
        />
      )
      break
    }
    case '4-fin-planning-pl': {
      const data = await getFinancialData()
      const view = getProfitAndLossView(data, activeSegment, activeYear)
      tabularContent = (
        <ProfitAndLossGrid
          weekly={view.weekly}
          monthlySummary={view.monthlySummary}
          quarterlySummary={view.quarterlySummary}
        />
      )

      const pnlWeekly = limitRows(data.profit.weekly.filter((entry) => isWeekInSegment(entry.weekNumber, activeSegment)), 52)
      const pnlMonthly = limitRows(filterSummaryByYear(data.profit.monthly, activeYear), 12)
      const pnlQuarterly = limitRows(filterSummaryByYear(data.profit.quarterly, activeYear), 8)
      const metrics: FinancialMetricDefinition[] = [
        {
          key: 'revenue',
          title: 'Revenue',
          description: 'Booked revenue by period',
          helper: 'Track topline momentum using the same data that powers the P&L grid.',
          series: {
            weekly: buildTrendSeries(pnlWeekly, 'revenue'),
            monthly: buildTrendSeries(pnlMonthly, 'revenue'),
            quarterly: buildTrendSeries(pnlQuarterly, 'revenue'),
          },
          format: 'currency',
          accent: 'sky',
        },
        {
          key: 'netProfit',
          title: 'Net profit',
          description: 'Profit after COGS and OpEx',
          helper: 'Compare profitability cadence across weeks, months and quarters.',
          series: {
            weekly: buildTrendSeries(pnlWeekly, 'netProfit'),
            monthly: buildTrendSeries(pnlMonthly, 'netProfit'),
            quarterly: buildTrendSeries(pnlQuarterly, 'netProfit'),
          },
          format: 'currency',
          accent: 'emerald',
        },
      ]

      visualContent = (
        <FinancialTrendsSection
          title="Performance graphs"
          description="Visualize revenue and profitability using the grid’s underlying assumptions."
          metrics={metrics}
        />
      )
      break
    }
    case '5-fin-planning-cash-flow': {
      const data = await getFinancialData()
      const view = getCashFlowView(data, activeSegment, activeYear)
      tabularContent = (
        <CashFlowGrid weekly={view.weekly} />
      )

      const cashWeekly = limitRows(data.cash.weekly.filter((entry) => isWeekInSegment(entry.weekNumber, activeSegment)), 52)
      const cashMonthly = limitRows(filterSummaryByYear(data.cash.monthly, activeYear), 12)
      const cashQuarterly = limitRows(filterSummaryByYear(data.cash.quarterly, activeYear), 8)
      const metrics: FinancialMetricDefinition[] = [
        {
          key: 'closingCash',
          title: 'Ending cash',
          description: 'Projected balance after inflows and outflows',
          helper: 'Monitor liquidity runway alongside the detailed cash flow schedule.',
          series: {
            weekly: buildTrendSeries(cashWeekly, 'cashBalance'),
            monthly: buildTrendSeries(cashMonthly, 'closingCash'),
            quarterly: buildTrendSeries(cashQuarterly, 'closingCash'),
          },
          format: 'currency',
          accent: 'violet',
        },
        {
          key: 'netCash',
          title: 'Net cash flow',
          description: 'Net movement across the period',
          helper: 'Understand how payouts, inventory, and fixed costs combine each period.',
          series: {
            weekly: buildTrendSeries(cashWeekly, 'netCash'),
            monthly: buildTrendSeries(cashMonthly, 'netCash'),
            quarterly: buildTrendSeries(cashQuarterly, 'netCash'),
          },
          format: 'currency',
          accent: 'emerald',
        },
      ]

      visualContent = (
        <FinancialTrendsSection
          title="Cash flow charts"
          description="See how cash balances and net movement evolve over time."
          metrics={metrics}
        />
      )
      break
    }
    default: {
      const placeholder = (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <p>Implementation in progress for {config.label}. Check back soon.</p>
        </div>
      )
      tabularContent = placeholder
      visualContent = placeholder
      break
    }
  }

  // Only show view toggle if both tabular and visual content exist
  const hasVisualMode = Boolean(visualContent)
  if (hasVisualMode) {
    controls.push(<SheetViewToggle key="sheet-view-toggle" value={viewMode} />)
  }
  const headerControls = controls.length ? controls : undefined

  if (!tabularContent) {
    const fallback = (
      <VisualPlaceholder
        title={`${config.label} coming soon`}
        description={`Implementation in progress for ${config.label}. Check back soon.`}
      />
    )
    tabularContent = fallback
    visualContent = fallback
  } else if (!visualContent) {
    visualContent = (
      <VisualPlaceholder
        title="Visual view coming soon"
        description="Visualizations for this sheet are still under construction."
      />
    )
  }

  // If no visual content for this sheet, always show tabular
  const selectedContent = (hasVisualMode && viewMode === 'visual') ? visualContent : tabularContent

  const meta = {
    rows: sheetStatus?.recordCount,
    updated: sheetStatus?.lastUpdated,
  }

  const layout = (
    <WorkbookLayout
      sheets={workbookStatus.sheets}
      activeSlug={config.slug}
      planningYears={planningCalendar.yearSegments}
      activeYear={activeYear}
      meta={meta}
      contextPane={contextPane}
      headerControls={headerControls}
    >
      {selectedContent}
    </WorkbookLayout>
  )

  return wrapLayout(layout)
}
