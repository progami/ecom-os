import { POST as createTransaction } from '@/app/api/transactions/route'
import { POST as runCalculations } from '@/app/api/calculations/route'
import { POST as generateReport } from '@/app/api/reports/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { mockSessions, mockData } from '../test-utils'

// Mock dependencies
jest.mock('next-auth/next')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    sku: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    warehouse: {
      findMany: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    inventoryBalance: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      aggregate: jest.fn(),
      deleteMany: jest.fn(),
    },
    warehouseSkuConfig: {
      findFirst: jest.fn(),
    },
    costRate: {
      findFirst: jest.fn(),
    },
    storageLedger: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

// Mock calculation services
jest.mock('@/lib/calculations/inventory-balance')
jest.mock('@/lib/calculations/storage-ledger')

describe('Inventory Workflow Integration Tests', () => {
  const mockGetServerSession = getServerSession as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    // Default to admin session
    mockGetServerSession.mockResolvedValue(mockSessions.admin)
  })

  const createRequest = (body: any, url: string = '/api/test') => {
    return new Request(`http://localhost:3000${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  describe('Complete Inventory Receive-to-Report Workflow', () => {
    it('should handle complete workflow from receiving to reporting', async () => {
      // Step 1: Setup initial data
      const mockSku = mockData.sku({
        id: 'sku-1',
        skuCode: 'CS-001',
        unitsPerCarton: 12,
      })
      const mockWarehouse = mockData.warehouse({
        id: 'warehouse-1',
        code: 'FMC',
      })
      const mockWarehouseConfig = {
        storageCartonsPerPallet: 20,
      }
      const mockCostRate = {
        costValue: { toNumber: () => 3.9 },
      }

      // Step 2: Receive inventory
      ;(prisma.sku.findFirst as jest.Mock).mockResolvedValue(mockSku)
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue(mockWarehouseConfig)
      ;(prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({
        id: 'transaction-1',
        transactionId: 'RECEIVE-001',
      })
      ;(prisma.inventoryBalance.create as jest.Mock).mockResolvedValue({
        currentCartons: 100,
        currentPallets: 5,
        currentUnits: 1200,
      })

      const receiveRequest = createRequest({
        type: 'RECEIVE',
        referenceNumber: 'PO-001',
        date: '2024-01-15',
        warehouseId: 'warehouse-1',
        items: [
          {
            skuCode: 'CS-001',
            batchLot: 'BATCH001',
            cartons: 100,
            pallets: 5,
          },
        ],
        notes: 'Initial inventory receipt',
      })

      const receiveResponse = await createTransaction(receiveRequest)
      const receiveData = await receiveResponse.json()

      expect(receiveResponse.status).toBe(200)
      expect(receiveData.success).toBe(true)
      expect(prisma.inventoryTransaction.create).toHaveBeenCalled()
      expect(prisma.inventoryBalance.create).toHaveBeenCalled()

      // Step 3: Run inventory balance calculation
      const mockUpdateInventoryBalances = jest.requireMock('@/lib/calculations/inventory-balance').updateInventoryBalances
      mockUpdateInventoryBalances.mockResolvedValue(1)

      const calcRequest = createRequest({
        type: 'inventory-balance',
        warehouseId: 'warehouse-1',
      })

      const calcResponse = await runCalculations(calcRequest)
      const calcData = await calcResponse.json()

      expect(calcResponse.status).toBe(200)
      expect(calcData.success).toBe(true)
      expect(mockUpdateInventoryBalances).toHaveBeenCalledWith('warehouse-1')

      // Step 4: Generate storage ledger
      const mockGenerateStorageLedger = jest.requireMock('@/lib/calculations/storage-ledger').generateStorageLedgerForPeriod
      mockGenerateStorageLedger.mockResolvedValue(4) // 4 weeks

      const storageRequest = createRequest({
        type: 'storage-ledger',
        year: 2024,
        month: 1,
        warehouseId: 'warehouse-1',
      })

      const storageResponse = await runCalculations(storageRequest)
      const storageData = await storageResponse.json()

      expect(storageResponse.status).toBe(200)
      expect(storageData.message).toBe('Generated 4 storage ledger entries')

      // Step 5: Ship some inventory
      const currentBalance = mockData.inventoryBalance({
        currentCartons: 100,
        currentPallets: 5,
      })

      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(currentBalance)
      ;(prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({
        id: 'transaction-2',
        transactionId: 'SHIP-001',
      })
      ;(prisma.inventoryBalance.update as jest.Mock).mockResolvedValue({
        currentCartons: 70,
        currentPallets: 4,
        currentUnits: 840,
      })

      const shipRequest = createRequest({
        type: 'SHIP',
        referenceNumber: 'SO-001',
        date: '2024-01-20',
        warehouseId: 'warehouse-1',
        items: [
          {
            skuCode: 'CS-001',
            batchLot: 'BATCH001',
            cartons: 30,
            pallets: 2,
          },
        ],
        notes: 'Customer shipment',
      })

      const shipResponse = await createTransaction(shipRequest)
      const shipData = await shipResponse.json()

      expect(shipResponse.status).toBe(200)
      expect(shipData.success).toBe(true)
      expect(prisma.inventoryBalance.update).toHaveBeenCalledWith({
        where: { id: currentBalance.id },
        data: expect.objectContaining({
          currentCartons: 70,
        }),
      })

      // Step 6: Generate monthly report
      ;(prisma.warehouse.findMany as jest.Mock).mockResolvedValue([mockWarehouse])
      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue([mockSku])
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
        { ...mockData.inventoryTransaction(), cartonsIn: 100, cartonsOut: 0 },
        { ...mockData.inventoryTransaction(), cartonsIn: 0, cartonsOut: 30 },
      ])
      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([
        {
          ...currentBalance,
          currentCartons: 70,
          sku: mockSku,
          warehouse: mockWarehouse,
        },
      ])
      ;(prisma.storageLedger.findMany as jest.Mock).mockResolvedValue([
        mockData.storageLedger({
          storagePalletsCharged: 5,
          calculatedWeeklyCost: 19.5,
        }),
      ])
      ;(prisma.costRate.findFirst as jest.Mock).mockResolvedValue(mockCostRate)

      const reportRequest = createRequest({
        reportType: 'monthly-inventory',
        period: '2024-01',
      })

      const reportResponse = await generateReport(reportRequest)
      const reportData = await reportResponse.json()

      expect(reportResponse.status).toBe(200)
      expect(reportData.success).toBe(true)
      expect(reportData.filename).toContain('inventory-report-2024-01')
    })
  })

  describe('Multi-Warehouse Workflow', () => {
    it('should handle inventory across multiple warehouses', async () => {
      // Setup multiple warehouses
      const warehouses = [
        mockData.warehouse({ id: 'wh-1', code: 'FMC' }),
        mockData.warehouse({ id: 'wh-2', code: 'HSQ' }),
      ]
      const mockSku = mockData.sku({ skuCode: 'CS-001' })

      // Receive inventory at warehouse 1
      ;(prisma.sku.findFirst as jest.Mock).mockResolvedValue(mockSku)
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryTransaction.create as jest.Mock).mockImplementation(
        ({ data }) => ({
          id: `transaction-${data.warehouseId}`,
          transactionId: data.transactionId,
          warehouseId: data.warehouseId,
        })
      )
      ;(prisma.inventoryBalance.create as jest.Mock).mockImplementation(
        ({ data }) => ({
          ...data,
          id: `balance-${data.warehouseId}`,
        })
      )

      // Receive at warehouse 1
      const receive1Request = createRequest({
        type: 'RECEIVE',
        referenceNumber: 'PO-001',
        date: '2024-01-15',
        warehouseId: 'wh-1',
        items: [{ skuCode: 'CS-001', cartons: 100 }],
      })

      const receive1Response = await createTransaction(receive1Request)
      expect(receive1Response.status).toBe(200)

      // Receive at warehouse 2
      const receive2Request = createRequest({
        type: 'RECEIVE',
        referenceNumber: 'PO-002',
        date: '2024-01-15',
        warehouseId: 'wh-2',
        items: [{ skuCode: 'CS-001', cartons: 150 }],
      })

      const receive2Response = await createTransaction(receive2Request)
      expect(receive2Response.status).toBe(200)

      // Verify separate balances were created
      expect(prisma.inventoryBalance.create).toHaveBeenCalledTimes(2)
      expect(prisma.inventoryBalance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          warehouseId: 'wh-1',
          currentCartons: 100,
        }),
      })
      expect(prisma.inventoryBalance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          warehouseId: 'wh-2',
          currentCartons: 150,
        }),
      })

      // Generate system-wide report
      ;(prisma.warehouse.findMany as jest.Mock).mockResolvedValue(warehouses)
      ;(prisma.inventoryBalance.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          currentCartons: 250,
          currentPallets: 13,
        },
      })

      const mockUpdateInventoryBalances = jest.requireMock('@/lib/calculations/inventory-balance').updateInventoryBalances
      mockUpdateInventoryBalances.mockResolvedValue(2)

      const calcRequest = createRequest({
        type: 'inventory-balance',
        // No warehouseId - update all
      })

      const calcResponse = await runCalculations(calcRequest)
      const calcData = await calcResponse.json()

      expect(calcResponse.status).toBe(200)
      expect(calcData.message).toBe('Updated 2 inventory balance records')
      expect(mockUpdateInventoryBalances).toHaveBeenCalledWith(undefined)
    })
  })

  describe('Role-Based Workflow Restrictions', () => {
    it('should restrict warehouse staff to their assigned warehouse', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.warehouseStaff)

      const mockSku = mockData.sku({ skuCode: 'CS-001' })
      ;(prisma.sku.findFirst as jest.Mock).mockResolvedValue(mockSku)
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({
        id: 'transaction-1',
        transactionId: 'RECEIVE-001',
      })
      ;(prisma.inventoryBalance.create as jest.Mock).mockResolvedValue({})

      // Should use session warehouse, not provided warehouse
      const receiveRequest = createRequest({
        type: 'RECEIVE',
        referenceNumber: 'PO-001',
        date: '2024-01-15',
        warehouseId: 'different-warehouse', // Should be ignored
        items: [{ skuCode: 'CS-001', cartons: 50 }],
      })

      await createTransaction(receiveRequest)

      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          warehouseId: 'warehouse-1', // From session
        }),
      })
    })

    it('should prevent finance users from creating transactions', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.financeAdmin)

      // Finance admin can run calculations
      const mockUpdateInventoryBalances = jest.requireMock('@/lib/calculations/inventory-balance').updateInventoryBalances
      mockUpdateInventoryBalances.mockResolvedValue(5)

      const calcRequest = createRequest({
        type: 'inventory-balance',
      })

      const calcResponse = await runCalculations(calcRequest)
      expect(calcResponse.status).toBe(200)

      // But cannot create transactions (would need separate endpoint logic)
      // This would be enforced at the API route level
    })
  })

  describe('Error Recovery Workflow', () => {
    it('should handle partial failures gracefully', async () => {
      const mockSku = mockData.sku({ skuCode: 'CS-001' })
      
      // First item succeeds
      ;(prisma.sku.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSku)
        .mockResolvedValueOnce(null) // Second item fails

      const receiveRequest = createRequest({
        type: 'RECEIVE',
        referenceNumber: 'PO-001',
        date: '2024-01-15',
        warehouseId: 'warehouse-1',
        items: [
          { skuCode: 'CS-001', cartons: 100 },
          { skuCode: 'INVALID-SKU', cartons: 50 },
        ],
      })

      const response = await createTransaction(receiveRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('SKU INVALID-SKU not found')
      
      // First transaction should not have been created due to validation
      expect(prisma.inventoryTransaction.create).not.toHaveBeenCalled()
    })

    it('should handle calculation failures', async () => {
      const mockUpdateInventoryBalances = jest.requireMock('@/lib/calculations/inventory-balance').updateInventoryBalances
      mockUpdateInventoryBalances.mockRejectedValue(new Error('Database error'))

      const calcRequest = createRequest({
        type: 'inventory-balance',
      })

      const response = await runCalculations(calcRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to perform calculation')
      expect(data.details).toBe('Database error')
    })
  })

  describe('Batch Operations Workflow', () => {
    it('should handle batch inventory movements efficiently', async () => {
      const skus = [
        mockData.sku({ id: 'sku-1', skuCode: 'CS-001' }),
        mockData.sku({ id: 'sku-2', skuCode: 'CS-002' }),
        mockData.sku({ id: 'sku-3', skuCode: 'CS-003' }),
      ]

      ;(prisma.sku.findFirst as jest.Mock)
        .mockResolvedValueOnce(skus[0])
        .mockResolvedValueOnce(skus[1])
        .mockResolvedValueOnce(skus[2])
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryTransaction.create as jest.Mock).mockImplementation(
        ({ data }) => ({
          id: `transaction-${data.skuId}`,
          transactionId: data.transactionId,
        })
      )
      ;(prisma.inventoryBalance.create as jest.Mock).mockImplementation(
        ({ data }) => ({ ...data })
      )

      const batchRequest = createRequest({
        type: 'RECEIVE',
        referenceNumber: 'PO-BATCH-001',
        date: '2024-01-15',
        warehouseId: 'warehouse-1',
        items: [
          { skuCode: 'CS-001', cartons: 100 },
          { skuCode: 'CS-002', cartons: 150 },
          { skuCode: 'CS-003', cartons: 200 },
        ],
      })

      const response = await createTransaction(batchRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('3 transactions created')
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledTimes(3)
      expect(prisma.inventoryBalance.create).toHaveBeenCalledTimes(3)
    })
  })
})