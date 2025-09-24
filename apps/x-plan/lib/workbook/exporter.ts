import { PrismaClient, PurchaseOrderStatus } from '@prisma/client'
import * as XLSX from 'xlsx'

function statusLabel(status: PurchaseOrderStatus) {
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

async function addProductSetupSheet(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  const leadStages = await prisma.leadStageTemplate.findMany({ orderBy: { sequence: 'asc' } })
  const params = await prisma.businessParameter.findMany({ orderBy: { label: 'asc' } })

  const data: any[][] = [
    [],
    ['PRODUCT CONFIGURATION'],
    [],
    ['Product Name', 'Selling Price', 'Manufacturing', 'Freight', 'Tariff Rate', 'TACoS %', 'FBA Fee', 'Referral %', 'Storage/Mo'],
    ...products.map((product) => [
      product.name,
      Number(product.sellingPrice ?? 0),
      Number(product.manufacturingCost ?? 0),
      Number(product.freightCost ?? 0),
      Number(product.tariffRate ?? 0),
      Number(product.tacosPercent ?? 0),
      Number(product.fbaFee ?? 0),
      Number(product.amazonReferralRate ?? 0),
      Number(product.storagePerMonth ?? 0),
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
  const orders = await prisma.purchaseOrder.findMany({ include: { product: true }, orderBy: { orderCode: 'asc' } })

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
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  const salesWeeks = await prisma.salesWeek.findMany()

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
  const weeks = await prisma.profitAndLossWeek.findMany({ orderBy: { weekNumber: 'asc' } })
  const monthly = await prisma.monthlySummary.findMany({ where: { revenue: { not: null } }, orderBy: [{ year: 'asc' }, { month: 'asc' }] })
  const quarterly = await prisma.quarterlySummary.findMany({ where: { revenue: { not: null } }, orderBy: [{ year: 'asc' }, { quarter: 'asc' }] })

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
  const weeks = await prisma.cashFlowWeek.findMany({ orderBy: { weekNumber: 'asc' } })
  const monthly = await prisma.monthlySummary.findMany({ where: { amazonPayout: { not: null } }, orderBy: [{ year: 'asc' }, { month: 'asc' }] })
  const quarterly = await prisma.quarterlySummary.findMany({ where: { amazonPayout: { not: null } }, orderBy: [{ year: 'asc' }, { quarter: 'asc' }] })

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
    prisma.profitAndLossWeek.findMany(),
    prisma.cashFlowWeek.findMany({ orderBy: { weekNumber: 'asc' } }),
    prisma.purchaseOrder.findMany({ orderBy: { orderCode: 'asc' } }),
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
