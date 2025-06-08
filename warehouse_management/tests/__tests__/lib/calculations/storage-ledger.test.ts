import {
  calculateStorageLedger,
  generateStorageLedgerForPeriod,
} from '@/lib/calculations/storage-ledger'
import { prisma } from '@/lib/prisma'
import { mockData } from '../../test-utils'
import { startOfWeek, endOfWeek } from 'date-fns'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    inventoryBalance: {
      findMany: jest.fn(),
    },
    inventoryTransaction: {
      findMany: jest.fn(),
    },
    warehouseSkuConfig: {
      findFirst: jest.fn(),
    },
    costRate: {
      findFirst: jest.fn(),
    },
    storageLedger: {
      upsert: jest.fn(),
    },
  },
}))

// Mock date-fns to have consistent dates
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  startOfWeek: jest.fn((date) => {
    // Always return a Monday
    const realStartOfWeek = jest.requireActual('date-fns').startOfWeek
    return realStartOfWeek(date, { weekStartsOn: 1 })
  }),
  endOfWeek: jest.fn((date) => {
    // Always return a Sunday
    const realEndOfWeek = jest.requireActual('date-fns').endOfWeek
    return realEndOfWeek(date, { weekStartsOn: 1 })
  }),
}))

describe('Storage Ledger Calculations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Suppress console logs during tests
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('calculateStorageLedger', () => {
    const billingPeriodStart = new Date('2024-01-16')
    const billingPeriodEnd = new Date('2024-02-15')

    it('should calculate storage for all warehouses when no warehouseId provided', async () => {
      const mockBalances = [
        mockData.inventoryBalance({
          warehouseId: 'warehouse-1',
          skuId: 'sku-1',
          batchLot: 'BATCH001',
          currentCartons: 100,
        }),
        mockData.inventoryBalance({
          warehouseId: 'warehouse-2',
          skuId: 'sku-2',
          batchLot: 'BATCH002',
          currentCartons: 200,
        }),
      ]

      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue(mockBalances)
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
        mockData.inventoryTransaction({ cartonsIn: 100, cartonsOut: 0 }),
      ])
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.costRate.findFirst as jest.Mock).mockResolvedValue({
        costValue: { toNumber: () => 3.9 },
      })
      ;(prisma.storageLedger.upsert as jest.Mock).mockResolvedValue({})

      const result = await calculateStorageLedger(billingPeriodStart, billingPeriodEnd)

      expect(result).toBeGreaterThan(0)
      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith({
        where: {
          currentCartons: { gt: 0 },
        },
        include: {
          warehouse: true,
          sku: true,
        },
      })
    })

    it('should calculate storage for specific warehouse', async () => {
      const mockBalances = [
        mockData.inventoryBalance({
          warehouseId: 'warehouse-1',
          skuId: 'sku-1',
          batchLot: 'BATCH001',
          currentCartons: 100,
        }),
      ]

      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue(mockBalances)
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
        mockData.inventoryTransaction({ cartonsIn: 100, cartonsOut: 0 }),
      ])
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.costRate.findFirst as jest.Mock).mockResolvedValue({
        costValue: { toNumber: () => 3.9 },
      })
      ;(prisma.storageLedger.upsert as jest.Mock).mockResolvedValue({})

      const result = await calculateStorageLedger(
        billingPeriodStart,
        billingPeriodEnd,
        'warehouse-1'
      )

      expect(result).toBeGreaterThan(0)
      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith({
        where: {
          warehouseId: 'warehouse-1',
          currentCartons: { gt: 0 },
        },
        include: expect.any(Object),
      })
    })

    it('should create storage ledger entries for each Monday', async () => {
      const mockBalance = mockData.inventoryBalance({
        warehouseId: 'warehouse-1',
        skuId: 'sku-1',
        batchLot: 'BATCH001',
        currentCartons: 100,
        warehouse: { code: 'FMC', name: 'FMC' },
        sku: { skuCode: 'CS-001' },
      })

      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([mockBalance])
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
        mockData.inventoryTransaction({ cartonsIn: 100, cartonsOut: 0 }),
      ])
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.costRate.findFirst as jest.Mock).mockResolvedValue({
        costValue: { toNumber: () => 3.9 },
      })
      ;(prisma.storageLedger.upsert as jest.Mock).mockResolvedValue({})

      await calculateStorageLedger(billingPeriodStart, billingPeriodEnd)

      // Should create entries for each Monday in the period
      const upsertCalls = (prisma.storageLedger.upsert as jest.Mock).mock.calls
      expect(upsertCalls.length).toBeGreaterThan(0)

      // Check the structure of the upsert call
      const firstCall = upsertCalls[0][0]
      expect(firstCall).toMatchObject({
        where: { slId: expect.stringContaining('SL-') },
        update: {
          cartonsEndOfMonday: 100,
          storagePalletsCharged: 5, // ceil(100 / 20)
          applicableWeeklyRate: 3.9,
          calculatedWeeklyCost: 19.5, // 5 * 3.9
        },
        create: expect.objectContaining({
          warehouseId: 'warehouse-1',
          skuId: 'sku-1',
          batchLot: 'BATCH001',
          cartonsEndOfMonday: 100,
          storagePalletsCharged: 5,
          applicableWeeklyRate: 3.9,
          calculatedWeeklyCost: 19.5,
          billingPeriodStart,
          billingPeriodEnd,
        }),
      })
    })

    it('should skip combinations with zero balance on Monday', async () => {
      const mockBalance = mockData.inventoryBalance({
        currentCartons: 100,
      })

      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([mockBalance])
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([]) // No transactions = 0 balance
      ;(prisma.storageLedger.upsert as jest.Mock).mockResolvedValue({})

      await calculateStorageLedger(billingPeriodStart, billingPeriodEnd)

      expect(prisma.storageLedger.upsert).not.toHaveBeenCalled()
    })

    it('should handle missing warehouse config', async () => {
      const mockBalance = mockData.inventoryBalance({
        currentCartons: 100,
        warehouse: { code: 'FMC', name: 'FMC' },
        sku: { skuCode: 'CS-001' },
      })

      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([mockBalance])
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
        mockData.inventoryTransaction({ cartonsIn: 100, cartonsOut: 0 }),
      ])
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue(null) // No config
      ;(prisma.storageLedger.upsert as jest.Mock).mockResolvedValue({})

      await calculateStorageLedger(billingPeriodStart, billingPeriodEnd)

      expect(prisma.storageLedger.upsert).not.toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('No warehouse config found')
      )
    })

    it('should handle missing storage rate', async () => {
      const mockBalance = mockData.inventoryBalance({
        currentCartons: 100,
        warehouse: { code: 'FMC', name: 'FMC' },
        sku: { skuCode: 'CS-001' },
      })

      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([mockBalance])
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
        mockData.inventoryTransaction({ cartonsIn: 100, cartonsOut: 0 }),
      ])
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.costRate.findFirst as jest.Mock).mockResolvedValue(null) // No rate
      ;(prisma.storageLedger.upsert as jest.Mock).mockResolvedValue({})

      await calculateStorageLedger(billingPeriodStart, billingPeriodEnd)

      expect(prisma.storageLedger.upsert).not.toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('No storage rate found')
      )
    })

    it('should calculate correct pallets with rounding up', async () => {
      const testCases = [
        { cartons: 19, expectedPallets: 1 }, // Less than 1 pallet
        { cartons: 20, expectedPallets: 1 }, // Exactly 1 pallet
        { cartons: 21, expectedPallets: 2 }, // Just over 1 pallet
        { cartons: 100, expectedPallets: 5 }, // Exactly 5 pallets
        { cartons: 101, expectedPallets: 6 }, // Just over 5 pallets
      ]

      for (const { cartons, expectedPallets } of testCases) {
        jest.clearAllMocks()

        const mockBalance = mockData.inventoryBalance({
          currentCartons: cartons,
          warehouse: { code: 'FMC', name: 'FMC' },
          sku: { skuCode: 'CS-001' },
        })

        ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([mockBalance])
        ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
          mockData.inventoryTransaction({ cartonsIn: cartons, cartonsOut: 0 }),
        ])
        ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
          storageCartonsPerPallet: 20,
        })
        ;(prisma.costRate.findFirst as jest.Mock).mockResolvedValue({
          costValue: { toNumber: () => 3.9 },
        })
        ;(prisma.storageLedger.upsert as jest.Mock).mockResolvedValue({})

        await calculateStorageLedger(billingPeriodStart, billingPeriodEnd)

        const upsertCall = (prisma.storageLedger.upsert as jest.Mock).mock.calls[0][0]
        expect(upsertCall.update.storagePalletsCharged).toBe(expectedPallets)
        expect(upsertCall.update.calculatedWeeklyCost).toBe(expectedPallets * 3.9)
      }
    })

    it('should handle database errors gracefully', async () => {
      const mockBalance = mockData.inventoryBalance({
        currentCartons: 100,
        warehouse: { code: 'FMC', name: 'FMC' },
        sku: { skuCode: 'CS-001' },
      })

      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([mockBalance])
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
        mockData.inventoryTransaction({ cartonsIn: 100, cartonsOut: 0 }),
      ])
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.costRate.findFirst as jest.Mock).mockResolvedValue({
        costValue: { toNumber: () => 3.9 },
      })
      ;(prisma.storageLedger.upsert as jest.Mock).mockRejectedValue(
        new Error('Database error')
      )

      const result = await calculateStorageLedger(billingPeriodStart, billingPeriodEnd)

      expect(result).toBe(0) // No entries created due to error
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating storage ledger entry'),
        expect.any(Error)
      )
    })
  })

  describe('generateStorageLedgerForPeriod', () => {
    it('should generate storage ledger for January 2024', async () => {
      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.storageLedger.upsert as jest.Mock).mockResolvedValue({})

      await generateStorageLedgerForPeriod(2024, 1)

      // January billing period: Dec 16, 2023 to Jan 15, 2024
      expect(prisma.inventoryBalance.findMany).toHaveBeenCalled()
    })

    it('should generate storage ledger for December 2024', async () => {
      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.storageLedger.upsert as jest.Mock).mockResolvedValue({})

      await generateStorageLedgerForPeriod(2024, 12)

      // December billing period: Nov 16, 2024 to Dec 15, 2024
      expect(prisma.inventoryBalance.findMany).toHaveBeenCalled()
    })

    it('should pass warehouse filter to calculation', async () => {
      const mockBalance = mockData.inventoryBalance({
        currentCartons: 100,
        warehouse: { code: 'FMC', name: 'FMC' },
        sku: { skuCode: 'CS-001' },
      })

      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([mockBalance])
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
        mockData.inventoryTransaction({ cartonsIn: 100, cartonsOut: 0 }),
      ])
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.costRate.findFirst as jest.Mock).mockResolvedValue({
        costValue: { toNumber: () => 3.9 },
      })
      ;(prisma.storageLedger.upsert as jest.Mock).mockResolvedValue({})

      const result = await generateStorageLedgerForPeriod(2024, 1, 'warehouse-1')

      expect(result).toBeGreaterThan(0)
      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith({
        where: {
          warehouseId: 'warehouse-1',
          currentCartons: { gt: 0 },
        },
        include: expect.any(Object),
      })
    })
  })

  describe('Inventory Balance as of Date', () => {
    it('should calculate balance from transactions up to specific date', async () => {
      const monday = new Date('2024-01-22') // A Monday
      const mockBalance = mockData.inventoryBalance({
        currentCartons: 100,
        warehouse: { code: 'FMC', name: 'FMC' },
        sku: { skuCode: 'CS-001' },
      })

      const mockTransactions = [
        mockData.inventoryTransaction({
          cartonsIn: 50,
          cartonsOut: 0,
          transactionDate: new Date('2024-01-15'),
        }),
        mockData.inventoryTransaction({
          cartonsIn: 30,
          cartonsOut: 0,
          transactionDate: new Date('2024-01-20'),
        }),
        mockData.inventoryTransaction({
          cartonsIn: 0,
          cartonsOut: 10,
          transactionDate: new Date('2024-01-21'),
        }),
        // This transaction should not be included (after Monday)
        mockData.inventoryTransaction({
          cartonsIn: 20,
          cartonsOut: 0,
          transactionDate: new Date('2024-01-23'),
        }),
      ]

      ;(prisma.inventoryBalance.findMany as jest.Mock).mockResolvedValue([mockBalance])
      ;(prisma.inventoryTransaction.findMany as jest.Mock).mockImplementation(
        ({ where }) => {
          const date = where.transactionDate.lte
          return mockTransactions.filter((t) => t.transactionDate <= date)
        }
      )
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.costRate.findFirst as jest.Mock).mockResolvedValue({
        costValue: { toNumber: () => 3.9 },
      })
      ;(prisma.storageLedger.upsert as jest.Mock).mockResolvedValue({})

      await calculateStorageLedger(
        new Date('2024-01-16'),
        new Date('2024-02-15')
      )

      // Should calculate balance as of Monday: 50 + 30 - 10 = 70 cartons
      const upsertCall = (prisma.storageLedger.upsert as jest.Mock).mock.calls[0][0]
      expect(upsertCall.update.cartonsEndOfMonday).toBe(70)
    })
  })
})