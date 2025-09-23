import { notFound } from 'next/navigation'
import type {
  Prisma,
  Product,
  LeadStageTemplate,
  BusinessParameter,
  PurchaseOrder,
  SalesWeek,
  ProfitAndLossWeek,
  CashFlowWeek,
  MonthlySummary,
  QuarterlySummary,
} from '@prisma/client'
import { ProductSetupGrid } from '@/components/sheets/product-setup-grid'
import { OpsPlanningGrid } from '@/components/sheets/ops-planning-grid'
import { BusinessParametersPanel } from '@/components/sheets/product-setup-panels'
import { SalesPlanningGrid } from '@/components/sheets/sales-planning-grid'
import { ProfitAndLossGrid } from '@/components/sheets/fin-planning-pl-grid'
import { CashFlowGrid } from '@/components/sheets/fin-planning-cash-grid'
import { DashboardSheet } from '@/components/sheets/dashboard'
import prisma from '@/lib/prisma'
import { getSheetConfig } from '@/lib/sheets'
import { getWorkbookStatus } from '@/lib/workbook'
import { WorkbookLayout } from '@/components/workbook-layout'

const SALES_METRICS = ['stockStart', 'actualSales', 'forecastSales', 'finalSales', 'stockWeeks', 'stockEnd'] as const
type SalesMetric = (typeof SALES_METRICS)[number]

type SalesRow = {
  weekNumber: string
  weekDate: string
  [key: string]: string
}

function formatDecimal(value: Prisma.Decimal | number | string | null | undefined, fallback = ''): string {
  if (value == null) return fallback
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return fallback
  return numeric.toFixed(2)
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

type SheetPageProps = {
  params: Promise<{ sheet: string }>
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
  const [products, leadStages, businessParameters]: [
    Product[],
    LeadStageTemplate[],
    BusinessParameter[],
  ] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: 'asc' } }),
    prisma.leadStageTemplate.findMany({ select: { label: true } }),
    prisma.businessParameter.findMany({ select: { label: true } }),
  ])

  const excludedNames = new Set(
    [...leadStages.map((stage) => stage.label.toLowerCase()), ...businessParameters.map((parameter) => parameter.label.toLowerCase())]
  )

  const filteredProducts = products.filter((product) => {
    const name = product.name.toLowerCase()
    const sku = product.sku?.trim()
    return product.isActive && sku && sku.length > 0 && !excludedNames.has(name)
  })

  return {
    products: filteredProducts.map((product) => ({
      id: product.id,
      name: product.name,
      sellingPrice: formatDecimal(product.sellingPrice),
      manufacturingCost: formatDecimal(product.manufacturingCost),
      freightCost: formatDecimal(product.freightCost),
      tariffRate: formatDecimal(product.tariffRate),
      tacosPercent: formatDecimal(product.tacosPercent),
      fbaFee: formatDecimal(product.fbaFee),
      amazonReferralRate: formatDecimal(product.amazonReferralRate),
      storagePerMonth: formatDecimal(product.storagePerMonth),
    })),
  }
}

async function getBusinessParametersView() {
  const businessParameters = await prisma.businessParameter.findMany({ orderBy: { label: 'asc' } })
  return businessParameters.map((parameter) => ({
    id: parameter.id,
    label: parameter.label,
    value:
      parameter.valueNumeric != null
        ? formatDecimal(parameter.valueNumeric, '0.00')
        : parameter.valueText ?? '',
    type: parameter.valueNumeric != null ? 'numeric' : 'text',
  }))
}

async function getOpsPlanningView() {
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: { orderCode: 'asc' },
    include: { product: true },
  })

  return {
    purchaseOrders: purchaseOrders.map((po) => ({
      id: po.id,
      orderCode: po.orderCode,
      productId: po.productId,
      productName: po.product.name,
      quantity: po.quantity?.toString() ?? '',
      productionWeeks: formatDecimal(po.productionWeeks),
      sourcePrepWeeks: formatDecimal(po.sourcePrepWeeks),
      oceanWeeks: formatDecimal(po.oceanWeeks),
      finalMileWeeks: formatDecimal(po.finalMileWeeks),
      pay1Date: formatDate(po.pay1Date),
      pay1Percent: formatDecimal(po.pay1Percent),
      pay1Amount: formatDecimal(po.pay1Amount),
      pay2Date: formatDate(po.pay2Date),
      pay2Percent: formatDecimal(po.pay2Percent),
      pay2Amount: formatDecimal(po.pay2Amount),
      pay3Date: formatDate(po.pay3Date),
      pay3Percent: formatDecimal(po.pay3Percent),
      pay3Amount: formatDecimal(po.pay3Amount),
      productionStart: formatDate(po.productionStart),
      productionComplete: formatDate(po.productionComplete),
      sourceDeparture: formatDate(po.sourceDeparture),
      transportReference: po.transportReference ?? '',
      portEta: formatDate(po.portEta),
      inboundEta: formatDate(po.inboundEta),
      availableDate: formatDate(po.availableDate),
      totalLeadDays: po.totalLeadDays?.toString() ?? '',
      status: po.status,
      weeksUntilArrival: po.weeksUntilArrival?.toString() ?? '',
      statusIcon: po.statusIcon ?? '',
      notes: po.notes ?? '',
    })),
  }
}

async function getSalesPlanningView() {
  const [products, salesWeeks]: [Product[], SalesWeek[]] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: 'asc' } }),
    prisma.salesWeek.findMany(),
  ])

  const weeks = Array.from({ length: 52 }, (_, index) => index + 1)
  const columnMeta: Record<string, { productId: string; field: string }> = {}
  const columnKeys: string[] = []

  const nestedHeaders: (string | { label: string; colspan: number })[][] = [
    ['Week', 'Date'],
    ['Week', 'Date'],
  ]

  products.forEach((product, productIdx) => {
    nestedHeaders[0].push({ label: product.name, colspan: SALES_METRICS.length })
    nestedHeaders[1].push(...SALES_METRICS.map((metric) => metricLabel(metric)))
    SALES_METRICS.forEach((metric) => {
      const key = columnKey(productIdx, metric)
      columnKeys.push(key)
      columnMeta[key] = { productId: product.id, field: metric }
    })
  })

  const rows = weeks.map((weekNumber) => {
    const row: SalesRow = {
      weekNumber: String(weekNumber),
      weekDate: '',
    }

    products.forEach((product, productIdx) => {
      const record = salesWeeks.find((entry) => entry.productId === product.id && entry.weekNumber === weekNumber)
      if (record && !row.weekDate) {
        row.weekDate = formatDate(record.weekDate) ?? ''
      }
      SALES_METRICS.forEach((metric) => {
        const key = columnKey(productIdx, metric)
        switch (metric) {
          case 'stockStart':
            row[key] = record?.stockStart?.toString() ?? ''
            break
          case 'actualSales':
            row[key] = record?.actualSales?.toString() ?? ''
            break
          case 'forecastSales':
            row[key] = record?.forecastSales?.toString() ?? ''
            break
          case 'finalSales':
            row[key] = record?.finalSales?.toString() ?? ''
            break
          case 'stockWeeks':
            row[key] = record?.stockWeeks?.toString() ?? ''
            break
          case 'stockEnd':
            row[key] = record?.stockEnd?.toString() ?? ''
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
    productOptions: products.map((product) => ({ id: product.id, name: product.name })),
  }
}

async function getProfitAndLossView() {
  const [weekly, monthly, quarterly]: [
    ProfitAndLossWeek[],
    MonthlySummary[],
    QuarterlySummary[],
  ] = await Promise.all([
    prisma.profitAndLossWeek.findMany({ orderBy: { weekNumber: 'asc' } }),
    prisma.monthlySummary.findMany({ where: { revenue: { not: null } }, orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
    prisma.quarterlySummary.findMany({ where: { revenue: { not: null } }, orderBy: [{ year: 'asc' }, { quarter: 'asc' }] }),
  ])

  return {
    weekly: weekly.map((entry) => ({
      weekNumber: String(entry.weekNumber),
      weekDate: formatDate(entry.weekDate) ?? '',
      units: entry.units?.toString() ?? '',
      revenue: formatDecimal(entry.revenue),
      cogs: formatDecimal(entry.cogs),
      grossProfit: formatDecimal(entry.grossProfit),
      grossMargin: formatDecimal(entry.grossMargin),
      amazonFees: formatDecimal(entry.amazonFees),
      ppcSpend: formatDecimal(entry.ppcSpend),
      fixedCosts: formatDecimal(entry.fixedCosts),
      totalOpex: formatDecimal(entry.totalOpex),
      netProfit: formatDecimal(entry.netProfit),
    })),
    monthlySummary: monthly.map((entry) => ({
      periodLabel: entry.periodLabel,
      revenue: formatDecimal(entry.revenue),
      cogs: formatDecimal(entry.cogs),
      grossProfit: formatDecimal(entry.grossProfit),
      amazonFees: formatDecimal(entry.amazonFees),
      ppcSpend: formatDecimal(entry.ppcSpend),
      fixedCosts: formatDecimal(entry.fixedCosts),
      totalOpex: formatDecimal(entry.totalOpex),
      netProfit: formatDecimal(entry.netProfit),
    })),
    quarterlySummary: quarterly.map((entry) => ({
      periodLabel: entry.periodLabel,
      revenue: formatDecimal(entry.revenue),
      cogs: formatDecimal(entry.cogs),
      grossProfit: formatDecimal(entry.grossProfit),
      amazonFees: formatDecimal(entry.amazonFees),
      ppcSpend: formatDecimal(entry.ppcSpend),
      fixedCosts: formatDecimal(entry.fixedCosts),
      totalOpex: formatDecimal(entry.totalOpex),
      netProfit: formatDecimal(entry.netProfit),
    })),
  }
}

async function getCashFlowView() {
  const [weekly, monthly, quarterly]: [
    CashFlowWeek[],
    MonthlySummary[],
    QuarterlySummary[],
  ] = await Promise.all([
    prisma.cashFlowWeek.findMany({ orderBy: { weekNumber: 'asc' } }),
    prisma.monthlySummary.findMany({ where: { amazonPayout: { not: null } }, orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
    prisma.quarterlySummary.findMany({ where: { amazonPayout: { not: null } }, orderBy: [{ year: 'asc' }, { quarter: 'asc' }] }),
  ])

  return {
    weekly: weekly.map((entry) => ({
      weekNumber: String(entry.weekNumber),
      weekDate: formatDate(entry.weekDate) ?? '',
      amazonPayout: formatDecimal(entry.amazonPayout),
      inventorySpend: formatDecimal(entry.inventorySpend),
      fixedCosts: formatDecimal(entry.fixedCosts),
      netCash: formatDecimal(entry.netCash),
      cashBalance: formatDecimal(entry.cashBalance),
    })),
    monthlySummary: monthly.map((entry) => ({
      periodLabel: entry.periodLabel,
      amazonPayout: formatDecimal(entry.amazonPayout),
      inventorySpend: formatDecimal(entry.inventorySpend),
      fixedCosts: formatDecimal(entry.fixedCosts),
      netCash: formatDecimal(entry.netCash),
      closingCash: formatDecimal(entry.closingCash),
    })),
    quarterlySummary: quarterly.map((entry) => ({
      periodLabel: entry.periodLabel,
      amazonPayout: formatDecimal(entry.amazonPayout),
      inventorySpend: formatDecimal(entry.inventorySpend),
      fixedCosts: formatDecimal(entry.fixedCosts),
      netCash: formatDecimal(entry.netCash),
      closingCash: formatDecimal(entry.closingCash),
    })),
  }
}

async function getDashboardView() {
  const [profitWeeks, cashWeeks, purchaseOrders, salesWeeks, products]: [
    ProfitAndLossWeek[],
    CashFlowWeek[],
    PurchaseOrder[],
    SalesWeek[],
    Product[],
  ] = await Promise.all([
    prisma.profitAndLossWeek.findMany(),
    prisma.cashFlowWeek.findMany({ orderBy: { weekNumber: 'asc' } }),
    prisma.purchaseOrder.findMany({ include: { product: true } }),
    prisma.salesWeek.findMany({ include: { product: true } }),
    prisma.product.findMany(),
  ])

  const revenueYTD = profitWeeks.reduce((acc, item) => acc + Number(item.revenue ?? 0), 0)
  const netProfitYTD = profitWeeks.reduce((acc, item) => acc + Number(item.netProfit ?? 0), 0)
  const latestCashBalance = cashWeeks.length ? Number(cashWeeks[cashWeeks.length - 1].cashBalance ?? 0) : 0
  const netMargin = revenueYTD === 0 ? 0 : netProfitYTD / revenueYTD

  const pipelineStatus = purchaseOrders.reduce<Record<string, number>>((acc, order) => {
    const key = order.status
    acc[key] = (acc[key] ?? 0) + (order.quantity ?? 0)
    return acc
  }, {})

  const latestSalesByProduct = new Map<string, typeof salesWeeks[0]>()
  for (const record of salesWeeks) {
    const existing = latestSalesByProduct.get(record.productId)
    if (!existing || record.weekNumber > existing.weekNumber) {
      latestSalesByProduct.set(record.productId, record)
    }
  }

  const inventory = products.map((product) => {
    const salesRecord = latestSalesByProduct.get(product.id)
    return {
      productName: product.name,
      stockEnd: salesRecord?.stockEnd ?? 0,
      stockWeeks: salesRecord?.stockWeeks?.toString() ?? '0',
    }
  })

  return {
    revenueYTD: revenueYTD.toFixed(2),
    netProfitYTD: netProfitYTD.toFixed(2),
    cashBalance: latestCashBalance.toFixed(2),
    netMargin: (netMargin * 100).toFixed(2),
    pipeline: Object.entries(pipelineStatus).map(([status, quantity]) => ({ status, quantity })),
    inventory,
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
      break
    }
    case '2-ops-planning': {
      const view = await getOpsPlanningView()
      content = <OpsPlanningGrid purchaseOrders={view.purchaseOrders} />
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
      const [view, parameters] = await Promise.all([getProfitAndLossView(), getBusinessParametersView()])
      content = (
        <ProfitAndLossGrid
          weekly={view.weekly}
          monthlySummary={view.monthlySummary}
          quarterlySummary={view.quarterlySummary}
        />
      )
      contextPane = <BusinessParametersPanel parameters={parameters} />
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

  return (
    <WorkbookLayout
      sheets={workbookStatus.sheets}
      activeSlug={config.slug}
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
