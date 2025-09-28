import { Prisma, PrismaClient, PurchaseOrderStatus } from '@prisma/client'
import * as XLSX from 'xlsx'

type Decimalish = number | string | Date | null | undefined

function toDecimal(value: Decimalish): Prisma.Decimal | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return null
  return new Prisma.Decimal(num)
}

function toInt(value: Decimalish): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return null
  return Math.trunc(num)
}

function toDate(value: Decimalish): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
  }
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function importWorkbookFromXLSX(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.purchaseOrderPayment.deleteMany(),
    prisma.logisticsEvent.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.salesWeek.deleteMany(),
    prisma.profitAndLossWeek.deleteMany(),
    prisma.cashFlowWeek.deleteMany(),
    prisma.monthlySummary.deleteMany(),
    prisma.quarterlySummary.deleteMany(),
    prisma.leadTimeOverride.deleteMany(),
    prisma.leadStageTemplate.deleteMany(),
    prisma.businessParameter.deleteMany(),
    prisma.product.deleteMany(),
  ])

  await importProductSetup(workbook, prisma)
  await importOpsPlanning(workbook, prisma)
  await importSalesPlanning(workbook, prisma)
  await importProfitAndLoss(workbook, prisma)
  await importCashFlow(workbook, prisma)
}

async function importProductSetup(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const sheet = workbook.Sheets['1. Product Setup']
  if (!sheet) throw new Error('Sheet "1. Product Setup" not found')
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, range: 'B2:J200', blankrows: false })

  const leadHeaderIndex = matrix.findIndex((row) => row?.[0] === 'Stage')
  const businessParametersIndex = matrix.findIndex((row) => row?.[0] === 'BUSINESS PARAMETERS')

  const productSectionEnd = businessParametersIndex >= 0
    ? businessParametersIndex
    : leadHeaderIndex >= 0
    ? leadHeaderIndex
    : matrix.length

  const productSection = matrix.slice(0, productSectionEnd)

  const bannedLabels = new Set(
    ['PRODUCT CONFIGURATION', 'Product Name', 'LEAD TIME CONFIGURATION (WEEKS)', 'BUSINESS PARAMETERS']
      .map((label) => label.toLowerCase())
  )

  const productRows = productSection.filter((row) => {
    const name = row?.[0]
    if (!name || typeof name !== 'string') return false
    if (bannedLabels.has(name.trim().toLowerCase())) return false
    return typeof row[1] === 'number'
  })

  for (const row of productRows) {
    const [name, sellingPrice, manufacturing, freight, tariffRate, tacos, fbaFee, referral, storage] = row
    const product = await prisma.product.create({
      data: {
        name: String(name),
        sku: String(name),
        sellingPrice: toDecimal(sellingPrice) ?? new Prisma.Decimal(0),
        manufacturingCost: toDecimal(manufacturing) ?? new Prisma.Decimal(0),
        freightCost: toDecimal(freight) ?? new Prisma.Decimal(0),
        tariffRate: toDecimal(tariffRate) ?? new Prisma.Decimal(0),
        tacosPercent: toDecimal(tacos) ?? new Prisma.Decimal(0),
        fbaFee: toDecimal(fbaFee) ?? new Prisma.Decimal(0),
        amazonReferralRate: toDecimal(referral) ?? new Prisma.Decimal(0),
        storagePerMonth: toDecimal(storage) ?? new Prisma.Decimal(0),
      },
    })
  }

  const stageHeaderIndex = matrix.findIndex((row) => row?.[0] === 'Stage')
  if (stageHeaderIndex >= 0) {
    const stageRows = matrix.slice(stageHeaderIndex + 1)
    let sequence = 0
    for (const row of stageRows) {
      const [label, duration] = row
      if (!label || label === 'BUSINESS PARAMETERS') break
      sequence += 1
      await prisma.leadStageTemplate.create({
        data: {
          label: String(label),
          sequence,
          defaultWeeks: toDecimal(duration) ?? new Prisma.Decimal(0),
        },
      })
    }
  }

  const businessStart = matrix.findIndex((row) => row?.[0] === 'BUSINESS PARAMETERS')
  if (businessStart >= 0) {
    const businessRows = matrix.slice(businessStart + 1).filter((row) => row?.[0])
    for (const [label, value] of businessRows) {
      if (!label) continue
      const numeric = toDecimal(value)
      await prisma.businessParameter.create({
        data: {
          label: String(label),
          valueNumeric: numeric,
          valueText: numeric ? null : value ? String(value) : null,
        },
      })
    }
  }
}

async function importOpsPlanning(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const sheet = workbook.Sheets['2. Ops Planning']
  if (!sheet) throw new Error('Sheet "2. Ops Planning" not found')
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, range: 'A4:AA300', blankrows: false })
  const productNames = new Map(
    (await prisma.product.findMany()).map((product: { id: string; name: string | null }) => [
      product.name ?? '',
      product.id,
    ]),
  )

  for (const row of matrix) {
    const [orderCode, shipName, containerNumber, productName] = row
    if (!orderCode || orderCode === 'Shipping Mark') continue
    const productId = productNames.get(String(productName))
    if (!productId) continue

    const statusValue = String(row[26] ?? '').toLowerCase()
    const status: PurchaseOrderStatus =
      statusValue === 'arrived'
        ? 'ARRIVED'
        : statusValue === 'in transit'
        ? 'IN_TRANSIT'
        : statusValue === 'production'
        ? 'PRODUCTION'
        : statusValue === 'closed'
        ? 'CLOSED'
        : statusValue === 'cancelled'
        ? 'CANCELLED'
        : 'PLANNED'

    await prisma.purchaseOrder.create({
      data: {
        orderCode: String(orderCode),
        productId,
        quantity: toInt(row[2]) ?? 0,
        productionWeeks: toDecimal(row[3]) ?? new Prisma.Decimal(0),
        sourceWeeks: toDecimal(row[4]) ?? new Prisma.Decimal(0),
        oceanWeeks: toDecimal(row[5]) ?? new Prisma.Decimal(0),
        finalWeeks: toDecimal(row[6]) ?? new Prisma.Decimal(0),
        pay1Date: toDate(row[9]),
        pay1Percent: toDecimal(row[10]),
        pay1Amount: toDecimal(row[11]),
        pay2Date: toDate(row[12]),
        pay2Percent: toDecimal(row[13]),
        pay2Amount: toDecimal(row[14]),
        pay3Date: toDate(row[15]),
        pay3Percent: toDecimal(row[16]),
        pay3Amount: toDecimal(row[17]),
        productionStart: toDate(row[18]),
        productionComplete: toDate(row[19]),
        sourceDeparture: toDate(row[20]),
        transportReference: row[21] ? String(row[21]) : null,
        portEta: toDate(row[22]),
        inboundEta: toDate(row[23]),
        availableDate: toDate(row[24]),
        totalLeadDays: toInt(row[25]),
        shipName: shipName ? String(shipName) : null,
        containerNumber: containerNumber ? String(containerNumber) : null,
        status,
        weeksUntilArrival: toInt(row[27]),
        statusIcon: row[28] ? String(row[28]) : null,
      },
    })
  }
}

async function importSalesPlanning(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const sheet = workbook.Sheets['3. Sales Planning']
  if (!sheet) throw new Error('Sheet "3. Sales Planning" not found')
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, range: 'A4:Z200', blankrows: false })

  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  const productOrder = matrix.find((row) => row.some((cell: any) => typeof cell === 'string' && cell.includes('Pack')))
  const productToIndex = new Map<string, number>()
  if (productOrder) {
    productOrder.forEach((value: any, index: number) => {
      if (typeof value === 'string' && value.trim()) {
        productToIndex.set(value.trim(), index)
      }
    })
  }

  const metrics = ['stockStart', 'actualSales', 'forecastSales', 'finalSales', 'stockWeeks', 'stockEnd']

  const weekHeaderIndex = matrix.findIndex((row) => row?.[0] === 'Week')
  if (weekHeaderIndex < 0) return

  const dataRows = matrix.slice(weekHeaderIndex + 1)
  for (const row of dataRows) {
    const weekNumber = toInt(row?.[0])
    const weekDate = toDate(row?.[1])
    if (!weekNumber || !weekDate) continue

    for (const product of products) {
      const startIndex = productToIndex.get(product.name)
      if (startIndex === undefined) continue
      const dataSlice = metrics.map((_, offset) => row?.[startIndex + offset])

      await prisma.salesWeek.create({
        data: {
          productId: product.id,
          weekNumber,
          weekDate,
          stockStart: toInt(dataSlice[0]),
          actualSales: toInt(dataSlice[1]),
          forecastSales: toInt(dataSlice[2]),
          finalSales: toInt(dataSlice[3]),
          stockWeeks: toDecimal(dataSlice[4]),
          stockEnd: toInt(dataSlice[5]),
        },
      })
    }
  }
}

async function importProfitAndLoss(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const sheet = workbook.Sheets['4. Fin Planning P&L']
  if (!sheet) throw new Error('Sheet "4. Fin Planning P&L" not found')
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, range: 'B4:X200', blankrows: false })

  const headerIndex = matrix.findIndex((row) => row?.[0] === 'Week')
  if (headerIndex >= 0) {
    for (const row of matrix.slice(headerIndex + 1)) {
      const weekNumber = toInt(row?.[0])
      if (!weekNumber) continue
      await prisma.profitAndLossWeek.create({
        data: {
          weekNumber,
          weekDate: toDate(row?.[1]) ?? new Date(),
          units: toInt(row?.[2]),
          revenue: toDecimal(row?.[3]),
          cogs: toDecimal(row?.[4]),
          grossProfit: toDecimal(row?.[5]),
          grossMargin: toDecimal(row?.[6]),
          amazonFees: toDecimal(row?.[7]),
          ppcSpend: toDecimal(row?.[8]),
          fixedCosts: toDecimal(row?.[9]),
          totalOpex: toDecimal(row?.[10]),
          netProfit: toDecimal(row?.[11]),
          periodLabel: row?.[14] ? String(row[14]) : null,
        },
      })
    }
  }

  const monthlyStart = matrix.findIndex((row) => row?.[14] === 'Period' && row?.[15] === 'Revenue')
  if (monthlyStart >= 0) {
    for (const row of matrix.slice(monthlyStart + 1)) {
      const label = row?.[14]
      if (!label) continue
      const monthNumber = monthNameToNumber(String(label))
      if (!monthNumber) continue
      await prisma.monthlySummary.upsert({
        where: { year_month_periodLabel: { year: 2025, month: monthNumber, periodLabel: String(label) } },
        create: {
          periodLabel: String(label),
          year: 2025,
          month: monthNumber,
          revenue: toDecimal(row?.[15]),
          cogs: toDecimal(row?.[16]),
          grossProfit: toDecimal(row?.[17]),
          amazonFees: toDecimal(row?.[18]),
          ppcSpend: toDecimal(row?.[19]),
          fixedCosts: toDecimal(row?.[20]),
          totalOpex: toDecimal(row?.[21]),
          netProfit: toDecimal(row?.[22]),
        },
        update: {
          revenue: toDecimal(row?.[15]),
          cogs: toDecimal(row?.[16]),
          grossProfit: toDecimal(row?.[17]),
          amazonFees: toDecimal(row?.[18]),
          ppcSpend: toDecimal(row?.[19]),
          fixedCosts: toDecimal(row?.[20]),
          totalOpex: toDecimal(row?.[21]),
          netProfit: toDecimal(row?.[22]),
        },
      })
    }
  }

  const quarterlyStart = matrix.findIndex((row) => row?.[14] === 'Quarterly P&L Summary')
  if (quarterlyStart >= 0) {
    for (const row of matrix.slice(quarterlyStart + 2)) {
      const label = row?.[14]
      const quarterNumber = quarterLabelToNumber(String(label))
      if (!label || !quarterNumber) continue
      await prisma.quarterlySummary.upsert({
        where: { year_quarter_periodLabel: { year: 2025, quarter: quarterNumber, periodLabel: String(label) } },
        create: {
          periodLabel: String(label),
          year: 2025,
          quarter: quarterNumber,
          revenue: toDecimal(row?.[15]),
          cogs: toDecimal(row?.[16]),
          grossProfit: toDecimal(row?.[17]),
          amazonFees: toDecimal(row?.[18]),
          ppcSpend: toDecimal(row?.[19]),
          fixedCosts: toDecimal(row?.[20]),
          totalOpex: toDecimal(row?.[21]),
          netProfit: toDecimal(row?.[22]),
        },
        update: {
          revenue: toDecimal(row?.[15]),
          cogs: toDecimal(row?.[16]),
          grossProfit: toDecimal(row?.[17]),
          amazonFees: toDecimal(row?.[18]),
          ppcSpend: toDecimal(row?.[19]),
          fixedCosts: toDecimal(row?.[20]),
          totalOpex: toDecimal(row?.[21]),
          netProfit: toDecimal(row?.[22]),
        },
      })
    }
  }
}

async function importCashFlow(workbook: XLSX.WorkBook, prisma: PrismaClient) {
  const sheet = workbook.Sheets['5. Fin Planning Cash Flow']
  if (!sheet) throw new Error('Sheet "5. Fin Planning Cash Flow" not found')
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, range: 'B4:P200', blankrows: false })

  const headerIndex = matrix.findIndex((row) => row?.[0] === 'Week')
  if (headerIndex >= 0) {
    for (const row of matrix.slice(headerIndex + 1)) {
      const weekNumber = toInt(row?.[0])
      if (!weekNumber) continue
      await prisma.cashFlowWeek.create({
        data: {
          weekNumber,
          weekDate: toDate(row?.[1]) ?? new Date(),
          amazonPayout: toDecimal(row?.[2]),
          inventorySpend: toDecimal(row?.[3]),
          fixedCosts: toDecimal(row?.[4]),
          netCash: toDecimal(row?.[5]),
          cashBalance: toDecimal(row?.[6]),
          periodLabel: row?.[9] ? String(row[9]) : null,
        },
      })
    }
  }

  const monthlyStart = matrix.findIndex((row) => row?.[9] === 'Period' && row?.[10] === 'Amazon Payout')
  if (monthlyStart >= 0) {
    for (const row of matrix.slice(monthlyStart + 1)) {
      const label = row?.[9]
      if (!label) continue
      const monthNumber = monthNameToNumber(String(label))
      if (!monthNumber) continue
      await prisma.monthlySummary.upsert({
        where: { year_month_periodLabel: { year: 2025, month: monthNumber, periodLabel: String(label) } },
        create: {
          periodLabel: String(label),
          year: 2025,
          month: monthNumber,
          amazonPayout: toDecimal(row?.[10]),
          inventorySpend: toDecimal(row?.[11]),
          fixedCosts: toDecimal(row?.[12]),
          netCash: toDecimal(row?.[13]),
          closingCash: toDecimal(row?.[14]),
        },
        update: {
          amazonPayout: toDecimal(row?.[10]),
          inventorySpend: toDecimal(row?.[11]),
          fixedCosts: toDecimal(row?.[12]),
          netCash: toDecimal(row?.[13]),
          closingCash: toDecimal(row?.[14]),
        },
      })
    }
  }

  const quarterlyStart = matrix.findIndex((row) => row?.[9] === 'Quarterly Cash Flow Summary')
  if (quarterlyStart >= 0) {
    for (const row of matrix.slice(quarterlyStart + 2)) {
      const label = row?.[9]
      const quarterNumber = quarterLabelToNumber(String(label))
      if (!label || !quarterNumber) continue
      await prisma.quarterlySummary.upsert({
        where: { year_quarter_periodLabel: { year: 2025, quarter: quarterNumber, periodLabel: String(label) } },
        create: {
          periodLabel: String(label),
          year: 2025,
          quarter: quarterNumber,
          amazonPayout: toDecimal(row?.[10]),
          inventorySpend: toDecimal(row?.[11]),
          fixedCosts: toDecimal(row?.[12]),
          netCash: toDecimal(row?.[13]),
          closingCash: toDecimal(row?.[14]),
        },
        update: {
          amazonPayout: toDecimal(row?.[10]),
          inventorySpend: toDecimal(row?.[11]),
          fixedCosts: toDecimal(row?.[12]),
          netCash: toDecimal(row?.[13]),
          closingCash: toDecimal(row?.[14]),
        },
      })
    }
  }
}

export function monthNameToNumber(label: string) {
  const lookup: Record<string, number> = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
  }
  return lookup[label] ?? null
}

export function quarterLabelToNumber(label: string) {
  const lookup: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 }
  return lookup[label] ?? null
}
