import { POST as runCalculations } from '@/app/api/calculations/route'
import { POST as generateReport } from '@/app/api/reports/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { mockSessions, mockData } from '../test-utils'
import * as XLSX from 'xlsx'

// Mock dependencies
jest.mock('next-auth/next')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    warehouse: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    sku: {
      findMany: jest.fn(),
    },
    inventoryBalance: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    inventoryTransaction: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    storageLedger: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    costRate: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    invoiceInput: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    calculatedCost: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
  },
}))

// Mock calculation services  
jest.mock('@/lib/calculations/storage-ledger')
jest.mock('xlsx')

describe('Billing and Reporting Workflow Integration Tests', () => {
  const mockGetServerSession = getServerSession as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue(mockSessions.admin)
  })

  const createRequest = (body: any) => {
    return new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  describe('Monthly Billing Cycle Workflow', () => {
    it('should complete full monthly billing cycle', async () => {
      // Setup test data
      const warehouse = mockData.warehouse({ id: 'wh-1', code: 'FMC' })
      const skus = [
        mockData.sku({ id: 'sku-1', skuCode: 'CS-001' }),
        mockData.sku({ id: 'sku-2', skuCode: 'CS-002' }),
      ]
      
      // Step 1: Generate storage ledger for billing period
      const mockGenerateStorageLedger = jest.requireMock('@/lib/calculations/storage-ledger').generateStorageLedgerForPeriod
      mockGenerateStorageLedger.mockResolvedValue(20) // 4 weeks * 5 SKUs

      const storageCalcRequest = createRequest({
        type: 'storage-ledger',
        year: 2024,
        month: 1,
        warehouseId: 'wh-1',
      })

      const storageCalcResponse = await runCalculations(storageCalcRequest)
      const storageCalcData = await storageCalcResponse.json()

      expect(storageCalcResponse.status).toBe(200)
      expect(storageCalcData.message).toBe('Generated 20 storage ledger entries')

      // Step 2: Generate monthly billing report
      const storageLedgerData = [
        mockData.storageLedger({
          warehouseId: 'wh-1',
          skuId: 'sku-1',
          batchLot: 'BATCH001',
          storagePalletsCharged: 5,
          calculatedWeeklyCost: 19.5,
          weekEndingDate: new Date('2024-01-07'),
          warehouse,
          sku: skus[0],
        }),
        mockData.storageLedger({
          warehouseId: 'wh-1',
          skuId: 'sku-1',
          batchLot: 'BATCH001',
          storagePalletsCharged: 5,
          calculatedWeeklyCost: 19.5,
          weekEndingDate: new Date('2024-01-14'),
          warehouse,
          sku: skus[0],
        }),
        mockData.storageLedger({
          warehouseId: 'wh-1',
          skuId: 'sku-2',
          batchLot: 'BATCH002',
          storagePalletsCharged: 3,
          calculatedWeeklyCost: 11.7,
          weekEndingDate: new Date('2024-01-07'),
          warehouse,
          sku: skus[1],
        }),
      ]

      ;(prisma.warehouse.findMany as jest.Mock).mockResolvedValue([warehouse])
      ;(prisma.storageLedger.findMany as jest.Mock).mockResolvedValue(storageLedgerData)
      ;(prisma.storageLedger.aggregate as jest.Mock).mockResolvedValue({
        _sum: { calculatedWeeklyCost: 50.7 },
      })
      ;(prisma.costRate.findMany as jest.Mock).mockResolvedValue([
        mockData.costRate({
          costCategory: 'Storage',
          costName: 'Weekly Storage',
          costValue: 3.9,
        }),
      ])

      // Mock XLSX workbook creation
      const mockWorkbook = { SheetNames: [], Sheets: {} }
      ;(XLSX.utils.book_new as jest.Mock).mockReturnValue(mockWorkbook)
      ;(XLSX.utils.json_to_sheet as jest.Mock).mockReturnValue({})
      ;(XLSX.utils.book_append_sheet as jest.Mock).mockImplementation()
      ;(XLSX.write as jest.Mock).mockReturnValue(Buffer.from('mock-excel-data'))

      const billingReportRequest = createRequest({
        reportType: 'monthly-billing',
        period: '2024-01',
        warehouseId: 'wh-1',
      })

      const billingReportResponse = await generateReport(billingReportRequest)
      const billingReportData = await billingReportResponse.json()

      expect(billingReportResponse.status).toBe(200)
      expect(billingReportData.success).toBe(true)
      expect(billingReportData.filename).toContain('billing-report-2024-01')
      
      // Verify storage ledger data was fetched for correct period
      expect(prisma.storageLedger.findMany).toHaveBeenCalledWith({
        where: {
          warehouseId: 'wh-1',
          billingPeriodStart: new Date('2023-12-16'),
          billingPeriodEnd: new Date('2024-01-15'),
        },
        include: {
          warehouse: true,
          sku: true,
        },
        orderBy: [
          { warehouseId: 'asc' },
          { skuId: 'asc' },
          { weekEndingDate: 'asc' },
        ],
      })

      // Step 3: Create invoice records
      const invoiceData = {
        warehouseId: 'wh-1',
        invoiceNumber: 'INV-2024-01-001',
        invoiceDate: new Date('2024-01-31'),
        billingPeriodStart: new Date('2023-12-16'),
        billingPeriodEnd: new Date('2024-01-15'),
        totalStorageCost: 50.7,
        totalHandlingCost: 25.0,
        totalAmount: 75.7,
      }

      ;(prisma.invoiceInput.create as jest.Mock).mockResolvedValue({
        id: 'invoice-1',
        ...invoiceData,
      })

      // Step 4: Generate reconciliation report
      ;(prisma.invoiceInput.findMany as jest.Mock).mockResolvedValue([
        {
          ...invoiceData,
          id: 'invoice-1',
          warehouse,
        },
      ])
      ;(prisma.calculatedCost.findMany as jest.Mock).mockResolvedValue([
        {
          warehouseId: 'wh-1',
          billingPeriodStart: new Date('2023-12-16'),
          billingPeriodEnd: new Date('2024-01-15'),
          totalStorageCost: 50.7,
          totalHandlingCost: 25.0,
          totalCost: 75.7,
        },
      ])

      const reconciliationRequest = createRequest({
        reportType: 'reconciliation',
        period: '2024-01',
        warehouseId: 'wh-1',
      })

      const reconciliationResponse = await generateReport(reconciliationRequest)
      const reconciliationData = await reconciliationResponse.json()

      expect(reconciliationResponse.status).toBe(200)
      expect(reconciliationData.success).toBe(true)
      expect(reconciliationData.filename).toContain('reconciliation-2024-01')
    })
  })

  describe('Multi-Warehouse Billing Workflow', () => {
    it('should generate consolidated billing for multiple warehouses', async () => {
      const warehouses = [
        mockData.warehouse({ id: 'wh-1', code: 'FMC', name: 'FMC' }),
        mockData.warehouse({ id: 'wh-2', code: 'HSQ', name: 'HSQ' }),
      ]

      // Generate storage ledger for all warehouses
      const mockGenerateStorageLedger = jest.requireMock('@/lib/calculations/storage-ledger').generateStorageLedgerForPeriod
      mockGenerateStorageLedger.mockResolvedValue(40) // Multiple warehouses

      const storageCalcRequest = createRequest({
        type: 'storage-ledger',
        year: 2024,
        month: 1,
        // No warehouseId - calculate for all
      })

      const storageCalcResponse = await runCalculations(storageCalcRequest)
      expect(storageCalcResponse.status).toBe(200)

      // Generate consolidated report
      const storageLedgerData = [
        // Warehouse 1 data
        mockData.storageLedger({
          warehouseId: 'wh-1',
          calculatedWeeklyCost: 100,
          warehouse: warehouses[0],
        }),
        mockData.storageLedger({
          warehouseId: 'wh-1',
          calculatedWeeklyCost: 100,
          warehouse: warehouses[0],
        }),
        // Warehouse 2 data
        mockData.storageLedger({
          warehouseId: 'wh-2',
          calculatedWeeklyCost: 150,
          warehouse: warehouses[1],
        }),
        mockData.storageLedger({
          warehouseId: 'wh-2',
          calculatedWeeklyCost: 150,
          warehouse: warehouses[1],
        }),
      ]

      ;(prisma.warehouse.findMany as jest.Mock).mockResolvedValue(warehouses)
      ;(prisma.storageLedger.findMany as jest.Mock).mockResolvedValue(storageLedgerData)
      ;(prisma.storageLedger.aggregate as jest.Mock).mockResolvedValue({
        _sum: { calculatedWeeklyCost: 500 },
      })

      const mockWorkbook = { SheetNames: [], Sheets: {} }
      ;(XLSX.utils.book_new as jest.Mock).mockReturnValue(mockWorkbook)
      ;(XLSX.utils.json_to_sheet as jest.Mock).mockReturnValue({})
      ;(XLSX.write as jest.Mock).mockReturnValue(Buffer.from('mock-excel-data'))

      const consolidatedRequest = createRequest({
        reportType: 'monthly-billing',
        period: '2024-01',
        // No warehouseId - generate for all
      })

      const response = await generateReport(consolidatedRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.filename).toContain('billing-report-2024-01')
      
      // Should create sheets for each warehouse
      expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(warehouses.length + 1) // +1 for summary
    })
  })

  describe('Cost Category Breakdown Workflow', () => {
    it('should calculate costs by category', async () => {
      const warehouse = mockData.warehouse({ id: 'wh-1', code: 'FMC' })
      const costRates = [
        mockData.costRate({
          costCategory: 'Storage',
          costName: 'Weekly Storage',
          costValue: 3.9,
          unitOfMeasure: 'pallet/week',
        }),
        mockData.costRate({
          costCategory: 'Handling',
          costName: 'Inbound Handling',
          costValue: 0.5,
          unitOfMeasure: 'carton',
        }),
        mockData.costRate({
          costCategory: 'Handling',
          costName: 'Outbound Handling',
          costValue: 0.5,
          unitOfMeasure: 'carton',
        }),
      ]

      ;(prisma.warehouse.findMany as jest.Mock).mockResolvedValue([warehouse])
      ;(prisma.costRate.findMany as jest.Mock).mockResolvedValue(costRates)
      
      // Storage costs from ledger
      ;(prisma.storageLedger.findMany as jest.Mock).mockResolvedValue([
        mockData.storageLedger({ calculatedWeeklyCost: 100 }),
        mockData.storageLedger({ calculatedWeeklyCost: 100 }),
      ])
      ;(prisma.storageLedger.aggregate as jest.Mock).mockResolvedValue({
        _sum: { calculatedWeeklyCost: 200 },
      })

      // Handling costs from transactions
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
        mockData.inventoryTransaction({ cartonsIn: 500, cartonsOut: 0 }),
        mockData.inventoryTransaction({ cartonsIn: 0, cartonsOut: 300 }),
      ])
      ;(prisma.inventoryTransaction.aggregate as jest.Mock).mockResolvedValue({
        _sum: { cartonsIn: 500, cartonsOut: 300 },
      })

      const mockWorkbook = { SheetNames: [], Sheets: {} }
      ;(XLSX.utils.book_new as jest.Mock).mockReturnValue(mockWorkbook)
      ;(XLSX.utils.json_to_sheet as jest.Mock).mockReturnValue({})
      ;(XLSX.write as jest.Mock).mockReturnValue(Buffer.from('mock-excel-data'))

      const costBreakdownRequest = createRequest({
        reportType: 'cost-analysis',
        period: '2024-01',
        warehouseId: 'wh-1',
      })

      const response = await generateReport(costBreakdownRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.filename).toContain('cost-analysis-2024-01')

      // Verify cost calculations
      // Storage: $200
      // Inbound handling: 500 * $0.5 = $250
      // Outbound handling: 300 * $0.5 = $150
      // Total: $600
    })
  })

  describe('Invoice Reconciliation Workflow', () => {
    it('should identify discrepancies between invoices and calculations', async () => {
      const warehouse = mockData.warehouse({ id: 'wh-1', code: 'FMC' })

      // Invoice data (what was billed)
      const invoices = [
        {
          id: 'inv-1',
          warehouseId: 'wh-1',
          invoiceNumber: 'INV-001',
          billingPeriodStart: new Date('2023-12-16'),
          billingPeriodEnd: new Date('2024-01-15'),
          totalStorageCost: 200,
          totalHandlingCost: 400,
          totalAmount: 600,
          warehouse,
        },
      ]

      // Calculated data (what should have been billed)
      const calculatedCosts = [
        {
          warehouseId: 'wh-1',
          billingPeriodStart: new Date('2023-12-16'),
          billingPeriodEnd: new Date('2024-01-15'),
          totalStorageCost: 190, // $10 discrepancy
          totalHandlingCost: 395, // $5 discrepancy
          totalCost: 585, // $15 total discrepancy
        },
      ]

      ;(prisma.warehouse.findMany as jest.Mock).mockResolvedValue([warehouse])
      ;(prisma.invoiceInput.findMany as jest.Mock).mockResolvedValue(invoices)
      ;(prisma.calculatedCost.findMany as jest.Mock).mockResolvedValue(calculatedCosts)

      const mockWorkbook = { SheetNames: [], Sheets: {} }
      ;(XLSX.utils.book_new as jest.Mock).mockReturnValue(mockWorkbook)
      ;(XLSX.utils.json_to_sheet as jest.Mock).mockReturnValue({})
      ;(XLSX.write as jest.Mock).mockReturnValue(Buffer.from('mock-excel-data'))

      const reconciliationRequest = createRequest({
        reportType: 'reconciliation',
        period: '2024-01',
        warehouseId: 'wh-1',
      })

      const response = await generateReport(reconciliationRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.filename).toContain('reconciliation-2024-01')

      // Verify reconciliation data includes discrepancies
      const sheetData = (XLSX.utils.json_to_sheet as jest.Mock).mock.calls[0][0]
      expect(sheetData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            warehouse: 'FMC',
            invoiceNumber: 'INV-001',
            invoicedAmount: 600,
            calculatedAmount: 585,
            discrepancy: 15,
            storageDiscrepancy: 10,
            handlingDiscrepancy: 5,
          }),
        ])
      )
    })
  })

  describe('Historical Reporting Workflow', () => {
    it('should generate year-over-year comparison reports', async () => {
      const warehouse = mockData.warehouse({ id: 'wh-1', code: 'FMC' })

      // Mock data for multiple years
      const historicalData = [
        // 2023 data
        {
          year: 2023,
          month: 1,
          totalStorageCost: 1000,
          totalHandlingCost: 500,
          totalTransactions: 50,
        },
        // 2024 data
        {
          year: 2024,
          month: 1,
          totalStorageCost: 1200,
          totalHandlingCost: 600,
          totalTransactions: 60,
        },
      ]

      ;(prisma.warehouse.findMany as jest.Mock).mockResolvedValue([warehouse])
      ;(prisma.storageLedger.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { calculatedWeeklyCost: 1000 } })
        .mockResolvedValueOnce({ _sum: { calculatedWeeklyCost: 1200 } })
      ;(prisma.inventoryTransaction.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _count: 50 })
        .mockResolvedValueOnce({ _count: 60 })

      const mockWorkbook = { SheetNames: [], Sheets: {} }
      ;(XLSX.utils.book_new as jest.Mock).mockReturnValue(mockWorkbook)
      ;(XLSX.utils.json_to_sheet as jest.Mock).mockReturnValue({})
      ;(XLSX.write as jest.Mock).mockReturnValue(Buffer.from('mock-excel-data'))

      const yearOverYearRequest = createRequest({
        reportType: 'year-over-year',
        period: '2024',
        warehouseId: 'wh-1',
      })

      const response = await generateReport(yearOverYearRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.filename).toContain('year-over-year-2024')

      // Verify YoY calculations
      // Storage cost increase: 20% ((1200-1000)/1000)
      // Handling cost increase: 20% ((600-500)/500)
      // Transaction volume increase: 20% ((60-50)/50)
    })
  })

  describe('Automated Billing Alerts Workflow', () => {
    it('should identify unusual billing patterns', async () => {
      const warehouse = mockData.warehouse({ id: 'wh-1', code: 'FMC' })

      // Current month with unusual spike
      const currentMonthCost = 5000
      const averageMonthCost = 2000

      ;(prisma.warehouse.findMany as jest.Mock).mockResolvedValue([warehouse])
      ;(prisma.storageLedger.aggregate as jest.Mock).mockResolvedValue({
        _sum: { calculatedWeeklyCost: currentMonthCost },
      })
      
      // Historical average
      ;(prisma.calculatedCost.findMany as jest.Mock).mockResolvedValue([
        { totalCost: 1800 },
        { totalCost: 2000 },
        { totalCost: 2200 },
        { totalCost: 2000 },
        { totalCost: 1900 },
        { totalCost: 2100 },
      ])

      const mockWorkbook = { SheetNames: [], Sheets: {} }
      ;(XLSX.utils.book_new as jest.Mock).mockReturnValue(mockWorkbook)
      ;(XLSX.utils.json_to_sheet as jest.Mock).mockReturnValue({})
      ;(XLSX.write as jest.Mock).mockReturnValue(Buffer.from('mock-excel-data'))

      const alertsRequest = createRequest({
        reportType: 'billing-alerts',
        period: '2024-01',
        warehouseId: 'wh-1',
      })

      const response = await generateReport(alertsRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.filename).toContain('billing-alerts-2024-01')

      // Should flag 150% increase as unusual
      const alertData = (XLSX.utils.json_to_sheet as jest.Mock).mock.calls[0][0]
      expect(alertData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            warehouse: 'FMC',
            currentMonthCost,
            averageMonthCost,
            percentageChange: 150,
            alert: 'Significant increase detected',
          }),
        ])
      )
    })
  })
})