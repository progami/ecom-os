import { notFound } from 'next/navigation'
import { ProductSetupGrid } from '@/components/sheets/product-setup-grid'
import { OpsPlanningWorkspace } from '@/components/sheets/ops-planning-workspace'
import { ProductSetupFinancePanel } from '@/components/sheets/product-setup-panels'
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
} from '@/lib/calculations/adapters'
import {
  computeProductCostSummary,
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
        dueDate: serializeDate(payment.dueDate),
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

const FINANCE_PARAMETER_LABELS = new Set(
  ['amazon payout delay (weeks)', 'starting cash', 'weekly fixed costs'].map((label) => label.toLowerCase())
)

function isFinanceParameterLabel(label: string) {
  return FINANCE_PARAMETER_LABELS.has(label.trim().toLowerCase())
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
  const [products, leadStages, businessParameters] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: 'asc' } }),
    prisma.leadStageTemplate.findMany({ orderBy: { sequence: 'asc' } }),
    prisma.businessParameter.findMany({ orderBy: { label: 'asc' } }),
  ])

  const parameterInputs = mapBusinessParameters(businessParameters)

  const excludedNames = new Set(
    [...leadStages.map((stage) => stage.label.toLowerCase()), ...parameterInputs.map((parameter) => parameter.label.toLowerCase())]
  )

  const productInputs = mapProducts(
    products.filter((product) => {
      const sku = product.sku?.trim()
      return product.isActive && sku && sku.length > 0
    })
  )

  const filteredProducts = productInputs.filter((product) => !excludedNames.has(product.name.toLowerCase()))
  const productSummaries = filteredProducts.map((product) => computeProductCostSummary(product))

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

  return {
    products: productSummaries.map((summary) => ({
      id: summary.id,
      name: summary.name,
      sellingPrice: formatNumeric(summary.sellingPrice),
      manufacturingCost: formatNumeric(summary.manufacturingCost),
      freightCost: formatNumeric(summary.freightCost),
      tariffRate: formatPercentDecimal(summary.tariffRate),
      tacosPercent: formatPercentDecimal(summary.tacosPercent),
      fbaFee: formatNumeric(summary.fbaFee),
      amazonReferralRate: formatPercentDecimal(summary.amazonReferralRate),
      storagePerMonth: formatNumeric(summary.storagePerMonth),
      landedCost: formatNumeric(summary.landedUnitCost),
      grossContribution: formatNumeric(summary.grossContribution),
      grossMarginPercent: summary.grossMarginPercent.toFixed(4),
    })),
    financeParameters,
  }
}

async function loadOperationsContext() {
  const [products, leadStages, overrides, businessParameters, purchaseOrders] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: 'asc' } }),
    prisma.leadStageTemplate.findMany({ orderBy: { sequence: 'asc' } }),
    prisma.leadTimeOverride.findMany(),
    prisma.businessParameter.findMany({ orderBy: { label: 'asc' } }),
    prisma.purchaseOrder.findMany({
      orderBy: { orderCode: 'asc' },
      include: { product: true, payments: { orderBy: { paymentIndex: 'asc' } } },
    }),
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
  const purchaseOrderInputs = mapPurchaseOrders(purchaseOrders)

  return {
    productInputs,
    productIndex,
    productNameById,
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

  const inputRows: OpsInputRow[] = derivedOrders.map(({ input, productName }) => ({
    id: input.id,
    productId: input.productId,
    orderCode: input.orderCode,
    productName,
    quantity: formatNumeric(input.quantity ?? null, 0),
    pay1Date: formatDate(input.pay1Date ?? null),
    productionWeeks: formatNumeric(input.productionWeeks ?? null),
    sourcePrepWeeks: formatNumeric(input.sourcePrepWeeks ?? null),
    oceanWeeks: formatNumeric(input.oceanWeeks ?? null),
    finalMileWeeks: formatNumeric(input.finalMileWeeks ?? null),
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
        dueDate: formatDate(payment.dueDate ?? null),
        percentage: formatPercentDecimal(percentNumeric),
        amount: formatNumeric(amountNumeric),
        status: payment.status,
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
  const salesWeekInputs = mapSalesWeeks(await prisma.salesWeek.findMany())
  const salesPlan = computeSalesPlan(salesWeekInputs, derivedOrders)

  const productList = [...context.productInputs].sort((a, b) => a.name.localeCompare(b.name))
  const weeks = Array.from({ length: 52 }, (_, index) => index + 1)
  const columnMeta: Record<string, { productId: string; field: string }> = {}
  const columnKeys: string[] = []
  const nestedHeaders: (string | { label: string; colspan: number })[][] = [
    ['Week', 'Date'],
    ['Week', 'Date'],
  ]

  productList.forEach((product, productIdx) => {
    nestedHeaders[0].push({ label: product.name, colspan: SALES_METRICS.length })
    nestedHeaders[1].push(...SALES_METRICS.map((metric) => metricLabel(metric)))
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
  }
}

async function getProfitAndLossView() {
  const context = await loadOperationsContext()
  const derivedOrders = deriveOrders(context)
  const salesPlan = computeSalesPlan(
    mapSalesWeeks(await prisma.salesWeek.findMany()),
    derivedOrders.map((item) => item.derived)
  )
  const overrides = mapProfitAndLossWeeks(
    await prisma.profitAndLossWeek.findMany({ orderBy: { weekNumber: 'asc' } })
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
    mapSalesWeeks(await prisma.salesWeek.findMany()),
    derivedOrders.map((item) => item.derived)
  )
  const pnlOverrides = mapProfitAndLossWeeks(
    await prisma.profitAndLossWeek.findMany({ orderBy: { weekNumber: 'asc' } })
  )
  const { weekly: pnlWeekly } = computeProfitAndLoss(
    salesPlan,
    context.productIndex,
    context.parameters,
    pnlOverrides
  )

  const cashOverrides = mapCashFlowWeeks(
    await prisma.cashFlowWeek.findMany({ orderBy: { weekNumber: 'asc' } })
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

async function getDashboardView() {
  const context = await loadOperationsContext()
  const derivedOrders = deriveOrders(context)
  const salesPlan = computeSalesPlan(
    mapSalesWeeks(await prisma.salesWeek.findMany()),
    derivedOrders.map((item) => item.derived)
  )
  const pnlOverrides = mapProfitAndLossWeeks(
    await prisma.profitAndLossWeek.findMany({ orderBy: { weekNumber: 'asc' } })
  )
  const { weekly: pnlWeekly } = computeProfitAndLoss(
    salesPlan,
    context.productIndex,
    context.parameters,
    pnlOverrides
  )

  const cashOverrides = mapCashFlowWeeks(
    await prisma.cashFlowWeek.findMany({ orderBy: { weekNumber: 'asc' } })
  )
  const { weekly: cashWeekly } = computeCashFlow(
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
    revenueYTD: dashboard.revenueYtd.toFixed(2),
    netProfitYTD: dashboard.netProfitYtd.toFixed(2),
    cashBalance: dashboard.cashBalance.toFixed(2),
    netMargin: dashboard.netMarginPercent.toFixed(2),
    pipeline: dashboard.pipeline,
    inventory: dashboard.inventory.map((item) => ({
      productName: item.productName,
      stockEnd: item.stockEnd,
      stockWeeks: item.stockWeeks.toFixed(1),
    })),
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
      content = <ProductSetupGrid products={view.products} />
      contextPane =
        view.financeParameters.length > 0 ? (
          <ProductSetupFinancePanel parameters={view.financeParameters} />
        ) : null
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
    updated: sheetStatus?.lastUpdated ? formatDisplayDate(sheetStatus.lastUpdated) : undefined,
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
