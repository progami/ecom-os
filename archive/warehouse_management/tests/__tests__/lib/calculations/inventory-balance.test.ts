import {
  updateInventoryBalances,
  getInventorySummary,
  getInventoryMovements,
} from '@/lib/calculations/inventory-balance'
import { prisma } from '@/lib/prisma'
import { mockData } from '../../test-utils'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    inventoryTransaction: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryBalance: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    sku: {
      findUnique: jest.fn(),
    },
    warehouseSkuConfig: {
      findFirst: jest.fn(),
    },
  },
}))

describe('Inventory Balance Calculations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Suppress console logs during tests
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('updateInventoryBalances', () => {
    it('should update balances for all warehouses when no warehouseId provided', async () => {
      const mockCombinations = [
        { warehouseId: 'warehouse-1', skuId: 'sku-1', batchLot: 'BATCH001' },
        { warehouseId: 'warehouse-2', skuId: 'sku-2', batchLot: 'BATCH002' },
      ]

      ;(prisma.inventoryTransaction.groupBy as jest.Mock).mockResolvedValue(mockCombinations)
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.sku.findUnique as jest.Mock).mockResolvedValue({ unitsPerCarton: 12 })
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryBalance.upsert as jest.Mock).mockResolvedValue({})
      ;(prisma.inventoryBalance.deleteMany as jest.Mock).mockResolvedValue({})

      const result = await updateInventoryBalances()

      expect(result).toBe(2)
      expect(prisma.inventoryTransaction.groupBy).toHaveBeenCalledWith({
        by: ['warehouseId', 'skuId', 'batchLot'],
        where: {},
      })
    })

    it('should update balances for specific warehouse', async () => {
      const mockCombinations = [
        { warehouseId: 'warehouse-1', skuId: 'sku-1', batchLot: 'BATCH001' },
      ]

      ;(prisma.inventoryTransaction.groupBy as jest.Mock).mockResolvedValue(mockCombinations)
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.sku.findUnique as jest.Mock).mockResolvedValue({ unitsPerCarton: 12 })
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryBalance.upsert as jest.Mock).mockResolvedValue({})
      ;(prisma.inventoryBalance.deleteMany as jest.Mock).mockResolvedValue({})

      const result = await updateInventoryBalances('warehouse-1')

      expect(result).toBe(1)
      expect(prisma.inventoryTransaction.groupBy).toHaveBeenCalledWith({
        by: ['warehouseId', 'skuId', 'batchLot'],
        where: { warehouseId: 'warehouse-1' },
      })
    })

    it('should calculate correct balance from transactions', async () => {
      const mockCombinations = [
        { warehouseId: 'warehouse-1', skuId: 'sku-1', batchLot: 'BATCH001' },
      ]
      const mockTransactions = [
        mockData.inventoryTransaction({ cartonsIn: 100, cartonsOut: 0 }),
        mockData.inventoryTransaction({ cartonsIn: 50, cartonsOut: 0 }),
        mockData.inventoryTransaction({ cartonsIn: 0, cartonsOut: 30 }),
      ]
      const mockSku = mockData.sku({ unitsPerCarton: 12 })

      ;(prisma.inventoryTransaction.groupBy as jest.Mock).mockResolvedValue(mockCombinations)
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions)
      ;(prisma.sku.findUnique as jest.Mock).mockResolvedValue(mockSku)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryBalance.upsert as jest.Mock).mockResolvedValue({})
      ;(prisma.inventoryBalance.deleteMany as jest.Mock).mockResolvedValue({})

      await updateInventoryBalances()

      expect(prisma.inventoryBalance.upsert).toHaveBeenCalledWith({
        where: {
          warehouseId_skuId_batchLot: {
            warehouseId: 'warehouse-1',
            skuId: 'sku-1',
            batchLot: 'BATCH001',
          },
        },
        update: expect.objectContaining({
          currentCartons: 120, // 100 + 50 - 30
          currentPallets: 6, // ceil(120 / 20)
          currentUnits: 1440, // 120 * 12
        }),
        create: expect.objectContaining({
          currentCartons: 120,
          currentPallets: 6,
          currentUnits: 1440,
        }),
      })
    })

    it('should not allow negative balance', async () => {
      const mockCombinations = [
        { warehouseId: 'warehouse-1', skuId: 'sku-1', batchLot: 'BATCH001' },
      ]
      const mockTransactions = [
        mockData.inventoryTransaction({ cartonsIn: 50, cartonsOut: 0 }),
        mockData.inventoryTransaction({ cartonsIn: 0, cartonsOut: 100 }), // More out than in
      ]

      ;(prisma.inventoryTransaction.groupBy as jest.Mock).mockResolvedValue(mockCombinations)
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions)
      ;(prisma.sku.findUnique as jest.Mock).mockResolvedValue({ unitsPerCarton: 12 })
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryBalance.upsert as jest.Mock).mockResolvedValue({})
      ;(prisma.inventoryBalance.deleteMany as jest.Mock).mockResolvedValue({})

      await updateInventoryBalances()

      expect(prisma.inventoryBalance.upsert).toHaveBeenCalledWith({
        where: expect.any(Object),
        update: expect.objectContaining({
          currentCartons: 0, // Never negative
          currentPallets: 0,
          currentUnits: 0,
        }),
        create: expect.objectContaining({
          currentCartons: 0,
          currentPallets: 0,
          currentUnits: 0,
        }),
      })
    })

    it('should handle missing SKU data', async () => {
      const mockCombinations = [
        { warehouseId: 'warehouse-1', skuId: 'sku-1', batchLot: 'BATCH001' },
      ]

      ;(prisma.inventoryTransaction.groupBy as jest.Mock).mockResolvedValue(mockCombinations)
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
        mockData.inventoryTransaction({ cartonsIn: 50, cartonsOut: 0 }),
      ])
      ;(prisma.sku.findUnique as jest.Mock).mockResolvedValue(null) // No SKU found
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryBalance.upsert as jest.Mock).mockResolvedValue({})
      ;(prisma.inventoryBalance.deleteMany as jest.Mock).mockResolvedValue({})

      await updateInventoryBalances()

      expect(prisma.inventoryBalance.upsert).toHaveBeenCalledWith({
        where: expect.any(Object),
        update: expect.objectContaining({
          currentUnits: 50, // Uses default multiplier of 1
        }),
        create: expect.objectContaining({
          currentUnits: 50,
        }),
      })
    })

    it('should handle missing warehouse config', async () => {
      const mockCombinations = [
        { warehouseId: 'warehouse-1', skuId: 'sku-1', batchLot: 'BATCH001' },
      ]

      ;(prisma.inventoryTransaction.groupBy as jest.Mock).mockResolvedValue(mockCombinations)
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
        mockData.inventoryTransaction({ cartonsIn: 60, cartonsOut: 0 }),
      ])
      ;(prisma.sku.findUnique as jest.Mock).mockResolvedValue({ unitsPerCarton: 12 })
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue(null) // No config
      ;(prisma.inventoryBalance.upsert as jest.Mock).mockResolvedValue({})
      ;(prisma.inventoryBalance.deleteMany as jest.Mock).mockResolvedValue({})

      await updateInventoryBalances()

      expect(prisma.inventoryBalance.upsert).toHaveBeenCalledWith({
        where: expect.any(Object),
        update: expect.objectContaining({
          currentPallets: 0, // No pallet calculation without config
        }),
        create: expect.objectContaining({
          currentPallets: 0,
        }),
      })
    })

    it('should delete zero-balance records', async () => {
      ;(prisma.inventoryTransaction.groupBy as jest.Mock).mockResolvedValue([])
      ;(prisma.inventoryBalance.deleteMany as jest.Mock).mockResolvedValue({ count: 5 })

      await updateInventoryBalances()

      expect(prisma.inventoryBalance.deleteMany).toHaveBeenCalledWith({
        where: {
          currentCartons: 0,
        },
      })
    })
  })

  describe('getInventorySummary', () => {
    it('should return summary for all warehouses', async () => {
      const mockAggregate = {
        _sum: {
          currentCartons: 500,
          currentPallets: 25,
          currentUnits: 6000,
        },
        _count: {
          skuId: 10,
        },
      }
      const mockUniqueSkus = [
        { skuId: 'sku-1' },
        { skuId: 'sku-2' },
        { skuId: 'sku-3' },
      ]

      ;(prisma.inventoryBalance.aggregate as jest.Mock).mockResolvedValue(mockAggregate)
      ;(prisma.inventoryBalance.groupBy as jest.Mock).mockResolvedValue(mockUniqueSkus)

      const result = await getInventorySummary()

      expect(result).toEqual({
        totalCartons: 500,
        totalPallets: 25,
        totalUnits: 6000,
        uniqueSkus: 3,
        totalItems: 10,
      })
      expect(prisma.inventoryBalance.aggregate).toHaveBeenCalledWith({
        where: {},
        _sum: {
          currentCartons: true,
          currentPallets: true,
          currentUnits: true,
        },
        _count: {
          skuId: true,
        },
      })
    })

    it('should return summary for specific warehouse', async () => {
      const mockAggregate = {
        _sum: {
          currentCartons: 200,
          currentPallets: 10,
          currentUnits: 2400,
        },
        _count: {
          skuId: 5,
        },
      }

      ;(prisma.inventoryBalance.aggregate as jest.Mock).mockResolvedValue(mockAggregate)
      ;(prisma.inventoryBalance.groupBy as jest.Mock).mockResolvedValue([{ skuId: 'sku-1' }])

      const result = await getInventorySummary('warehouse-1')

      expect(result).toEqual({
        totalCartons: 200,
        totalPallets: 10,
        totalUnits: 2400,
        uniqueSkus: 1,
        totalItems: 5,
      })
      expect(prisma.inventoryBalance.aggregate).toHaveBeenCalledWith({
        where: { warehouseId: 'warehouse-1' },
        _sum: expect.any(Object),
        _count: expect.any(Object),
      })
    })

    it('should handle empty inventory', async () => {
      const mockAggregate = {
        _sum: {
          currentCartons: null,
          currentPallets: null,
          currentUnits: null,
        },
        _count: {
          skuId: 0,
        },
      }

      ;(prisma.inventoryBalance.aggregate as jest.Mock).mockResolvedValue(mockAggregate)
      ;(prisma.inventoryBalance.groupBy as jest.Mock).mockResolvedValue([])

      const result = await getInventorySummary()

      expect(result).toEqual({
        totalCartons: 0,
        totalPallets: 0,
        totalUnits: 0,
        uniqueSkus: 0,
        totalItems: 0,
      })
    })
  })

  describe('getInventoryMovements', () => {
    it('should return movements for date range', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')
      const mockMovements = [
        mockData.inventoryTransaction({ cartonsIn: 100, cartonsOut: 0 }),
        mockData.inventoryTransaction({ cartonsIn: 50, cartonsOut: 0 }),
        mockData.inventoryTransaction({ cartonsIn: 0, cartonsOut: 30 }),
      ]

      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue(mockMovements)

      const result = await getInventoryMovements(startDate, endDate)

      expect(result).toEqual({
        movements: mockMovements,
        summary: {
          totalIn: 150,
          totalOut: 30,
          netChange: 120,
          transactionCount: 3,
        },
      })
      expect(prisma.inventoryTransaction.findMany).toHaveBeenCalledWith({
        where: {
          transactionDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          warehouse: true,
          sku: true,
          createdBy: true,
        },
        orderBy: { transactionDate: 'desc' },
      })
    })

    it('should return movements for specific warehouse', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')
      const mockMovements = [
        mockData.inventoryTransaction({ cartonsIn: 75, cartonsOut: 0 }),
        mockData.inventoryTransaction({ cartonsIn: 0, cartonsOut: 25 }),
      ]

      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue(mockMovements)

      const result = await getInventoryMovements(startDate, endDate, 'warehouse-1')

      expect(result.summary).toEqual({
        totalIn: 75,
        totalOut: 25,
        netChange: 50,
        transactionCount: 2,
      })
      expect(prisma.inventoryTransaction.findMany).toHaveBeenCalledWith({
        where: {
          warehouseId: 'warehouse-1',
          transactionDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      })
    })

    it('should handle no movements', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([])

      const result = await getInventoryMovements(startDate, endDate)

      expect(result).toEqual({
        movements: [],
        summary: {
          totalIn: 0,
          totalOut: 0,
          netChange: 0,
          transactionCount: 0,
        },
      })
    })
  })
})