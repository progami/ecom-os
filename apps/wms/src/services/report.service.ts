import { BaseService, ServiceContext } from './base.service'
import * as XLSX from 'xlsx'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { perfLogger } from '@/lib/logger/server'
import { Prisma } from '@ecom-os/prisma-wms'
import type { ExportFieldValue } from '@/lib/dynamic-export'

type ReportRow = Record<string, ExportFieldValue>

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

 let data: ReportRow[] = []
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
 'Units per Carton (Current)': null,
 'Total Units': b.currentUnits,
 'Report Date': new Date().toLocaleDateString()
 }))
 }

 private async generateInventoryLedger(period: string, warehouseId?: string) {
 const [year, month] = period.split('-').map(Number)
 const startDate = startOfMonth(new Date(year, month - 1))
 const endDate = endOfMonth(new Date(year, month - 1))

 const warehouseCode = await this.resolveWarehouseCode(warehouseId)

 const where: Prisma.InventoryTransactionWhereInput = {
 transactionDate: {
 gte: startDate,
 lte: endDate
 }
 }

 if (warehouseCode) {
 where.warehouseCode = warehouseCode
 } else {
 where.warehouseCode = {
 notIn: ['AMZN', 'AMZN-UK']
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

 private async generateStorageCharges(period: string, warehouseId?: string) {
 const [year, month] = period.split('-').map(Number)
 
 // Billing periods run from 16th to 15th
 const billingStart = new Date(year, month - 2, 16)
 const billingEnd = new Date(year, month - 1, 15)

 const warehouseCode = await this.resolveWarehouseCode(warehouseId)

 const storageLedger = await this.prisma.storageLedger.findMany({
 where: {
 ...(warehouseCode
 ? { warehouseCode }
 : {
 warehouseCode: {
 notIn: ['AMZN', 'AMZN-UK']
 }
 }),
 weekEndingDate: {
 gte: billingStart,
 lte: billingEnd
 }
 },
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

 private async generateCostSummary(period: string, warehouseId?: string) {
 const [year, month] = period.split('-').map(Number)
 
 // Get storage costs
 const warehouseCode = await this.resolveWarehouseCode(warehouseId)

 const storageCosts = await this.prisma.storageLedger.groupBy({
 by: ['warehouseCode'],
 where: {
 ...(warehouseCode
 ? { warehouseCode }
 : {
 warehouseCode: {
 notIn: ['AMZN', 'AMZN-UK']
 }
 }),
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
 const warehouseMap = new Map(warehouses.map(w => [w.code, w.name]))

 return storageCosts.map(cost => {
 const storageTotal = Number(cost._sum.averageBalance ?? 0)
 return {
 'Warehouse': warehouseMap.get(cost.warehouseCode) || 'Unknown',
 'Storage Costs': storageTotal,
 'Handling Costs': 0, // To be calculated from calculated_costs table
 'Other Costs': 0, // To be calculated
 'Total Costs': storageTotal,
 'Period': `${period}`
 }
 })
 }

 private async generateReconciliationReport(period: string, _warehouseId?: string) {
 const [year, month] = period.split('-').map(Number)
 const startDate = new Date(year, month - 2, 16)
 const endDate = new Date(year, month - 1, 15)

 // Invoice model removed in v0.5.0
 void startDate; void endDate; // Reserved for future use

 // Invoices removed; reconciliation reporting is currently unavailable.
 return []
 }

 private async generateInventoryBalanceReport(_warehouseId?: string) {
 // inventory_balances table removed - returning empty data
 const data: ReportRow[] = []
 return data
 }

 private async generateLowStockReport(_warehouseId?: string) {
 // inventory_balances table removed - returning empty data
 const data: ReportRow[] = []
 return data
 }

 private async generateCostAnalysisReport(period: string, warehouseId?: string) {
 const [year, month] = period.split('-').map(Number)
 const startDate = new Date(year, month - 2, 16)
 const endDate = new Date(year, month - 1, 15)

 const warehouseCode = await this.resolveWarehouseCode(warehouseId)

 const storageCosts = await this.prisma.storageLedger.findMany({
 where: {
 ...(warehouseCode ? { warehouseCode } : {}),
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

 type CostGroup = {
 warehouseName: string
 skuCode: string
 skuDescription: string
 totalCartons: number
 totalCost: number
 weeks: number
 }

 const grouped = storageCosts.reduce<Record<string, CostGroup>>((acc, item) => {
 const key = `${item.warehouseCode}-${item.skuCode}`
 if (!acc[key]) {
 acc[key] = {
 warehouseName: item.warehouseName,
 skuCode: item.skuCode,
 skuDescription: item.skuDescription ?? 'Unknown',
 totalCartons: 0,
 totalCost: 0,
 weeks: 0
 }
 }
 acc[key].totalCartons += item.closingBalance || 0
 acc[key].totalCost += Number(item.totalStorageCost || 0)
 acc[key].weeks += 1
 return acc
 }, {})

 return Object.values(grouped).map(item => ({
 'Warehouse': item.warehouseName,
 'SKU Code': item.skuCode,
 'Description': item.skuDescription,
 'Average Cartons': Math.round(item.totalCartons / item.weeks),
 'Total Storage Cost': `£${item.totalCost.toFixed(2)}`,
 'Average Weekly Cost': `£${(item.totalCost / item.weeks).toFixed(2)}`,
 'Period': `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
 }))
 }

 private async generateMonthlyBillingReport(period: string, warehouseId?: string) {
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

 private async generateAnalyticsSummaryReport(period: string, warehouseId?: string) {
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
 const currentWarehouseMetrics = currentMetrics.get(warehouse.code) || {
 totalTransactions: 0,
 receiveTransactions: 0,
 shipTransactions: 0,
 cartonsIn: 0,
 cartonsOut: 0,
 uniqueSkus: new Set<string>()
 }
 const previousWarehouseMetrics = previousMetrics.get(warehouse.code) || {
 totalTransactions: 0,
 receiveTransactions: 0,
 shipTransactions: 0,
 cartonsIn: 0,
 cartonsOut: 0,
 uniqueSkus: new Set<string>()
 }

 const avgInventory = (currentWarehouseMetrics.cartonsIn + currentWarehouseMetrics.cartonsOut) / 2
 const shipments = currentWarehouseMetrics.cartonsOut

 const inventoryTurnover = avgInventory > 0
 ? (shipments / avgInventory) * 12
 : 0

 const growthRate = previousWarehouseMetrics.totalTransactions
 ? ((currentWarehouseMetrics.totalTransactions - previousWarehouseMetrics.totalTransactions) / previousWarehouseMetrics.totalTransactions) * 100
 : 0

 return {
 'Warehouse': warehouse.name,
 'Total Transactions': currentWarehouseMetrics.totalTransactions || 0,
 'Growth Rate': `${growthRate.toFixed(1)}%`,
 'Avg Inventory (Cartons)': Math.round(avgInventory),
 'Inventory Turnover': inventoryTurnover.toFixed(2),
 'Storage Utilization': `${((avgInventory) / 10000 * 100).toFixed(1)}%`,
 'Total SKUs': currentWarehouseMetrics.uniqueSkus.size,
 'Active SKUs': currentWarehouseMetrics.uniqueSkus.size,
 'Period': format(startDate, 'MMMM yyyy')
 }
 })
 )

 return analyticsData
 }

 private async generatePerformanceMetricsReport(period: string, warehouseId?: string) {
 const [year, month] = period.split('-').map(Number)
 const startDate = startOfMonth(new Date(year, month - 1))
 const endDate = endOfMonth(new Date(year, month - 1))

 const warehouseCode = await this.resolveWarehouseCode(warehouseId)

 const transactions = await this.prisma.inventoryTransaction.findMany({
 where: {
 ...(warehouseCode ? { warehouseCode } : {}),
 transactionDate: {
 gte: startDate,
 lte: endDate
 }
 }
 })

 type WarehousePerformanceMetrics = {
 warehouseName: string
 totalTransactions: number
 receiveTransactions: number
 shipTransactions: number
 totalCartonsReceived: number
 totalCartonsShipped: number
 uniqueSkus: Set<string>
 }

 const warehouseMetrics = transactions.reduce<Record<string, WarehousePerformanceMetrics>>((acc, trans) => {
 if (!acc[trans.warehouseCode]) {
 acc[trans.warehouseCode] = {
 warehouseName: trans.warehouseName,
 totalTransactions: 0,
 receiveTransactions: 0,
 shipTransactions: 0,
 totalCartonsReceived: 0,
 totalCartonsShipped: 0,
 uniqueSkus: new Set<string>()
 }
 }

 const metrics = acc[trans.warehouseCode]
 metrics.totalTransactions += 1

 if (trans.transactionType === 'RECEIVE') {
 metrics.receiveTransactions += 1
 metrics.totalCartonsReceived += trans.cartonsIn
 } else if (trans.transactionType === 'SHIP') {
 metrics.shipTransactions += 1
 metrics.totalCartonsShipped += trans.cartonsOut
 }

 metrics.uniqueSkus.add(trans.skuCode)
 return acc
 }, {})

 const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))

 return Object.values(warehouseMetrics).map(metrics => {
 const avgTransactionsPerDay = metrics.totalTransactions / totalDays
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
 private async getMetricsForPeriod(startDate: Date, endDate: Date, warehouseId?: string) {
 const warehouseCode = await this.resolveWarehouseCode(warehouseId)

 const transactions = await this.prisma.inventoryTransaction.findMany({
 where: {
 ...(warehouseCode ? { warehouseCode } : {}),
 transactionDate: {
 gte: startDate,
 lte: endDate
 }
 }
 })

 type MetricsSnapshot = {
 totalTransactions: number
 receiveTransactions: number
 shipTransactions: number
 cartonsIn: number
 cartonsOut: number
 uniqueSkus: Set<string>
 }

 const metrics = new Map<string, MetricsSnapshot>()

 transactions.forEach(t => {
 const existing = metrics.get(t.warehouseCode) ?? {
 totalTransactions: 0,
 receiveTransactions: 0,
 shipTransactions: 0,
 cartonsIn: 0,
 cartonsOut: 0,
 uniqueSkus: new Set<string>()
 }

 existing.totalTransactions += 1
 existing.cartonsIn += t.cartonsIn
 existing.cartonsOut += t.cartonsOut
 if (t.transactionType === 'RECEIVE') {
 existing.receiveTransactions += 1
 }
 if (t.transactionType === 'SHIP') {
 existing.shipTransactions += 1
 }
 existing.uniqueSkus.add(t.skuCode)

 metrics.set(t.warehouseCode, existing)
 })

 return metrics
 }

 private async resolveWarehouseCode(warehouseId?: string): Promise<string | undefined> {
 if (!warehouseId) {
 return undefined
 }
 const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } })
 return warehouse?.code ?? undefined
 }

 private generateCSV(data: ReportRow[]): string {
 if (data.length === 0) return ''

 const headers = Object.keys(data[0])
 const csvRows = []

 // Add headers
 csvRows.push(headers.join(','))
 
 // Add data rows
 for (const row of data) {
 const values = headers.map(header => {
 const value = row[header]

 if (value === null || value === undefined) {
 return ''
 }

 const normalized = value instanceof Date ? value.toISOString() : value

 if (typeof normalized === 'string') {
 return normalized.includes(',') || normalized.includes('"')
 ? `"${normalized.replace(/"/g, '""')}"`
 : normalized
 }

 if (typeof normalized === 'number' || typeof normalized === 'boolean') {
 return String(normalized)
 }

 return ''
 })
 csvRows.push(values.join(','))
 }

 return csvRows.join('\n')
 }

 private async generatePDF(data: ReportRow[], reportType: string, period: string): Promise<Buffer> {
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
 const rows = data.map(item =>
 headers.map(header => {
 const value = item[header]
 if (value === null || value === undefined) {
 return ''
 }
 if (value instanceof Date) {
 return format(value, 'yyyy-MM-dd')
 }
 return String(value)
 })
 )
 
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
