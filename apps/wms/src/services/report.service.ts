import { BaseService, ServiceContext } from './base.service'
import * as XLSX from 'xlsx'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { perfLogger } from '@/lib/logger/server'
import { Prisma } from '@prisma/client'

export interface ReportParams {
  reportType: string
  period?: string
  warehouseId?: string
  format?: 'xlsx' | 'csv' | 'pdf'
}

export class ReportService extends BaseService {
  constructor(context: ServiceContext) {
    super(context)
  }

  /**
   * Generate report based on type and parameters
   */
  async generateReport(params: ReportParams) {
    const startTime = Date.now()
    
    try {
      await this.requirePermission('report:generate')

      let data: Record<string, unknown>[] = []
      let fileName = ''

      switch (params.reportType) {
        case 'monthly-inventory':
          data = await this.generateMonthlyInventoryReport(params.period!, params.warehouseId)
          fileName = `monthly_inventory_${params.period}`
          break
          
        case 'inventory-ledger':
          data = await this.generateInventoryLedger(params.period!, params.warehouseId)
          fileName = `inventory_ledger_${params.period}`
          break
          
        case 'storage-charges':
          data = await this.generateStorageCharges(params.period!, params.warehouseId)
          fileName = `storage_charges_${params.period}`
          break
          
        case 'cost-summary':
          data = await this.generateCostSummary(params.period!, params.warehouseId)
          fileName = `cost_summary_${params.period}`
          break

        case 'reconciliation':
          data = await this.generateReconciliationReport(params.period!, params.warehouseId)
          fileName = `reconciliation_${params.period}`
          break

        case 'inventory-balance':
          data = await this.generateInventoryBalanceReport(params.warehouseId)
          fileName = `inventory_balance_${new Date().toISOString().split('T')[0]}`
          break

        case 'low-stock':
          data = await this.generateLowStockReport(params.warehouseId)
          fileName = `low_stock_${new Date().toISOString().split('T')[0]}`
          break

        case 'cost-analysis':
          data = await this.generateCostAnalysisReport(params.period!, params.warehouseId)
          fileName = `cost_analysis_${params.period}`
          break

        case 'monthly-billing':
          data = await this.generateMonthlyBillingReport(params.period!, params.warehouseId)
          fileName = `monthly_billing_${params.period}`
          break

        case 'analytics-summary':
          data = await this.generateAnalyticsSummaryReport(params.period!, params.warehouseId)
          fileName = `analytics_summary_${params.period}`
          break

        case 'performance-metrics':
          data = await this.generatePerformanceMetricsReport(params.period!, params.warehouseId)
          fileName = `performance_metrics_${params.period}`
          break
          
        default:
          throw new Error('Invalid report type')
      }

      const duration = Date.now() - startTime
      
      await this.logAudit('REPORT_GENERATED', 'Report', params.reportType, {
        reportType: params.reportType,
        period: params.period,
        warehouseId: params.warehouseId,
        format: params.format,
        recordCount: data.length
      })

      perfLogger.log('Report generated', {
        reportType: params.reportType,
        recordCount: data.length,
        duration
      })

      // Generate file based on format
      const outputFormat = params.format || 'xlsx'
      let fileBuffer: Buffer
      let contentType: string
      
      if (outputFormat === 'pdf') {
        fileBuffer = await this.generatePDF(data, params.reportType, params.period || 'current')
        contentType = 'application/pdf'
      } else if (outputFormat === 'csv') {
        const csv = this.generateCSV(data)
        fileBuffer = Buffer.from(csv)
        contentType = 'text/csv'
      } else {
        // Default to Excel
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(data)
        XLSX.utils.book_append_sheet(wb, ws, 'Report')
        fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }

      return {
        fileName: `${fileName}.${outputFormat}`,
        contentType,
        buffer: fileBuffer
      }
    } catch (_error) {
      this.handleError(_error, 'generateReport')
    }
  }

  /**
   * Report generation methods
   */
  private async generateMonthlyInventoryReport(period: string, _warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const _startDate = startOfMonth(new Date(year, month - 1))
    const _endDate = endOfMonth(new Date(year, month - 1))

    // Since inventory_balances table was removed, return empty data
    // In production, this would calculate from transactions
    interface InventoryBalance {
      warehouse: { name: string }
      sku: { skuCode: string; description: string }
      batchLot: string
      currentCartons: number
      currentPallets: number
      currentUnits: number
      lastReceived: Date | null
      lastShipped: Date | null
    }
    const balances: InventoryBalance[] = []

    return balances.map(b => ({
      'Warehouse': b.warehouse.name,
      'SKU Code': b.sku.skuCode,
      'Description': b.sku.description,
      'Batch/Lot': b.batchLot,
      'Current Cartons': b.currentCartons,
      'Current Pallets': b.currentPallets,
      'Units per Carton (Current)': b.sku.unitsPerCarton,
      'Total Units': b.currentUnits,
      'Report Date': new Date().toLocaleDateString()
    }))
  }

  private async generateInventoryLedger(period: string, _warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = startOfMonth(new Date(year, month - 1))
    const endDate = endOfMonth(new Date(year, month - 1))

    const where: Prisma.InventoryTransactionWhereInput = {
      ...(warehouseId 
        ? { warehouseId: warehouseId } 
        : {
            warehouse: {
              NOT: {
                OR: [
                  { code: 'AMZN' },
                  { code: 'AMZN-UK' }
                ]
              }
            }
          }
      ),
      transactionDate: {
        gte: startDate,
        lte: endDate
      }
    }

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where,
      // No includes needed - transactions have snapshot data
      orderBy: { createdAt: 'desc' }
    })

    return transactions.map(t => ({
      'Date': new Date(t.transactionDate).toLocaleDateString(),
      'Reference ID': t.referenceId || 'N/A',
      'Warehouse': t.warehouseName,
      'SKU': t.skuCode,
      'Batch/Lot': t.batchLot,
      'Type': t.transactionType,
      'Reference': t.referenceId || '',
      'Cartons In': t.cartonsIn,
      'Cartons Out': t.cartonsOut,
      'Units per Carton': t.unitsPerCarton,
      'Units In': t.cartonsIn * (t.unitsPerCarton || 1),
      'Units Out': t.cartonsOut * (t.unitsPerCarton || 1),
      'Created By': t.createdByName
    }))
  }

  private async generateStorageCharges(period: string, _warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    
    // Billing periods run from 16th to 15th
    const billingStart = new Date(year, month - 2, 16)
    const billingEnd = new Date(year, month - 1, 15)

    const where: Prisma.StorageLedgerWhereInput = {
      ...(warehouseId 
        ? { warehouseId: warehouseId } 
        : {
            warehouse: {
              NOT: {
                OR: [
                  { code: 'AMZN' },
                  { code: 'AMZN-UK' }
                ]
              }
            }
          }
      ),
      weekEndingDate: {
        gte: billingStart,
        lte: billingEnd
      }
    }

    const storageLedger = await this.prisma.storageLedger.findMany({
      where,
      // No includes needed - storage ledger has snapshot data
      orderBy: [
        { warehouseName: 'asc' },
        { weekEndingDate: 'asc' },
        { skuCode: 'asc' }
      ]
    })

    return storageLedger.map(s => ({
      'Week Ending': new Date(s.weekEndingDate).toLocaleDateString(),
      'Warehouse': s.warehouseName,
      'SKU': s.skuCode,
      'Batch/Lot': s.batchLot,
      'Opening Balance': s.openingBalance,
      'Closing Balance': s.closingBalance,
      'Average Balance': Number(s.averageBalance),
      'Billing Period': `${billingStart.toLocaleDateString()} - ${billingEnd.toLocaleDateString()}`
    }))
  }

  private async generateCostSummary(period: string, _warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    
    // Get storage costs
    const storageCosts = await this.prisma.storageLedger.groupBy({
      by: ['warehouseCode'],
      where: {
        ...(warehouseId ? { warehouseId: warehouseId } : {}),
        weekEndingDate: {
          gte: new Date(year, month - 2, 16),
          lte: new Date(year, month - 1, 15)
        }
      },
      _sum: {
        averageBalance: true
      }
    })

    // Get warehouse names (excluding Amazon FBA)
    const warehouses = await this.prisma.warehouse.findMany({
      where: {
        NOT: {
          OR: [
            { code: 'AMZN' },
            { code: 'AMZN-UK' }
          ]
        }
      }
    })
    const warehouseMap = new Map(warehouses.map(w => [w.id, w.name]))

    return storageCosts.map(cost => ({
      'Warehouse': warehouseMap.get(cost.warehouseCode) || 'Unknown',
      'Storage Costs': cost._sum.averageBalance || 0,
      'Handling Costs': 0, // To be calculated from calculated_costs table
      'Other Costs': 0, // To be calculated
      'Total Costs': cost._sum.averageBalance || 0,
      'Period': `${period}`
    }))
  }

  private async generateReconciliationReport(period: string, _warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = new Date(year, month - 2, 16)
    const endDate = new Date(year, month - 1, 15)

    // Invoice model removed in v0.5.0
    const invoices: Array<{
      invoiceNumber: string
      customerName: string
      warehouseName: string
      date: Date
      dueDate: Date
      totalAmount: number
      status: string
      lineItems: Array<{ description: string; quantity: number; rate: number; amount: number }>
    }> = []

    // Get calculated costs for the same period
    const calculatedCosts = await this.prisma.storageLedger.groupBy({
      by: ['warehouseCode'],
      where: {
        weekEndingDate: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: {
        averageBalance: true
      }
    })

    const costMap = new Map<string, number>(
      calculatedCosts.map(c => [c.warehouseCode, Number(c._sum.averageBalance || 0)])
    )

    return invoices.map(invoice => ({
      'Invoice Number': invoice.invoiceNumber,
      'Invoice Date': invoice.invoiceDate.toLocaleDateString(),
      'Warehouse': invoice.warehouse.name,
      'Invoiced Amount': `£${Number(invoice.totalAmount).toFixed(2)}`,
      'Calculated Amount': `£${(costMap.get(invoice.warehouseCode) || 0).toFixed(2)}`,
      'Variance': `£${(Number(invoice.totalAmount) - (costMap.get(invoice.warehouseCode) || 0)).toFixed(2)}`,
      'Status': Math.abs(Number(invoice.totalAmount) - (costMap.get(invoice.warehouseCode) || 0)) < 0.01 ? 'Matched' : 'Variance'
    }))
  }

  private async generateInventoryBalanceReport(_warehouseId?: string) {
    // inventory_balances table removed - returning empty data
    const data: Record<string, unknown>[] = []
    return data
  }

  private async generateLowStockReport(_warehouseId?: string) {
    // inventory_balances table removed - returning empty data
    const data: Record<string, unknown>[] = []
    return data
  }

  private async generateCostAnalysisReport(period: string, _warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = new Date(year, month - 2, 16)
    const endDate = new Date(year, month - 1, 15)

    const storageCosts = await this.prisma.storageLedger.findMany({
      where: {
        ...(warehouseId ? { warehouseCode: warehouseId } : {}),
        weekEndingDate: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: [
        { warehouseName: 'asc' },
        { skuCode: 'asc' }
      ]
    })

    const grouped = storageCosts.reduce((acc, item) => {
      const key = `${item.warehouseCode}-${item.skuCode}`
      if (!acc[key]) {
        acc[key] = {
          warehouse: 'Unknown',
          sku: 'Unknown',
          description: 'Unknown',
          totalCartons: 0,
          totalCost: 0,
          weeks: 0
        }
      }
      acc[key].totalCartons += item.closingBalance || 0
      acc[key].totalCost += Number(item.averageBalance || 0)
      acc[key].weeks += 1
      return acc
    }, {} as Record<string, { warehouseId: string; warehouseName: string; metrics: Record<string, number> }>)

    return Object.values(grouped).map((item: { warehouseId: string; warehouseName: string; metrics: Record<string, number> }) => ({
      'Warehouse': item.warehouse,
      'SKU Code': item.sku,
      'Description': item.description,
      'Average Cartons': Math.round(item.totalCartons / item.weeks),
      'Total Storage Cost': `£${item.totalCost.toFixed(2)}`,
      'Average Weekly Cost': `£${(item.totalCost / item.weeks).toFixed(2)}`,
      'Period': `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
    }))
  }

  private async generateMonthlyBillingReport(period: string, _warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const billingStart = new Date(year, month - 2, 16)
    const billingEnd = new Date(year, month - 1, 15)

    // Get all warehouses (excluding Amazon FBA)
    const warehouses = warehouseId 
      ? await this.prisma.warehouse.findMany({ where: { id: warehouseId } })
      : await this.prisma.warehouse.findMany({
          where: {
            NOT: {
              OR: [
                { code: 'AMZN' },
                { code: 'AMZN-UK' }
              ]
            }
          }
        })

    const billingData = await Promise.all(
      warehouses.map(async (warehouse) => {
        // Storage costs
        const storageCost = await this.prisma.storageLedger.aggregate({
          where: {
            warehouseCode: warehouse.code,
            weekEndingDate: {
              gte: billingStart,
              lte: billingEnd
            }
          },
          _sum: {
            averageBalance: true
          }
        })

        // Transaction counts
        const transactions = await this.prisma.inventoryTransaction.groupBy({
          by: ['transactionType'],
          where: {
            warehouseCode: warehouse.code,
            transactionDate: {
              gte: billingStart,
              lte: billingEnd
            }
          },
          _count: true
        })

        const receiveCount = transactions.find(t => t.transactionType === 'RECEIVE')?._count || 0
        const shipCount = transactions.find(t => t.transactionType === 'SHIP')?._count || 0

        return {
          'Warehouse': warehouse.name,
          'Storage Costs': `£${Number(storageCost._sum.averageBalance || 0).toFixed(2)}`,
          'Receiving Transactions': receiveCount,
          'Shipping Transactions': shipCount,
          'Handling Fees': `£${((receiveCount + shipCount) * 25).toFixed(2)}`, // £25 per transaction
          'Total Charges': `£${(Number(storageCost._sum.averageBalance || 0) + ((receiveCount + shipCount) * 25)).toFixed(2)}`,
          'Billing Period': `${billingStart.toLocaleDateString()} - ${billingEnd.toLocaleDateString()}`
        }
      })
    )

    return billingData
  }

  private async generateAnalyticsSummaryReport(period: string, _warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = startOfMonth(new Date(year, month - 1))
    const endDate = endOfMonth(new Date(year, month - 1))
    const prevStartDate = startOfMonth(subMonths(startDate, 1))
    const prevEndDate = endOfMonth(subMonths(startDate, 1))

    // Current period metrics
    const currentMetrics = await this.getMetricsForPeriod(startDate, endDate, warehouseId)
    // Previous period metrics for comparison
    const previousMetrics = await this.getMetricsForPeriod(prevStartDate, prevEndDate, warehouseId)

    const warehouses = warehouseId 
      ? await this.prisma.warehouse.findMany({ where: { id: warehouseId } })
      : await this.prisma.warehouse.findMany({
          where: {
            NOT: {
              OR: [
                { code: 'AMZN' },
                { code: 'AMZN-UK' }
              ]
            }
          }
        })

    const analyticsData = await Promise.all(
      warehouses.map(async (warehouse) => {
        const currentWarehouseMetrics = currentMetrics.get(warehouse.id) || {}
        const previousWarehouseMetrics = previousMetrics.get(warehouse.id) || {}

        const inventoryTurnover = currentWarehouseMetrics.shipments && currentWarehouseMetrics.avgInventory
          ? (currentWarehouseMetrics.shipments / currentWarehouseMetrics.avgInventory) * 12
          : 0

        const growthRate = previousWarehouseMetrics.totalTransactions
          ? ((currentWarehouseMetrics.totalTransactions - previousWarehouseMetrics.totalTransactions) / previousWarehouseMetrics.totalTransactions) * 100
          : 0

        return {
          'Warehouse': warehouse.name,
          'Total Transactions': currentWarehouseMetrics.totalTransactions || 0,
          'Growth Rate': `${growthRate.toFixed(1)}%`,
          'Avg Inventory (Cartons)': Math.round(currentWarehouseMetrics.avgInventory || 0),
          'Inventory Turnover': inventoryTurnover.toFixed(2),
          'Storage Utilization': `${((currentWarehouseMetrics.avgInventory || 0) / 10000 * 100).toFixed(1)}%`,
          'Total SKUs': currentWarehouseMetrics.totalSkus || 0,
          'Active SKUs': currentWarehouseMetrics.activeSkus || 0,
          'Period': format(startDate, 'MMMM yyyy')
        }
      })
    )

    return analyticsData
  }

  private async generatePerformanceMetricsReport(period: string, _warehouseId?: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = startOfMonth(new Date(year, month - 1))
    const endDate = endOfMonth(new Date(year, month - 1))

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        ...(warehouseId ? { warehouseCode: warehouseId } : {}),
        transactionDate: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    // Group by warehouse and calculate metrics
    const warehouseMetrics = transactions.reduce((acc, trans) => {
      if (!acc[trans.warehouseCode]) {
        acc[trans.warehouseCode] = {
          warehouseName: trans.warehouseName,
          totalTransactions: 0,
          receiveTransactions: 0,
          shipTransactions: 0,
          totalCartonsReceived: 0,
          totalCartonsShipped: 0,
          uniqueSkus: new Set(),
          transactionDates: []
        }
      }

      const metrics = acc[trans.warehouseCode]
      metrics.totalTransactions++
      
      if (trans.transactionType === 'RECEIVE') {
        metrics.receiveTransactions++
        metrics.totalCartonsReceived += trans.cartonsIn
      } else if (trans.transactionType === 'SHIP') {
        metrics.shipTransactions++
        metrics.totalCartonsShipped += trans.cartonsOut
      }
      
      metrics.uniqueSkus.add(trans.skuCode)
      metrics.transactionDates.push(trans.transactionDate)

      return acc
    }, {} as Record<string, { warehouseId: string; warehouseName: string; metrics: Record<string, number> }>)

    return Object.values(warehouseMetrics).map((metrics: Record<string, unknown>) => {
      const avgTransactionsPerDay = metrics.totalTransactions / 30
      const receiveToShipRatio = metrics.shipTransactions > 0 
        ? (metrics.receiveTransactions / metrics.shipTransactions).toFixed(2)
        : 'N/A'

      return {
        'Warehouse': metrics.warehouseName,
        'Total Transactions': metrics.totalTransactions,
        'Avg Daily Transactions': avgTransactionsPerDay.toFixed(1),
        'Receive Transactions': metrics.receiveTransactions,
        'Ship Transactions': metrics.shipTransactions,
        'Receive/Ship Ratio': receiveToShipRatio,
        'Total Cartons Received': metrics.totalCartonsReceived,
        'Total Cartons Shipped': metrics.totalCartonsShipped,
        'Unique SKUs Handled': metrics.uniqueSkus.size,
        'Period': format(startDate, 'MMMM yyyy')
      }
    })
  }

  /**
   * Helper methods
   */
  private async getMetricsForPeriod(startDate: Date, endDate: Date, _warehouseId?: string) {
    const transactions = await this.prisma.inventoryTransaction.groupBy({
      by: ['warehouseCode', 'transactionType'],
      where: {
        ...(warehouseId ? { warehouseCode: warehouseId } : {}),
        transactionDate: {
          gte: startDate,
          lte: endDate
        }
      },
      _count: true,
      _sum: {
        cartonsIn: true,
        cartonsOut: true
      }
    })

    // inventory_balances removed - using empty arrays
    const inventoryStats: Array<{ category: string; value: number | string }> = []
    const activeSkus: Array<{ skuCode: string; description: string; stock: number }> = []

    const metrics = new Map()

    // Process transactions
    transactions.forEach(t => {
      if (!metrics.has(t.warehouseCode)) {
        metrics.set(t.warehouseCode, {})
      }
      const m = metrics.get(t.warehouseCode)
      
      m.totalTransactions = (m.totalTransactions || 0) + t._count
      if (t.transactionType === 'SHIP') {
        m.shipments = (m.shipments || 0) + (t._sum.cartonsOut || 0)
      }
    })

    // Process inventory stats (empty for now)
    inventoryStats.forEach(stat => {
      if (!metrics.has(stat.warehouseCode)) {
        metrics.set(stat.warehouseCode, {})
      }
      const m = metrics.get(stat.warehouseCode)
      m.avgInventory = stat._avg.currentCartons || 0
      m.totalSkus = stat._count.skuCode
    })

    // Process active SKUs (empty for now)
    activeSkus.forEach(stat => {
      if (!metrics.has(stat.warehouseCode)) {
        metrics.set(stat.warehouseCode, {})
      }
      const m = metrics.get(stat.warehouseCode)
      m.activeSkus = stat._count.skuCode
    })

    return metrics
  }

  private generateCSV(data: Record<string, unknown>[]): string {
    if (data.length === 0) return ''
    
    const headers = Object.keys(data[0])
    const csvRows = []
    
    // Add headers
    csvRows.push(headers.join(','))
    
    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header]
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      })
      csvRows.push(values.join(','))
    }
    
    return csvRows.join('\n')
  }

  private async generatePDF(data: Record<string, unknown>[], reportType: string, period: string): Promise<Buffer> {
    const doc = new jsPDF()
    
    // Add title
    const title = reportType.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
    
    doc.setFontSize(20)
    doc.text(title, 14, 22)
    
    // Add period
    doc.setFontSize(12)
    doc.text(`Period: ${period}`, 14, 32)
    
    // Add generation date
    doc.setFontSize(10)
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy')}`, 14, 40)
    
    // Add table
    if (data.length > 0) {
      const headers = Object.keys(data[0])
      const rows = data.map(item => headers.map(header => String(item[header])))
      
      ;(doc as jsPDF & { autoTable: (options: unknown) => void }).autoTable({
        head: [headers],
        body: rows,
        startY: 50,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 133, 244] }
      })
    }
    
    return Buffer.from(doc.output('arraybuffer'))
  }
}