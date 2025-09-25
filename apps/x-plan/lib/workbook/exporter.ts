import { PrismaClient } from '@prisma/client'
import type {
  ProductRow,
  LeadStageTemplateRow,
  BusinessParameterRow,
  PurchaseOrderRow,
  SalesWeekRow,
  ProfitAndLossWeekRow,
  MonthlySummaryRow,
  QuarterlySummaryRow,
  CashFlowWeekRow,
} from '@/lib/calculations/adapters'

type ProductCostRow = Pick<ProductRow, 'name' | 'sku' | 'manufacturingCost' | 'freightCost' | 'tariffRate'>
type ProductSalesTermExportRow = {
  product: Pick<ProductRow, 'name' | 'sku'>
  startDate: Date
  endDate: Date | null
  sellingPrice: number | { toNumber(): number }
  tacosPercent: number | { toNumber(): number }
  fbaFee: number | { toNumber(): number }
  referralRate: number | { toNumber(): number }
  storagePerMonth: number | { toNumber(): number }
}
type LeadStageRow = Pick<LeadStageTemplateRow, 'label' | 'defaultWeeks'>
type BusinessParameterExportRow = Pick<BusinessParameterRow, 'label' | 'valueNumeric' | 'valueText'>
type ProductNameRow = Pick<ProductRow, 'id' | 'name'>
type SalesWeekExportRow = Pick<
  SalesWeekRow,
  | 'productId'
  | 'weekNumber'
  | 'weekDate'
  | 'stockStart'
  | 'actualSales'
  | 'forecastSales'
  | 'finalSales'
  | 'stockWeeks'
  | 'stockEnd'
>
type ProfitWeekRow = Pick<
  ProfitAndLossWeekRow,
  | 'weekNumber'
  | 'weekDate'
  | 'units'
  | 'revenue'
  | 'cogs'
  | 'grossProfit'
  | 'grossMargin'
  | 'amazonFees'
  | 'ppcSpend'
  | 'fixedCosts'
  | 'totalOpex'
  | 'netProfit'
>
type MonthlySummaryExportRow = Pick<
  MonthlySummaryRow,
  | 'periodLabel'
  | 'revenue'
  | 'cogs'
  | 'grossProfit'
  | 'amazonFees'
  | 'ppcSpend'
  | 'fixedCosts'
  | 'totalOpex'
  | 'netProfit'
  | 'amazonPayout'
  | 'inventorySpend'
  | 'netCash'
  | 'closingCash'
>
type QuarterlySummaryExportRow = Pick<
  QuarterlySummaryRow,
  | 'periodLabel'
  | 'revenue'
  | 'cogs'
  | 'grossProfit'
  | 'amazonFees'
  | 'ppcSpend'
  | 'fixedCosts'
  | 'totalOpex'
  | 'netProfit'
  | 'amazonPayout'
  | 'inventorySpend'
  | 'netCash'
  | 'closingCash'
>
type CashFlowWeekExportRow = Pick<
  CashFlowWeekRow,
  'weekNumber' | 'weekDate' | 'amazonPayout' | 'inventorySpend' | 'fixedCosts' | 'netCash' | 'cashBalance'
>
type PurchaseOrderWithProduct = Pick<
  PurchaseOrderRow,
  |
    'orderCode'
    | 'productId'
    | 'quantity'
    | 'productionWeeks'
    | 'sourcePrepWeeks'
    | 'oceanWeeks'
    | 'finalMileWeeks'
    | 'pay1Date'
    | 'pay1Percent'
    | 'pay1Amount'
    | 'pay2Date'
    | 'pay2Percent'
    | 'pay2Amount'
    | 'pay3Date'
    | 'pay3Percent'
    | 'pay3Amount'
    | 'productionStart'
    | 'productionComplete'
    | 'sourceDeparture'
    | 'transportReference'
    | 'portEta'
    | 'inboundEta'
    | 'availableDate'
    | 'totalLeadDays'
    | 'status'
    | 'statusIcon'
    | 'weeksUntilArrival'
> & { product: Pick<ProductRow, 'name'> }
type PurchaseOrderSummaryRow = Pick<PurchaseOrderRow, 'status' | 'quantity'>
import * as XLSX from 'xlsx'

function statusLabel(status: string) {
  switch (status) {
    case 'IN_TRANSIT':
      return 'In Transit'
    case 'PRODUCTION':
      return 'Production'
    case 'ARRIVED':
      return 'Arrived'
    case 'CLOSED':
      return 'Closed'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return 'Planned'
  }
}

export async function exportWorkbook(prisma: PrismaClient) {
  const workbook = XLSX.utils.book_new()

  await addProductSetupSheet(workbook, prisma)
  await addOpsPlanningSheet(workbook, prisma)
  await addSalesPlanningSheet(workbook, prisma)
  await addProfitPlanningSheet(workbook, prisma)
  await addCashFlowSheet(workbook, prisma)
  await addDashboardSheet(workbook, prisma)

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

function toNumber(value: unknown) {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value && 'toNumber' in value && typeof (value as any).toNumber === 'function') {
    return (value as { toNumber(): number }).toNumber()
  }
  const numeric = Number(value)
  return Number.isNaN(numeric) ? 0 : numeric
}

function formatDateCell(value: Date | null | undefined) {
  if (!value) return ''
  return value.toISOString().slice(0, 10)
}

async function addProductSetupSheet(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const products = (await prisma.product.findMany({
    orderBy: { name: 'asc' },
    select: {
      name: true,
      sku: true,
      manufacturingCost: true,
      freightCost: true,
      tariffRate: true,
    },
  })) as ProductCostRow[]
  const salesTerms = (await prisma.productSalesTerm.findMany({
    orderBy: [{ product: { name: 'asc' } }, { startDate: 'asc' }],
    select: {
      startDate: true,
      endDate: true,
      sellingPrice: true,
      tacosPercent: true,
      fbaFee: true,
      referralRate: true,
      storagePerMonth: true,
      product: { select: { name: true, sku: true } },
    },
  })) as ProductSalesTermExportRow[]
  const leadStages = (await prisma.leadStageTemplate.findMany({
    orderBy: { sequence: 'asc' },
    select: { label: true, defaultWeeks: true },
  })) as LeadStageRow[]
  const params = (await prisma.businessParameter.findMany({
    orderBy: { label: 'asc' },
    select: { label: true, valueNumeric: true, valueText: true },
  })) as BusinessParameterExportRow[]

  const data: any[][] = [
    [],
    ['PRODUCT CONFIGURATION'],
    [],
    ['SKU', 'Product Name', 'Manufacturing', 'Freight', 'Tariff Rate'],
    ...products.map((product) => [
      product.sku ?? '',
      product.name,
      toNumber(product.manufacturingCost),
      toNumber(product.freightCost),
      toNumber(product.tariffRate),
    ]),
    [],
    ['SALES TERMS'],
    ['SKU', 'Product Name', 'Start Date', 'End Date', 'Selling Price', 'TACoS %', 'FBA Fee', 'Referral %', 'Storage/Mo'],
    ...salesTerms.map((term) => [
      term.product.sku ?? '',
      term.product.name,
      formatDateCell(term.startDate),
      formatDateCell(term.endDate),
      toNumber(term.sellingPrice),
      toNumber(term.tacosPercent),
      toNumber(term.fbaFee),
      toNumber(term.referralRate),
      toNumber(term.storagePerMonth),
    ]),
    [],
    ['LEAD TIME CONFIGURATION (WEEKS)'],
    ['Stage', 'Duration'],
    ...leadStages.map((stage) => [stage.label, Number(stage.defaultWeeks ?? 0)]),
    [],
    ['BUSINESS PARAMETERS'],
    ...params.map((param) => [param.label, param.valueNumeric ? Number(param.valueNumeric) : param.valueText ?? '']),
  ]

  const sheet = XLSX.utils.aoa_to_sheet([[]])
  XLSX.utils.sheet_add_aoa(sheet, data, { origin: 'B2' })
  XLSX.utils.book_append_sheet(workbook, sheet, '1. Product Setup')
}

async function addOpsPlanningSheet(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const orders = (await prisma.purchaseOrder.findMany({
    orderBy: { orderCode: 'asc' },
    select: {
      orderCode: true,
      productId: true,
      quantity: true,
      productionWeeks: true,
      sourcePrepWeeks: true,
      oceanWeeks: true,
      finalMileWeeks: true,
      pay1Date: true,
      pay1Percent: true,
      pay1Amount: true,
      pay2Date: true,
      pay2Percent: true,
      pay2Amount: true,
      pay3Date: true,
      pay3Percent: true,
      pay3Amount: true,
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
      weeksUntilArrival: true,
      product: { select: { name: true } },
    },
  })) as PurchaseOrderWithProduct[]

  const headers = [
    'Shipping Mark',
    'Product',
    'Quantity',
    'Production',
    'Source Prep',
    'Ocean',
    'Final Mile',
    'Pay 1 Date',
    'Pay 1 %',
    'Pay 1 Amount',
    'Pay 2 Date',
    'Pay 2 %',
    'Pay 2 Amount',
    'Pay 3 Date',
    'Pay 3 %',
    'Pay 3 Amount',
    'Production Start',
    'Production Complete',
    'Source Departure',
    'Transport Reference',
    'Port ETA',
    'Inbound ETA',
    'Available Date',
    'Lead Days',
    'Status',
    'Weeks Until Arrival',
    'Status Icon',
  ]

  const data = [headers, ...orders.map((order) => [
    order.orderCode,
    order.product.name,
    order.quantity,
    Number(order.productionWeeks ?? 0),
    Number(order.sourcePrepWeeks ?? 0),
    Number(order.oceanWeeks ?? 0),
    Number(order.finalMileWeeks ?? 0),
    toExcelDate(order.pay1Date),
    Number(order.pay1Percent ?? 0),
    Number(order.pay1Amount ?? 0),
    toExcelDate(order.pay2Date),
    Number(order.pay2Percent ?? 0),
    Number(order.pay2Amount ?? 0),
    toExcelDate(order.pay3Date),
    Number(order.pay3Percent ?? 0),
    Number(order.pay3Amount ?? 0),
    toExcelDate(order.productionStart),
    toExcelDate(order.productionComplete),
    toExcelDate(order.sourceDeparture),
    order.transportReference ?? '',
    toExcelDate(order.portEta),
    toExcelDate(order.inboundEta),
    toExcelDate(order.availableDate),
    order.totalLeadDays ?? '',
    statusLabel(order.status),
    order.weeksUntilArrival ?? '',
    order.statusIcon ?? '',
  ])]

  const sheet = XLSX.utils.aoa_to_sheet([[]])
  XLSX.utils.sheet_add_aoa(sheet, data, { origin: 'A4' })
  XLSX.utils.book_append_sheet(workbook, sheet, '2. Ops Planning')
}

async function addSalesPlanningSheet(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const products = (await prisma.product.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })) as ProductNameRow[]
  const salesWeeks = (await prisma.salesWeek.findMany({
    select: {
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
  })) as SalesWeekExportRow[]

  const metrics = ['Stock Start', 'Actual Sales', 'Fcst Sales', 'Final Sales', 'Stock (Weeks)', 'Stock End']

  const headerRow = ['Week', 'Date']
  products.forEach((product) => {
    headerRow.push(product.name)
    headerRow.push('', '', '', '', '')
  })

  const secondRow = ['', '']
  products.forEach(() => {
    secondRow.push(...metrics)
  })

  const rows: any[][] = [headerRow, secondRow]

  for (let week = 1; week <= 52; week += 1) {
    const row: any[] = [week, '']
    products.forEach((product) => {
      const record = salesWeeks.find((item) => item.productId === product.id && item.weekNumber === week)
      row.push(
        record?.stockStart ?? '',
        record?.actualSales ?? '',
        record?.forecastSales ?? '',
        record?.finalSales ?? '',
        record?.stockWeeks ? Number(record.stockWeeks) : '',
        record?.stockEnd ?? ''
      )
      if (!row[1] && record?.weekDate) {
        row[1] = toExcelDate(record.weekDate)
      }
    })
    rows.push(row)
  }

  const sheet = XLSX.utils.aoa_to_sheet([[]])
  XLSX.utils.sheet_add_aoa(sheet, rows, { origin: 'A4' })
  XLSX.utils.book_append_sheet(workbook, sheet, '3. Sales Planning')
}

async function addProfitPlanningSheet(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const weeks = (await prisma.profitAndLossWeek.findMany({
    orderBy: { weekNumber: 'asc' },
    select: {
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
  })) as ProfitWeekRow[]
  const monthly = (await prisma.monthlySummary.findMany({
    where: { revenue: { not: null } },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
    select: {
      periodLabel: true,
      revenue: true,
      cogs: true,
      grossProfit: true,
      amazonFees: true,
      ppcSpend: true,
      fixedCosts: true,
      totalOpex: true,
      netProfit: true,
    },
  })) as MonthlySummaryExportRow[]
  const quarterly = (await prisma.quarterlySummary.findMany({
    where: { revenue: { not: null } },
    orderBy: [{ year: 'asc' }, { quarter: 'asc' }],
    select: {
      periodLabel: true,
      revenue: true,
      cogs: true,
      grossProfit: true,
      amazonFees: true,
      ppcSpend: true,
      fixedCosts: true,
      totalOpex: true,
      netProfit: true,
    },
  })) as QuarterlySummaryExportRow[]

  const header = ['Week', 'Date', 'Units', 'Revenue', 'COGS', 'Gross Profit', 'GP%', 'Amazon Fees', 'PPC', 'Fixed Costs', 'Total OpEx', 'Net Profit']
  const rows = [header, ...weeks.map((week) => [
    week.weekNumber,
    toExcelDate(week.weekDate),
    week.units ?? '',
    Number(week.revenue ?? 0),
    Number(week.cogs ?? 0),
    Number(week.grossProfit ?? 0),
    Number(week.grossMargin ?? 0),
    Number(week.amazonFees ?? 0),
    Number(week.ppcSpend ?? 0),
    Number(week.fixedCosts ?? 0),
    Number(week.totalOpex ?? 0),
    Number(week.netProfit ?? 0),
  ])]

  const sheet = XLSX.utils.aoa_to_sheet([[]])
  XLSX.utils.sheet_add_aoa(sheet, rows, { origin: 'B4' })

  const monthlyStart = 60
  XLSX.utils.sheet_add_aoa(sheet, [[ 'Monthly P&L Summary' ]], { origin: `P${monthlyStart}` })
  XLSX.utils.sheet_add_aoa(
    sheet,
    [['Period', 'Revenue', 'COGS', 'Gross Profit', 'Amazon Fees', 'PPC', 'Fixed Costs', 'Total OpEx', 'Net Profit']],
    { origin: `P${monthlyStart + 1}` }
  )
  monthly.forEach((item, idx) => {
    XLSX.utils.sheet_add_aoa(
      sheet,
      [[
        item.periodLabel,
        Number(item.revenue ?? 0),
        Number(item.cogs ?? 0),
        Number(item.grossProfit ?? 0),
        Number(item.amazonFees ?? 0),
        Number(item.ppcSpend ?? 0),
        Number(item.fixedCosts ?? 0),
        Number(item.totalOpex ?? 0),
        Number(item.netProfit ?? 0),
      ]],
      { origin: `P${monthlyStart + 2 + idx}` }
    )
  })

  const quarterlyStart = monthlyStart + 2 + monthly.length + 2
  XLSX.utils.sheet_add_aoa(sheet, [['Quarterly P&L Summary']], { origin: `P${quarterlyStart}` })
  XLSX.utils.sheet_add_aoa(
    sheet,
    [['Period', 'Revenue', 'COGS', 'Gross Profit', 'Amazon Fees', 'PPC', 'Fixed Costs', 'Total OpEx', 'Net Profit']],
    { origin: `P${quarterlyStart + 1}` }
  )
  quarterly.forEach((item, idx) => {
    XLSX.utils.sheet_add_aoa(
      sheet,
      [[
        item.periodLabel,
        Number(item.revenue ?? 0),
        Number(item.cogs ?? 0),
        Number(item.grossProfit ?? 0),
        Number(item.amazonFees ?? 0),
        Number(item.ppcSpend ?? 0),
        Number(item.fixedCosts ?? 0),
        Number(item.totalOpex ?? 0),
        Number(item.netProfit ?? 0),
      ]],
      { origin: `P${quarterlyStart + 2 + idx}` }
    )
  })

  XLSX.utils.book_append_sheet(workbook, sheet, '4. Fin Planning P&L')
}

async function addCashFlowSheet(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const weeks = (await prisma.cashFlowWeek.findMany({
    orderBy: { weekNumber: 'asc' },
    select: {
      weekNumber: true,
      weekDate: true,
      amazonPayout: true,
      inventorySpend: true,
      fixedCosts: true,
      netCash: true,
      cashBalance: true,
    },
  })) as CashFlowWeekExportRow[]
  const monthly = (await prisma.monthlySummary.findMany({
    where: { amazonPayout: { not: null } },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
    select: {
      periodLabel: true,
      amazonPayout: true,
      inventorySpend: true,
      fixedCosts: true,
      netCash: true,
      closingCash: true,
    },
  })) as MonthlySummaryExportRow[]
  const quarterly = (await prisma.quarterlySummary.findMany({
    where: { amazonPayout: { not: null } },
    orderBy: [{ year: 'asc' }, { quarter: 'asc' }],
    select: {
      periodLabel: true,
      amazonPayout: true,
      inventorySpend: true,
      fixedCosts: true,
      netCash: true,
      closingCash: true,
    },
  })) as QuarterlySummaryExportRow[]

  const header = ['Week', 'Date', 'Amazon Payout', 'Inventory Purchase', 'Fixed Costs', 'Net Cash', 'Cash Balance']
  const rows = [header, ...weeks.map((week) => [
    week.weekNumber,
    toExcelDate(week.weekDate),
    Number(week.amazonPayout ?? 0),
    Number(week.inventorySpend ?? 0),
    Number(week.fixedCosts ?? 0),
    Number(week.netCash ?? 0),
    Number(week.cashBalance ?? 0),
  ])]

  const sheet = XLSX.utils.aoa_to_sheet([[]])
  XLSX.utils.sheet_add_aoa(sheet, rows, { origin: 'B4' })

  const monthlyStart = 59
  XLSX.utils.sheet_add_aoa(sheet, [['Monthly Cash Flow Summary']], { origin: `K${monthlyStart}` })
  XLSX.utils.sheet_add_aoa(sheet, [['Period', 'Amazon Payout', 'Inventory Purchase', 'Fixed Costs', 'Net Cash', 'Closing Cash']], { origin: `K${monthlyStart + 1}` })
  monthly.forEach((item, idx) => {
    XLSX.utils.sheet_add_aoa(
      sheet,
      [[
        item.periodLabel,
        Number(item.amazonPayout ?? 0),
        Number(item.inventorySpend ?? 0),
        Number(item.fixedCosts ?? 0),
        Number(item.netCash ?? 0),
        Number(item.closingCash ?? 0),
      ]],
      { origin: `K${monthlyStart + 2 + idx}` }
    )
  })

  const quarterlyStart = monthlyStart + 2 + monthly.length + 2
  XLSX.utils.sheet_add_aoa(sheet, [['Quarterly Cash Flow Summary']], { origin: `K${quarterlyStart}` })
  XLSX.utils.sheet_add_aoa(sheet, [['Period', 'Amazon Payout', 'Inventory Purchase', 'Fixed Costs', 'Net Cash', 'Closing Cash']], { origin: `K${quarterlyStart + 1}` })
  quarterly.forEach((item, idx) => {
    XLSX.utils.sheet_add_aoa(
      sheet,
      [[
        item.periodLabel,
        Number(item.amazonPayout ?? 0),
        Number(item.inventorySpend ?? 0),
        Number(item.fixedCosts ?? 0),
        Number(item.netCash ?? 0),
        Number(item.closingCash ?? 0),
      ]],
      { origin: `K${quarterlyStart + 2 + idx}` }
    )
  })

  XLSX.utils.book_append_sheet(workbook, sheet, '5. Fin Planning Cash Flow')
}

async function addDashboardSheet(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const [profitWeeks, cashWeeks, purchaseOrders] = await Promise.all([
    prisma.profitAndLossWeek.findMany({
      select: { revenue: true, netProfit: true },
    }) as Promise<Array<Pick<ProfitWeekRow, 'revenue' | 'netProfit'>>>,
    prisma.cashFlowWeek.findMany({
      orderBy: { weekNumber: 'asc' },
      select: { cashBalance: true },
    }) as Promise<Array<Pick<CashFlowWeekRow, 'cashBalance'>>>,
    prisma.purchaseOrder.findMany({
      orderBy: { orderCode: 'asc' },
      select: { status: true, quantity: true },
    }) as Promise<PurchaseOrderSummaryRow[]>,
  ])

  const revenueYTD = profitWeeks.reduce((acc, item) => acc + Number(item.revenue ?? 0), 0)
  const netProfitYTD = profitWeeks.reduce((acc, item) => acc + Number(item.netProfit ?? 0), 0)
  const cashBalance = cashWeeks.length ? Number(cashWeeks[cashWeeks.length - 1].cashBalance ?? 0) : 0

  const data = [
    ['Revenue YTD', revenueYTD],
    ['Net Profit YTD', netProfitYTD],
    ['Cash Balance', cashBalance],
    [],
    ['Pipeline'],
    ['Status', 'Quantity'],
    ...purchaseOrders.reduce((rows: any[][], order) => {
      rows.push([statusLabel(order.status), order.quantity ?? 0])
      return rows
    }, []),
  ]

  const sheet = XLSX.utils.aoa_to_sheet([[]])
  XLSX.utils.sheet_add_aoa(sheet, data, { origin: 'B2' })
  XLSX.utils.book_append_sheet(workbook, sheet, '6. Dashboard')
}

function toExcelDate(date: Date | null | undefined) {
  if (!date) return ''
  const epoch = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const excelEpoch = Date.UTC(1899, 11, 30)
  return (epoch - excelEpoch) / (24 * 60 * 60 * 1000)
}
