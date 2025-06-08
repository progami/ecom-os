import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getWarehouseFilter } from '@/lib/wms/utils/auth-utils'
import { Money } from '@/lib/wms/utils/financial-utils'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reportType, period, warehouseId, format: outputFormat = 'xlsx' } = await request.json()

    // Validate warehouse access
    const warehouseFilter = getWarehouseFilter(session, warehouseId)
    if (warehouseFilter === null) {
      return NextResponse.json({ error: 'Access denied to reports' }, { status: 403 })
    }

    let data: any[] = []
    let fileName = ''
    let sheetName = 'Report'

    switch (reportType) {
      case 'invoice-reconciliation':
        const result = await generateInvoiceReconciliationReport(period, warehouseFilter)
        data = result.data
        fileName = `invoice_reconciliation_${period}`
        sheetName = 'Reconciliation'
        break
        
      case 'cost-variance':
        data = await generateCostVarianceReport(period, warehouseFilter)
        fileName = `cost_variance_${period}`
        sheetName = 'Cost Variance'
        break
        
      case 'payment-status':
        data = await generatePaymentStatusReport(period, warehouseFilter)
        fileName = `payment_status_${period}`
        sheetName = 'Payment Status'
        break
        
      case 'financial-summary':
        data = await generateFinancialSummaryReport(period, warehouseFilter)
        fileName = `financial_summary_${period}`
        sheetName = 'Financial Summary'
        break

      case 'disputed-invoices':
        data = await generateDisputedInvoicesReport(warehouseFilter)
        fileName = `disputed_invoices_${new Date().toISOString().split('T')[0]}`
        sheetName = 'Disputed Invoices'
        break

      case 'aging-report':
        data = await generateAgingReport(warehouseFilter)
        fileName = `aging_report_${new Date().toISOString().split('T')[0]}`
        sheetName = 'Aging Report'
        break

      case 'cost-by-category':
        data = await generateCostByCategoryReport(period, warehouseFilter)
        fileName = `cost_by_category_${period}`
        sheetName = 'Cost by Category'
        break

      case 'warehouse-comparison':
        data = await generateWarehouseComparisonReport(period)
        fileName = `warehouse_comparison_${period}`
        sheetName = 'Warehouse Comparison'
        break
        
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    if (outputFormat === 'json') {
      return NextResponse.json({ data, generated: new Date().toISOString() })
    }

    // Create workbook with formatting
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    
    // Add some basic formatting
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    
    // Style headers
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!ws[cellAddress]) continue
      ws[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "4472C4" } },
        alignment: { horizontal: "center" }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return file
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Financial report generation error:', error)
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}

// Report generation functions (simplified versions)
async function generateInvoiceReconciliationReport(period: string, warehouseFilter: any) {
  const [year, month] = period.split('-').map(Number)
  const startDate = new Date(year, month - 2, 16)
  const endDate = new Date(year, month - 1, 15)

  const invoices = await prisma.wmsInvoice.findMany({
    where: {
      ...warehouseFilter,
      billingPeriodStart: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      warehouse: true,
      lineItems: true,
      reconciliations: {
        include: {
          resolvedBy: true,
        }
      },
    },
    orderBy: {
      invoiceDate: 'asc',
    },
  })

  const data: any[] = []
  let summaryData: any = {
    totalInvoices: 0,
    totalInvoicedAmount: 0,
    totalExpectedAmount: 0,
    totalVariance: 0,
    matchedItems: 0,
    varianceItems: 0,
  }

  for (const invoice of invoices) {
    summaryData.totalInvoices++
    summaryData.totalInvoicedAmount += Number(invoice.totalAmount)

    for (const recon of invoice.reconciliations) {
      summaryData.totalExpectedAmount += Number(recon.expectedAmount)
      
      if (recon.status === 'match') {
        summaryData.matchedItems++
      } else {
        summaryData.varianceItems++
      }

      data.push({
        'Invoice Number': invoice.invoiceNumber,
        'Invoice Date': format(invoice.invoiceDate, 'yyyy-MM-dd'),
        'Warehouse': invoice.warehouse.name,
        'Status': invoice.status.toUpperCase(),
        'Category': recon.costCategory,
        'Cost Item': recon.costName,
        'Expected Amount': Money.fromPrismaDecimal(recon.expectedAmount).format(),
        'Invoiced Amount': Money.fromPrismaDecimal(recon.invoicedAmount).format(),
        'Variance': Money.fromPrismaDecimal(recon.difference).format(),
        'Variance %': recon.expectedAmount > 0 
          ? `${((Number(recon.difference) / Number(recon.expectedAmount)) * 100).toFixed(2)}%`
          : 'N/A',
        'Match Status': recon.status.toUpperCase(),
        'Resolution Notes': recon.resolutionNotes || '',
        'Resolved By': recon.resolvedBy?.fullName || '',
        'Resolved Date': recon.resolvedAt ? format(recon.resolvedAt, 'yyyy-MM-dd') : '',
      })
    }
  }

  summaryData.totalVariance = summaryData.totalInvoicedAmount - summaryData.totalExpectedAmount

  return { data, summary: summaryData }
}

async function generateCostVarianceReport(period: string, warehouseFilter: any) {
  const [year, month] = period.split('-').map(Number)
  const startDate = new Date(year, month - 2, 16)
  const endDate = new Date(year, month - 1, 15)

  const reconciliations = await prisma.wmsInvoiceReconciliation.findMany({
    where: {
      invoice: {
        ...warehouseFilter,
        billingPeriodStart: {
          gte: startDate,
          lte: endDate,
        },
      },
      status: { not: 'match' },
    },
    include: {
      invoice: {
        include: {
          warehouse: true,
        }
      },
    },
    orderBy: [
      { difference: 'desc' },
    ],
  })

  return reconciliations.map(recon => ({
    'Invoice Number': recon.invoice.invoiceNumber,
    'Warehouse': recon.invoice.warehouse.name,
    'Category': recon.costCategory,
    'Cost Item': recon.costName,
    'Expected': Money.fromPrismaDecimal(recon.expectedAmount).format(),
    'Invoiced': Money.fromPrismaDecimal(recon.invoicedAmount).format(),
    'Variance': Money.fromPrismaDecimal(recon.difference).format(),
    'Variance Type': Number(recon.difference) > 0 ? 'OVERBILLED' : 'UNDERBILLED',
    'Impact': Math.abs(Number(recon.difference)) > 100 ? 'HIGH' : 'LOW',
    'Status': recon.invoice.status.toUpperCase(),
    'Resolution': recon.resolutionNotes || 'PENDING',
  }))
}

async function generatePaymentStatusReport(period: string, warehouseFilter: any) {
  const [year, month] = period.split('-').map(Number)
  const startDate = startOfMonth(new Date(year, month - 1))
  const endDate = endOfMonth(new Date(year, month - 1))

  const invoices = await prisma.wmsInvoice.findMany({
    where: {
      ...warehouseFilter,
      invoiceDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      warehouse: true,
      createdBy: true,
    },
    orderBy: {
      dueDate: 'asc',
    },
  })

  const now = new Date()

  return invoices.map(invoice => {
    const daysOverdue = invoice.dueDate 
      ? Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    return {
      'Invoice Number': invoice.invoiceNumber,
      'Warehouse': invoice.warehouse.name,
      'Invoice Date': format(invoice.invoiceDate, 'yyyy-MM-dd'),
      'Due Date': invoice.dueDate ? format(invoice.dueDate, 'yyyy-MM-dd') : 'Not Set',
      'Amount': Money.fromPrismaDecimal(invoice.totalAmount).format(),
      'Status': invoice.status.toUpperCase(),
      'Days Overdue': invoice.status !== 'paid' && daysOverdue > 0 ? daysOverdue : '',
      'Aging': invoice.status !== 'paid' 
        ? daysOverdue > 90 ? '90+ days'
          : daysOverdue > 60 ? '61-90 days'
          : daysOverdue > 30 ? '31-60 days'
          : daysOverdue > 0 ? '1-30 days'
          : 'Current'
        : 'Paid',
      'Created By': invoice.createdBy.fullName,
      'Notes': invoice.notes || '',
    }
  })
}

async function generateFinancialSummaryReport(period: string, warehouseFilter: any) {
  const [year, month] = period.split('-').map(Number)
  const startDate = new Date(year, month - 2, 16)
  const endDate = new Date(year, month - 1, 15)

  const invoices = await prisma.wmsInvoice.findMany({
    where: {
      ...warehouseFilter,
      billingPeriodStart: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      warehouse: true,
      lineItems: true,
      reconciliations: true,
    },
  })

  const warehouseSummary = new Map<string, any>()

  for (const invoice of invoices) {
    const warehouseId = invoice.warehouseId
    if (!warehouseSummary.has(warehouseId)) {
      warehouseSummary.set(warehouseId, {
        warehouse: invoice.warehouse,
        invoiceCount: 0,
        totalInvoiced: 0,
        totalExpected: 0,
        totalPaid: 0,
        totalDisputed: 0,
        categories: new Map<string, number>(),
      })
    }

    const summary = warehouseSummary.get(warehouseId)!
    summary.invoiceCount++
    summary.totalInvoiced += Number(invoice.totalAmount)

    if (invoice.status === 'paid') {
      summary.totalPaid += Number(invoice.totalAmount)
    } else if (invoice.status === 'disputed') {
      summary.totalDisputed += Number(invoice.totalAmount)
    }

    for (const recon of invoice.reconciliations) {
      summary.totalExpected += Number(recon.expectedAmount)
      
      const category = recon.costCategory
      const current = summary.categories.get(category) || 0
      summary.categories.set(category, current + Number(recon.invoicedAmount))
    }
  }

  const data: any[] = []

  for (const [warehouseId, summary] of warehouseSummary) {
    data.push({
      'Warehouse': summary.warehouse.name,
      'Type': 'SUMMARY',
      'Invoices': summary.invoiceCount,
      'Total Invoiced': `£${summary.totalInvoiced.toFixed(2)}`,
      'Total Expected': `£${summary.totalExpected.toFixed(2)}`,
      'Variance': `£${(summary.totalInvoiced - summary.totalExpected).toFixed(2)}`,
      'Paid': `£${summary.totalPaid.toFixed(2)}`,
      'Outstanding': `£${(summary.totalInvoiced - summary.totalPaid).toFixed(2)}`,
      'Disputed': `£${summary.totalDisputed.toFixed(2)}`,
      'Period': `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
    })
  }

  return data
}

async function generateDisputedInvoicesReport(warehouseFilter: any) {
  const invoices = await prisma.wmsInvoice.findMany({
    where: {
      ...warehouseFilter,
      status: 'disputed',
    },
    include: {
      warehouse: true,
      reconciliations: {
        where: {
          status: { not: 'match' },
        },
      },
      createdBy: true,
    },
    orderBy: {
      invoiceDate: 'desc',
    },
  })

  return invoices.map(invoice => {
    const totalDisputed = invoice.reconciliations.reduce(
      (sum, r) => sum + Math.abs(Number(r.difference)), 
      0
    )

    return {
      'Invoice Number': invoice.invoiceNumber,
      'Warehouse': invoice.warehouse.name,
      'Invoice Date': format(invoice.invoiceDate, 'yyyy-MM-dd'),
      'Total Amount': Money.fromPrismaDecimal(invoice.totalAmount).format(),
      'Disputed Amount': `£${totalDisputed.toFixed(2)}`,
      'Disputed Items': invoice.reconciliations.length,
      'Main Issues': invoice.reconciliations
        .slice(0, 3)
        .map(r => `${r.costCategory}: ${r.costName}`)
        .join('; '),
      'Status': 'DISPUTED',
      'Created By': invoice.createdBy.fullName,
      'Days Open': Math.floor(
        (new Date().getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }
  })
}

async function generateAgingReport(warehouseFilter: any) {
  const invoices = await prisma.wmsInvoice.findMany({
    where: {
      ...warehouseFilter,
      status: { not: 'paid' },
    },
    include: {
      warehouse: true,
    },
    orderBy: {
      dueDate: 'asc',
    },
  })

  const now = new Date()
  const aging = {
    current: { count: 0, amount: 0 },
    '1-30': { count: 0, amount: 0 },
    '31-60': { count: 0, amount: 0 },
    '61-90': { count: 0, amount: 0 },
    '90+': { count: 0, amount: 0 },
  }

  const data = invoices.map(invoice => {
    const daysOverdue = invoice.dueDate 
      ? Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    let agingBucket = 'current'
    if (daysOverdue > 90) agingBucket = '90+'
    else if (daysOverdue > 60) agingBucket = '61-90'
    else if (daysOverdue > 30) agingBucket = '31-60'
    else if (daysOverdue > 0) agingBucket = '1-30'

    aging[agingBucket].count++
    aging[agingBucket].amount += Number(invoice.totalAmount)

    return {
      'Invoice Number': invoice.invoiceNumber,
      'Warehouse': invoice.warehouse.name,
      'Invoice Date': format(invoice.invoiceDate, 'yyyy-MM-dd'),
      'Due Date': invoice.dueDate ? format(invoice.dueDate, 'yyyy-MM-dd') : 'Not Set',
      'Days Overdue': daysOverdue > 0 ? daysOverdue : '',
      'Aging Bucket': agingBucket.toUpperCase(),
      'Amount': Money.fromPrismaDecimal(invoice.totalAmount).format(),
      'Status': invoice.status.toUpperCase(),
    }
  })

  return data
}

async function generateCostByCategoryReport(period: string, warehouseFilter: any) {
  const [year, month] = period.split('-').map(Number)
  const startDate = new Date(year, month - 2, 16)
  const endDate = new Date(year, month - 1, 15)

  const lineItems = await prisma.wmsInvoiceLineItem.findMany({
    where: {
      invoice: {
        ...warehouseFilter,
        billingPeriodStart: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    include: {
      invoice: {
        include: {
          warehouse: true,
        }
      },
    },
  })

  const categoryData = new Map<string, Map<string, number>>()

  for (const item of lineItems) {
    const category = item.costCategory
    if (!categoryData.has(category)) {
      categoryData.set(category, new Map())
    }

    const warehouseData = categoryData.get(category)!
    const warehouseName = item.invoice.warehouse.name
    const current = warehouseData.get(warehouseName) || 0
    warehouseData.set(warehouseName, current + Number(item.amount))
  }

  const data: any[] = []

  for (const [category, warehouses] of categoryData) {
    let categoryTotal = 0
    
    for (const [warehouse, amount] of warehouses) {
      categoryTotal += amount
      data.push({
        'Category': category,
        'Warehouse': warehouse,
        'Total Cost': `£${amount.toFixed(2)}`,
        'Average per Invoice': `£${(amount / lineItems.filter(i => 
          i.costCategory === category && 
          i.invoice.warehouse.name === warehouse
        ).length).toFixed(2)}`,
        'Period': `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`,
      })
    }

    data.push({
      'Category': `TOTAL: ${category}`,
      'Warehouse': 'All Warehouses',
      'Total Cost': `£${categoryTotal.toFixed(2)}`,
      'Average per Invoice': '',
      'Period': '',
    })
  }

  return data
}

async function generateWarehouseComparisonReport(period: string) {
  const [year, month] = period.split('-').map(Number)
  const startDate = new Date(year, month - 2, 16)
  const endDate = new Date(year, month - 1, 15)

  const warehouses = await prisma.wmsWarehouse.findMany({
    where: {
      NOT: {
        OR: [
          { code: 'AMZN' },
          { code: 'AMZN-UK' }
        ]
      }
    },
    include: {
      invoices: {
        where: {
          billingPeriodStart: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          reconciliations: true,
          lineItems: true,
        }
      }
    }
  })

  return warehouses.map(warehouse => {
    const invoices = warehouse.invoices
    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
    const totalExpected = invoices.reduce((sum, inv) => 
      sum + inv.reconciliations.reduce((s, r) => s + Number(r.expectedAmount), 0), 0
    )
    const matchedCount = invoices.reduce((sum, inv) => 
      sum + inv.reconciliations.filter(r => r.status === 'match').length, 0
    )
    const totalItems = invoices.reduce((sum, inv) => sum + inv.reconciliations.length, 0)

    const categoryBreakdown = new Map<string, number>()
    for (const invoice of invoices) {
      for (const item of invoice.lineItems) {
        const current = categoryBreakdown.get(item.costCategory) || 0
        categoryBreakdown.set(item.costCategory, current + Number(item.amount))
      }
    }

    const topCategory = [...categoryBreakdown.entries()]
      .sort((a, b) => b[1] - a[1])[0]

    return {
      'Warehouse': warehouse.name,
      'Code': warehouse.code,
      'Invoices': invoices.length,
      'Total Invoiced': `£${totalInvoiced.toFixed(2)}`,
      'Total Expected': `£${totalExpected.toFixed(2)}`,
      'Variance': `£${(totalInvoiced - totalExpected).toFixed(2)}`,
      'Variance %': totalExpected > 0 
        ? `${(((totalInvoiced - totalExpected) / totalExpected) * 100).toFixed(2)}%`
        : 'N/A',
      'Match Rate': totalItems > 0 
        ? `${((matchedCount / totalItems) * 100).toFixed(1)}%`
        : 'N/A',
      'Top Cost Category': topCategory ? `${topCategory[0]} (£${topCategory[1].toFixed(2)})` : 'N/A',
      'Period': `${format(startDate, 'MMM yyyy')}`,
    }
  })
}