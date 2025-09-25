import { notFound } from 'next/navigation'
import { OpsPlanningWorkspace } from '@/components/sheets/ops-planning-workspace'
import { ProductSetupGrid } from '@/components/sheets/product-setup-grid'
import { ProductSetupParametersPanel } from '@/components/sheets/product-setup-panels'
import { ProductSalesTermsGrid } from '@/components/sheets/product-sales-terms-grid'
import { SalesPlanningGrid } from '@/components/sheets/sales-planning-grid'
import { ProfitAndLossGrid } from '@/components/sheets/fin-planning-pl-grid'
import { CashFlowGrid } from '@/components/sheets/fin-planning-cash-grid'
import { DashboardSheet } from '@/components/sheets/dashboard'
import type { OpsInputRow } from '@/components/sheets/ops-planning-grid'
import type { OpsTimelineRow } from '@/components/sheets/ops-planning-timeline'
import type { PurchasePaymentRow } from '@/components/sheets/purchase-payments-grid'
import type { OpsPlanningCalculatorPayload, PurchaseOrderSerialized } from '@/components/sheets/ops-planning-workspace'
import prisma from '@/lib/prisma'
import { getSheetConfig } from '@/lib/sheets'
import { getWorkbookStatus } from '@/lib/workbook'
import { WorkbookLayout } from '@/components/workbook-layout'
import {
  mapProducts,
  mapLeadStageTemplates,
  mapLeadOverrides,
  mapBusinessParameters,
  mapPurchaseOrders,
  mapSalesWeeks,
  mapProfitAndLossWeeks,
  mapCashFlowWeeks,
  type ProductRow,
  type LeadStageTemplateRow,
  type LeadTimeOverrideRow,
  type BusinessParameterRow,
  type PurchaseOrderRow,
  type PurchaseOrderPaymentRow,
  type SalesWeekRow,
  type ProfitAndLossWeekRow,
  type CashFlowWeekRow,
  type MonthlySummaryRow,
  type QuarterlySummaryRow,
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
  computeDashboardSummary,
  type SalesWeekDerived,
  type PurchaseOrderDerived,
  type PurchaseOrderInput,
  type LeadTimeProfile,
} from '@/lib/calculations'

const SALES_METRICS = ['stockStart', 'actualSales', 'forecastSales', 'finalSales', 'stockWeeks', 'stockEnd'] as const
type SalesMetric = (typeof SALES_METRICS)[number]

type SalesRow = {
  weekNumber: string
  weekDate: string
  [key: string]: string
}

type ProductSummaryRow = Pick<ProductRow, 'id' | 'name' | 'sku' | 'isActive'>
type PurchaseOrderWithRelations = PurchaseOrderRow & {
  payments: PurchaseOrderPaymentRow[]
  product: Pick<ProductRow, 'id' | 'sku' | 'name'>
}
type ProductSalesTermRow = {
  id: string
  productId: string
  startDate: Date
  endDate: Date | null
  sellingPrice: number
  tacosPercent: number
  fbaFee: number
  referralRate: number
  storagePerMonth: number
  product: { id: string; sku: string | null; name: string }
}
type ProductCostTerm = {
  startDate: Date
  endDate: Date | null
  sellingPrice: number | { toNumber(): number }
  tacosPercent: number | { toNumber(): number }
  fbaFee: number | { toNumber(): number }
  referralRate: number | { toNumber(): number }
  storagePerMonth: number | { toNumber(): number }
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatDisplayDate(value: Date | number | string | null | undefined): string {
  if (value == null) return ''
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  if (!date || Number.isNaN(date.getTime())) return ''
  return dateFormatter.format(date).replace(',', '')
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return ''
  return formatDisplayDate(value)
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

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function formatInputDate(value: Date | null | undefined) {
  if (!value) return ''
  const iso = value.toISOString()
  return iso.slice(0, 10)
}

function coerceDate(value: Date | string) {
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function selectActiveSalesTerm(
  terms: ProductCostTerm[] | undefined,
  referenceDate: Date
): ProductCostTerm | null {
  if (!terms || terms.length === 0) return null
  let candidate: ProductCostTerm | null = null
  const referenceTime = referenceDate.getTime()

  for (const term of terms) {
    const start = coerceDate(term.startDate)
    if (!start) continue
    const end = term.endDate ? coerceDate(term.endDate) : null
    const startTime = start.getTime()
    const endTime = end ? end.getTime() : Number.POSITIVE_INFINITY
    if (startTime <= referenceTime && referenceTime <= endTime) {
      if (!candidate || coerceDate(candidate.startDate)!.getTime() < startTime) {
        candidate = term
      }
    }
  }

  if (candidate) return candidate

  return terms
    .slice()
    .sort((a, b) => {
      const aStart = coerceDate(a.startDate)?.getTime() ?? 0
      const bStart = coerceDate(b.startDate)?.getTime() ?? 0
      return aStart - bStart
    })
    .pop() ?? null
}

function serializePurchaseOrder(order: PurchaseOrderInput): PurchaseOrderSerialized {
  return {
    id: order.id,
    orderCode: order.orderCode,
    productId: order.productId,
    quantity: Number(order.quantity ?? 0),
    productionWeeks: order.productionWeeks ?? null,
    sourcePrepWeeks: order.sourcePrepWeeks ?? null,
    oceanWeeks: order.oceanWeeks ?? null,
    finalMileWeeks: order.finalMileWeeks ?? null,
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
        amount: payment.amount ?? null,
        paymentDate: serializeDate(payment.paymentDate),
        status: payment.status ?? null,
      })) ?? [],
    overrideSellingPrice: order.overrideSellingPrice ?? null,
    overrideManufacturingCost: order.overrideManufacturingCost ?? null,
    overrideFreightCost: order.overrideFreightCost ?? null,
    overrideTariffRate: order.overrideTariffRate ?? null,
    overrideTacosPercent: order.overrideTacosPercent ?? null,
    overrideFbaFee: order.overrideFbaFee ?? null,
    overrideReferralRate: order.overrideReferralRate ?? null,
    overrideStoragePerMonth: order.overrideStoragePerMonth ?? null,
  }
}

type SheetPageProps = {
  params: Promise<{ sheet: string }>
}

type BusinessParameterView = {
  id: string
  label: string
  value: string
  type: 'numeric' | 'text'
}

type NestedHeaderCell = string | { label: string; colspan: number; rowspan?: number }

type ProfitAndLossAggregates = ReturnType<typeof computeProfitAndLoss>
type CashFlowAggregates = ReturnType<typeof computeCashFlow>
type DashboardSummaryPayload = ReturnType<typeof computeDashboardSummary>

type DashboardView = {
  overview: {
    revenueYTD: number
    netProfitYTD: number
    cashBalance: number
    netMargin: number
  }
  pipeline: DashboardSummaryPayload['pipeline']
  inventory: Array<{
    productName: string
    stockEnd: number
    stockWeeks: number
  }>
  rollups: {
    profitAndLoss: {
      monthly: ProfitAndLossAggregates['monthly']
      quarterly: ProfitAndLossAggregates['quarterly']
    }
    cashFlow: {
      monthly: CashFlowAggregates['monthly']
      quarterly: CashFlowAggregates['quarterly']
    }
  }
}

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

function metricLabel(metric: SalesMetric) {
  switch (metric) {
    case 'stockStart':
      return 'Stock Start'
    case 'actualSales':
      return 'Actual Sales'
    case 'forecastSales':
      return 'Fcst Sales'
    case 'finalSales':
      return 'Final Sales'
    case 'stockWeeks':
      return 'Stock (Weeks)'
    case 'stockEnd':
      return 'Stock End'
    default:
      return metric
  }
}

async function getProductSetupView() {
  const [products, businessParameters, salesTerms] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        isActive: true,
      },
    }) as Promise<ProductSummaryRow[]>,
    prisma.businessParameter.findMany({
      orderBy: { label: 'asc' },
      select: { id: true, label: true, valueNumeric: true, valueText: true },
    }) as Promise<BusinessParameterRow[]>,
    prisma.productSalesTerm.findMany({
      orderBy: [{ startDate: 'asc' }],
      select: {
        id: true,
        productId: true,
        startDate: true,
        endDate: true,
        sellingPrice: true,
        tacosPercent: true,
        fbaFee: true,
        referralRate: true,
        storagePerMonth: true,
        product: { select: { id: true, sku: true, name: true } },
      },
    }) as Promise<ProductSalesTermRow[]>,
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

  const productOptions = products
    .map((product) => ({ id: product.id, sku: product.sku ?? '', name: product.name }))
    .sort((a, b) => a.sku.localeCompare(b.sku))

  const toNumber = (value: number | { toNumber(): number } | null | undefined) => {
    if (value == null) return 0
    if (typeof value === 'number') return value
    if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
      return value.toNumber()
    }
    const numeric = Number(value)
    return Number.isNaN(numeric) ? 0 : numeric
  }

  const salesTermRows = salesTerms.map((term) => ({
    id: term.id,
    productId: term.productId,
    productSku: term.product?.sku?.trim() ?? '',
    productName: term.product?.name ?? '',
    startDate: formatInputDate(term.startDate),
    endDate: formatInputDate(term.endDate),
    sellingPrice: toNumber(term.sellingPrice),
    tacosPercent: toNumber(term.tacosPercent),
    fbaFee: toNumber(term.fbaFee),
    referralRate: toNumber(term.referralRate),
    storagePerMonth: toNumber(term.storagePerMonth),
  }))

  return {
    products: productRows,
    productOptions,
    salesTerms: salesTermRows,
    operationsParameters,
    salesParameters,
    financeParameters,
  }
}

async function loadOperationsContext() {
  const [products, leadStages, overrides, businessParameters, purchaseOrders] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        isActive: true,
        sellingPrice: true,
        manufacturingCost: true,
        freightCost: true,
        tariffRate: true,
        tacosPercent: true,
        fbaFee: true,
        amazonReferralRate: true,
        storagePerMonth: true,
        salesTerms: {
          orderBy: { startDate: 'asc' },
          select: {
            startDate: true,
            endDate: true,
            sellingPrice: true,
            tacosPercent: true,
            fbaFee: true,
            referralRate: true,
            storagePerMonth: true,
          },
        },
      },
    }) as Promise<Array<ProductRow & { salesTerms: ProductCostTerm[] }>>,
    prisma.leadStageTemplate.findMany({
      orderBy: { sequence: 'asc' },
      select: { id: true, label: true, defaultWeeks: true, sequence: true },
    }) as Promise<LeadStageTemplateRow[]>,
    prisma.leadTimeOverride.findMany({
      select: { productId: true, stageTemplateId: true, durationWeeks: true },
    }) as Promise<LeadTimeOverrideRow[]>,
    prisma.businessParameter.findMany({
      orderBy: { label: 'asc' },
      select: { id: true, label: true, valueNumeric: true, valueText: true },
    }) as Promise<BusinessParameterRow[]>,
    prisma.purchaseOrder.findMany({
      orderBy: { orderCode: 'asc' },
      select: {
        id: true,
        orderCode: true,
        productId: true,
        quantity: true,
        productionWeeks: true,
        sourcePrepWeeks: true,
        oceanWeeks: true,
        finalMileWeeks: true,
        pay1Percent: true,
        pay2Percent: true,
        pay3Percent: true,
        pay1Amount: true,
        pay2Amount: true,
        pay3Amount: true,
        pay1Date: true,
        pay2Date: true,
        pay3Date: true,
        productionStart: true,
        productionComplete: true,
        sourceDeparture: true,
        transportReference: true,
        portEta: true,
        inboundEta: true,
        availableDate: true,
        totalLeadDays: true,
        status: true,
        statusIcon: true,
        notes: true,
        overrideSellingPrice: true,
        overrideManufacturingCost: true,
        overrideFreightCost: true,
        overrideTariffRate: true,
        overrideTacosPercent: true,
        overrideFbaFee: true,
        overrideReferralRate: true,
        overrideStoragePerMonth: true,
        payments: {
          orderBy: { paymentIndex: 'asc' },
          select: {
            id: true,
            paymentIndex: true,
            percentage: true,
            amount: true,
            dueDate: true,
            status: true,
          },
        },
        product: { select: { id: true, sku: true, name: true } },
      },
    }) as Promise<PurchaseOrderWithRelations[]>,
  ])

  const today = new Date()
  const normalizedProducts: ProductRow[] = products.map((product) => {
    const activeTerm = selectActiveSalesTerm(product.salesTerms, today)
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      isActive: product.isActive,
      sellingPrice: activeTerm?.sellingPrice ?? product.sellingPrice,
      manufacturingCost: product.manufacturingCost,
      freightCost: product.freightCost,
      tariffRate: product.tariffRate,
      tacosPercent: activeTerm?.tacosPercent ?? product.tacosPercent,
      fbaFee: activeTerm?.fbaFee ?? product.fbaFee,
      amazonReferralRate: activeTerm?.referralRate ?? product.amazonReferralRate,
      storagePerMonth: activeTerm?.storagePerMonth ?? product.storagePerMonth,
    }
  })

  const productInputs = mapProducts(normalizedProducts)
  const productIndex = buildProductCostIndex(productInputs)
  const productNameById = new Map(products.map((product) => [product.id, product.name]))
  const productSkuById = new Map(products.map((product) => [product.id, product.sku ?? '']))
  const leadProfiles = buildLeadTimeProfiles(
    mapLeadStageTemplates(leadStages),
    mapLeadOverrides(overrides),
    productInputs.map((product) => product.id)
  )
  const parameters = normalizeBusinessParameters(mapBusinessParameters(businessParameters))
  const purchaseOrderInputs = mapPurchaseOrders(purchaseOrders)

  return {
    productInputs,
    productIndex,
    productNameById,
    productSkuById,
    leadProfiles,
    parameters,
    purchaseOrderInputs,
    rawPurchaseOrders: purchaseOrders,
  }
}

function deriveOrders(context: Awaited<ReturnType<typeof loadOperationsContext>>) {
  return context.purchaseOrderInputs
    .map((order) => {
      const product = context.productIndex.get(order.productId)
      if (!product) return null
      const profile = getLeadTimeProfile(order.productId, context.leadProfiles)
      return {
        derived: computePurchaseOrderDerived(order, product, profile, context.parameters),
        input: order,
        productName: context.productNameById.get(order.productId) ?? '',
      }
    })
    .filter((item): item is { derived: PurchaseOrderDerived; input: typeof context.purchaseOrderInputs[number]; productName: string } =>
      Boolean(item)
    )
}

async function getOpsPlanningView(): Promise<{
  inputRows: OpsInputRow[]
  timelineRows: OpsTimelineRow[]
  payments: PurchasePaymentRow[]
  calculator: OpsPlanningCalculatorPayload
}> {
  const context = await loadOperationsContext()
  const { rawPurchaseOrders } = context

  const derivedOrders = deriveOrders(context)

  const inputRows: OpsInputRow[] = derivedOrders.map(({ input, productName }) => {
    const quantity = Number(input.quantity ?? 0)
    const manufacturingOverride =
      input.overrideManufacturingCost != null && Number.isFinite(input.overrideManufacturingCost)
        ? Number(input.overrideManufacturingCost)
        : null
    const freightOverride =
      input.overrideFreightCost != null && Number.isFinite(input.overrideFreightCost)
        ? Number(input.overrideFreightCost)
        : null
    const manufacturingTotal = manufacturingOverride != null ? manufacturingOverride * quantity : null
    const freightTotal = freightOverride != null ? freightOverride * quantity : null

    return {
      id: input.id,
      productId: input.productId,
      productSku: context.productSkuById.get(input.productId) ?? '',
      orderCode: input.orderCode,
      transportReference: input.transportReference ?? '',
      productName,
      quantity: formatNumeric(input.quantity ?? null, 0),
      pay1Date: formatDate(input.pay1Date ?? null),
      productionWeeks: formatNumeric(input.productionWeeks ?? null),
      sourcePrepWeeks: formatNumeric(input.sourcePrepWeeks ?? null),
      oceanWeeks: formatNumeric(input.oceanWeeks ?? null),
      finalMileWeeks: formatNumeric(input.finalMileWeeks ?? null),
      manufacturingCost: formatNumeric(manufacturingTotal),
      freightCost: formatNumeric(freightTotal),
      tariffRate: formatPercentDecimal(input.overrideTariffRate ?? null),
      status: input.status,
      notes: input.notes ?? '',
    }
  })

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

  const derivedByOrderId = new Map(derivedOrders.map((item) => [item.derived.id, item.derived]))

  const payments = rawPurchaseOrders.flatMap((order) => {
    const derived = derivedByOrderId.get(order.id)
    const poValue = derived?.plannedPoValue ?? 0

    return order.payments.map((payment) => {
      const amountNumeric = payment.amount != null ? Number(payment.amount) : null
      const percentNumeric = payment.percentage != null
        ? Number(payment.percentage)
        : poValue > 0 && amountNumeric != null
        ? amountNumeric / poValue
        : null

      return {
        id: payment.id,
        purchaseOrderId: order.id,
        orderCode: order.orderCode,
        paymentIndex: payment.paymentIndex,
        paymentDate: formatDate(payment.dueDate ?? null),
        percentage: formatPercentDecimal(percentNumeric),
        amount: formatNumeric(amountNumeric),
        status: payment.status ?? '',
      }
    })
  })

  const leadProfilesPayload = Array.from(context.leadProfiles.entries()).map(([productId, profile]) => ({
    productId,
    productionWeeks: Number(profile.productionWeeks ?? 0),
    sourcePrepWeeks: Number(profile.sourcePrepWeeks ?? 0),
    oceanWeeks: Number(profile.oceanWeeks ?? 0),
    finalMileWeeks: Number(profile.finalMileWeeks ?? 0),
  }))

  const calculator: OpsPlanningCalculatorPayload = {
    parameters: context.parameters,
    products: context.productInputs,
    leadProfiles: leadProfilesPayload,
    purchaseOrders: context.purchaseOrderInputs.map(serializePurchaseOrder),
  }

  return {
    inputRows,
    timelineRows,
    payments,
    calculator,
  }
}

async function getSalesPlanningView() {
  const context = await loadOperationsContext()
  const derivedOrders = deriveOrders(context).map((item) => item.derived)
  const salesWeekInputs = mapSalesWeeks(
    (await prisma.salesWeek.findMany({
      select: {
        id: true,
        productId: true,
        weekNumber: true,
        weekDate: true,
        stockStart: true,
        actualSales: true,
        forecastSales: true,
        finalSales: true,
        stockWeeks: true,
        stockEnd: true,
      },
    })) as SalesWeekRow[]
  )
  const salesPlan = computeSalesPlan(salesWeekInputs, derivedOrders)

  const productList = [...context.productInputs].sort((a, b) => a.name.localeCompare(b.name))
  const weeks = Array.from({ length: 52 }, (_, index) => index + 1)
  const columnMeta: Record<string, { productId: string; field: string }> = {}
  const columnKeys: string[] = []
  const hasProducts = productList.length > 0
  const nestedHeaders: NestedHeaderCell[][] = hasProducts
    ? [
        [
          { label: 'Week', colspan: 1, rowspan: 2 },
          { label: 'Date', colspan: 1, rowspan: 2 },
        ],
        [],
      ]
    : [
        [
          { label: 'Week', colspan: 1 },
          { label: 'Date', colspan: 1 },
        ],
      ]

  productList.forEach((product, productIdx) => {
    nestedHeaders[0].push({ label: product.name, colspan: SALES_METRICS.length })
    if (hasProducts) {
      nestedHeaders[1]?.push(...SALES_METRICS.map((metric) => metricLabel(metric)))
    }
    SALES_METRICS.forEach((metric) => {
      const key = columnKey(productIdx, metric)
      columnKeys.push(key)
      columnMeta[key] = { productId: product.id, field: metric }
    })
  })

  const salesLookup = new Map<string, SalesWeekDerived>()
  salesPlan.forEach((row) => {
    salesLookup.set(`${row.productId}-${row.weekNumber}`, row)
  })

  const rows = weeks.map((weekNumber) => {
    const row: SalesRow = {
      weekNumber: String(weekNumber),
      weekDate: '',
    }

    productList.forEach((product, productIdx) => {
      const keyRoot = `${product.id}-${weekNumber}`
      const derived = salesLookup.get(keyRoot)
      if (derived && !row.weekDate && derived.weekDate) {
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
          case 'stockWeeks':
            row[key] = derived?.stockWeeks != null ? String(derived.stockWeeks) : ''
            break
          case 'stockEnd':
            row[key] = formatNumeric(derived?.stockEnd ?? null, 0)
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

async function getProfitAndLossView() {
  const context = await loadOperationsContext()
  const derivedOrders = deriveOrders(context)
  const salesPlan = computeSalesPlan(
    mapSalesWeeks(
      (await prisma.salesWeek.findMany({
        select: {
          id: true,
          productId: true,
          weekNumber: true,
          weekDate: true,
          stockStart: true,
          actualSales: true,
          forecastSales: true,
          finalSales: true,
          stockWeeks: true,
          stockEnd: true,
        },
      })) as SalesWeekRow[]
    ),
    derivedOrders.map((item) => item.derived)
  )
  const overrides = mapProfitAndLossWeeks(
    (await prisma.profitAndLossWeek.findMany({
      orderBy: { weekNumber: 'asc' },
      select: {
        id: true,
        weekNumber: true,
        weekDate: true,
        units: true,
        revenue: true,
        cogs: true,
        grossProfit: true,
        grossMargin: true,
        amazonFees: true,
        ppcSpend: true,
        fixedCosts: true,
        totalOpex: true,
        netProfit: true,
      },
    })) as ProfitAndLossWeekRow[]
  )

  const { weekly, monthly, quarterly } = computeProfitAndLoss(
    salesPlan,
    context.productIndex,
    context.parameters,
    overrides
  )

  return {
    weekly: weekly.map((entry) => ({
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
    monthlySummary: monthly.map((entry) => ({
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
    quarterlySummary: quarterly.map((entry) => ({
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

async function getCashFlowView() {
  const context = await loadOperationsContext()
  const derivedOrders = deriveOrders(context)
  const salesPlan = computeSalesPlan(
    mapSalesWeeks(
      (await prisma.salesWeek.findMany({
        select: {
          id: true,
          productId: true,
          weekNumber: true,
          weekDate: true,
          stockStart: true,
          actualSales: true,
          forecastSales: true,
          finalSales: true,
          stockWeeks: true,
          stockEnd: true,
        },
      })) as SalesWeekRow[]
    ),
    derivedOrders.map((item) => item.derived)
  )
  const pnlOverrides = mapProfitAndLossWeeks(
    (await prisma.profitAndLossWeek.findMany({
      orderBy: { weekNumber: 'asc' },
      select: {
        id: true,
        weekNumber: true,
        weekDate: true,
        units: true,
        revenue: true,
        cogs: true,
        grossProfit: true,
        grossMargin: true,
        amazonFees: true,
        ppcSpend: true,
        fixedCosts: true,
        totalOpex: true,
        netProfit: true,
      },
    })) as ProfitAndLossWeekRow[]
  )
  const {
    weekly: pnlWeekly,
    monthly: pnlMonthly,
    quarterly: pnlQuarterly,
  } = computeProfitAndLoss(
    salesPlan,
    context.productIndex,
    context.parameters,
    pnlOverrides
  )

  const cashOverrides = mapCashFlowWeeks(
    (await prisma.cashFlowWeek.findMany({
      orderBy: { weekNumber: 'asc' },
      select: {
        id: true,
        weekNumber: true,
        weekDate: true,
        amazonPayout: true,
        inventorySpend: true,
        fixedCosts: true,
        netCash: true,
        cashBalance: true,
      },
    })) as CashFlowWeekRow[]
  )

  const { weekly, monthly, quarterly } = computeCashFlow(
    pnlWeekly,
    derivedOrders.map((item) => item.derived),
    context.parameters,
    cashOverrides
  )

  return {
    weekly: weekly.map((entry) => ({
      weekNumber: String(entry.weekNumber),
      weekDate: entry.weekDate ? formatDate(entry.weekDate) : '',
      amazonPayout: formatNumeric(entry.amazonPayout),
      inventorySpend: formatNumeric(entry.inventorySpend),
      fixedCosts: formatNumeric(entry.fixedCosts),
      netCash: formatNumeric(entry.netCash),
      cashBalance: formatNumeric(entry.cashBalance),
    })),
    monthlySummary: monthly.map((entry) => ({
      periodLabel: entry.periodLabel,
      amazonPayout: formatNumeric(entry.amazonPayout),
      inventorySpend: formatNumeric(entry.inventorySpend),
      fixedCosts: formatNumeric(entry.fixedCosts),
      netCash: formatNumeric(entry.netCash),
      closingCash: formatNumeric(entry.closingCash),
    })),
    quarterlySummary: quarterly.map((entry) => ({
      periodLabel: entry.periodLabel,
      amazonPayout: formatNumeric(entry.amazonPayout),
      inventorySpend: formatNumeric(entry.inventorySpend),
      fixedCosts: formatNumeric(entry.fixedCosts),
      netCash: formatNumeric(entry.netCash),
      closingCash: formatNumeric(entry.closingCash),
    })),
  }
}

async function getDashboardView(): Promise<DashboardView> {
  const context = await loadOperationsContext()
  const derivedOrders = deriveOrders(context)
  const salesPlan = computeSalesPlan(
    mapSalesWeeks(
      (await prisma.salesWeek.findMany({
        select: {
          id: true,
          productId: true,
          weekNumber: true,
          weekDate: true,
          stockStart: true,
          actualSales: true,
          forecastSales: true,
          finalSales: true,
          stockWeeks: true,
          stockEnd: true,
        },
      })) as SalesWeekRow[]
    ),
    derivedOrders.map((item) => item.derived)
  )
  const pnlOverrides = mapProfitAndLossWeeks(
    (await prisma.profitAndLossWeek.findMany({
      orderBy: { weekNumber: 'asc' },
      select: {
        id: true,
        weekNumber: true,
        weekDate: true,
        units: true,
        revenue: true,
        cogs: true,
        grossProfit: true,
        grossMargin: true,
        amazonFees: true,
        ppcSpend: true,
        fixedCosts: true,
        totalOpex: true,
        netProfit: true,
      },
    })) as ProfitAndLossWeekRow[]
  )
  const { weekly: pnlWeekly, monthly: pnlMonthly, quarterly: pnlQuarterly } = computeProfitAndLoss(
    salesPlan,
    context.productIndex,
    context.parameters,
    pnlOverrides
  )

  const cashOverrides = mapCashFlowWeeks(
    (await prisma.cashFlowWeek.findMany({
      orderBy: { weekNumber: 'asc' },
      select: {
        id: true,
        weekNumber: true,
        weekDate: true,
        amazonPayout: true,
        inventorySpend: true,
        fixedCosts: true,
        netCash: true,
        cashBalance: true,
      },
    })) as CashFlowWeekRow[]
  )
  const {
    weekly: cashWeekly,
    monthly: cashMonthly,
    quarterly: cashQuarterly,
  } = computeCashFlow(
    pnlWeekly,
    derivedOrders.map((item) => item.derived),
    context.parameters,
    cashOverrides
  )

  const dashboard = computeDashboardSummary(
    pnlWeekly,
    cashWeekly,
    derivedOrders.map((item) => item.derived),
    salesPlan,
    context.productIndex
  )

  return {
    overview: {
      revenueYTD: dashboard.revenueYtd,
      netProfitYTD: dashboard.netProfitYtd,
      cashBalance: dashboard.cashBalance,
      netMargin: dashboard.netMarginPercent,
    },
    pipeline: dashboard.pipeline,
    inventory: dashboard.inventory.map((item) => ({
      productName: item.productName,
      stockEnd: item.stockEnd,
      stockWeeks: item.stockWeeks,
    })),
    rollups: {
      profitAndLoss: {
        monthly: pnlMonthly,
        quarterly: pnlQuarterly,
      },
      cashFlow: {
        monthly: cashMonthly,
        quarterly: cashQuarterly,
      },
    },
  }
}

export default async function SheetPage({ params }: SheetPageProps) {
  const { sheet } = await params
  const config = getSheetConfig(sheet)
  if (!config) notFound()

  const workbookStatus = await getWorkbookStatus()
  const sheetStatus = workbookStatus.sheets.find((item) => item.slug === config.slug)

  let content: React.ReactNode = null
  let contextPane: React.ReactNode = null

  switch (config.slug) {
    case '1-product-setup': {
      const view = await getProductSetupView()
      const parameterSections = [
        {
          key: 'operations',
          title: 'Operations',
          description: 'Tune supply chain defaults that feed ordering and lead time models.',
          parameters: view.operationsParameters,
        },
        {
          key: 'sales',
          title: 'Sales',
          description: 'Set demand-planning thresholds such as stock warnings and forecast assumptions.',
          parameters: view.salesParameters,
        },
        {
          key: 'finance',
          title: 'Finance',
          description: 'Set the cash assumptions that flow into every financial plan.',
          parameters: view.financeParameters,
        },
      ] as const

      content = (
        <div className="space-y-6">
          <ProductSetupGrid products={view.products} />
          <ProductSalesTermsGrid terms={view.salesTerms} products={view.productOptions} />
          {parameterSections.map((section) => (
            <ProductSetupParametersPanel
              key={section.key}
              title={section.title}
              description={section.description}
              parameters={section.parameters}
            />
          ))}
        </div>
      )
      contextPane = null
      break
    }
    case '2-ops-planning': {
      const view = await getOpsPlanningView()
      content = (
        <OpsPlanningWorkspace
          inputs={view.inputRows}
          timeline={view.timelineRows}
          payments={view.payments}
          calculator={view.calculator}
        />
      )
      break
    }
    case '3-sales-planning': {
      const view = await getSalesPlanningView()
      content = (
        <SalesPlanningGrid
          rows={view.rows}
          columnMeta={view.columnMeta}
          columnKeys={view.columnKeys}
          nestedHeaders={view.nestedHeaders}
          productOptions={view.productOptions}
          stockWarningWeeks={view.stockWarningWeeks}
        />
      )
      break
    }
    case '4-fin-planning-pl': {
      const view = await getProfitAndLossView()
      content = (
        <ProfitAndLossGrid
          weekly={view.weekly}
          monthlySummary={view.monthlySummary}
          quarterlySummary={view.quarterlySummary}
        />
      )
      break
    }
    case '5-fin-planning-cash-flow': {
      const view = await getCashFlowView()
      content = (
        <CashFlowGrid
          weekly={view.weekly}
          monthlySummary={view.monthlySummary}
          quarterlySummary={view.quarterlySummary}
        />
      )
      break
    }
    case '6-dashboard': {
      const view = await getDashboardView()
      content = <DashboardSheet data={view} />
      break
    }
    default:
      content = (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <p>Implementation in progress for {config.label}. Check back soon.</p>
        </div>
      )
  }

  const meta = {
    rows: sheetStatus?.recordCount,
    updated: sheetStatus?.lastUpdated,
  }

  return (
    <WorkbookLayout
      sheets={workbookStatus.sheets}
      activeSlug={config.slug}
      meta={meta}
      ribbon={
        <a
          href="/import"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Import / Export
        </a>
      }
      contextPane={contextPane}
    >
      {content}
    </WorkbookLayout>
  )
}
