import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    warehouse: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    sku: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    inventoryBalance: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  }

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  }
})

describe('Prisma Client', () => {
  it('should be a singleton instance', () => {
    expect(prisma).toBeDefined()
    expect(prisma).toBeInstanceOf(PrismaClient)
  })

  it('should have all required models', () => {
    expect(prisma.user).toBeDefined()
    expect(prisma.warehouse).toBeDefined()
    expect(prisma.sku).toBeDefined()
    expect(prisma.inventoryTransaction).toBeDefined()
    expect(prisma.inventoryBalance).toBeDefined()
  })

  describe('Common Database Operations', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    describe('User Operations', () => {
      it('should create a user', async () => {
        const userData = {
          email: 'test@example.com',
          fullName: 'Test User',
          passwordHash: 'hashed',
          role: 'viewer' as const,
        }

        ;(prisma.user.create as jest.Mock).mockResolvedValue({
          id: 'user-1',
          ...userData,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const result = await prisma.user.create({ data: userData })

        expect(result.id).toBe('user-1')
        expect(result.email).toBe(userData.email)
        expect(prisma.user.create).toHaveBeenCalledWith({ data: userData })
      })

      it('should find user by email', async () => {
        const mockUser = {
          id: 'user-1',
          email: 'test@example.com',
          fullName: 'Test User',
        }

        ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

        const result = await prisma.user.findUnique({
          where: { email: 'test@example.com' },
        })

        expect(result).toEqual(mockUser)
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.com' },
        })
      })

      it('should update user role', async () => {
        const updatedUser = {
          id: 'user-1',
          role: 'system_admin',
        }

        ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser)

        const result = await prisma.user.update({
          where: { id: 'user-1' },
          data: { role: 'system_admin' },
        })

        expect(result.role).toBe('system_admin')
      })
    })

    describe('Warehouse Operations', () => {
      it('should create a warehouse', async () => {
        const warehouseData = {
          code: 'WH001',
          name: 'Test Warehouse',
          address: '123 Test St',
          contactEmail: 'warehouse@test.com',
        }

        ;(prisma.warehouse.create as jest.Mock).mockResolvedValue({
          id: 'warehouse-1',
          ...warehouseData,
          isActive: true,
        })

        const result = await prisma.warehouse.create({ data: warehouseData })

        expect(result.code).toBe('WH001')
        expect(result.name).toBe('Test Warehouse')
      })

      it('should find all active warehouses', async () => {
        const mockWarehouses = [
          { id: 'warehouse-1', code: 'WH001', isActive: true },
          { id: 'warehouse-2', code: 'WH002', isActive: true },
        ]

        ;(prisma.warehouse.findMany as jest.Mock).mockResolvedValue(mockWarehouses)

        const result = await prisma.warehouse.findMany({
          where: { isActive: true },
        })

        expect(result).toHaveLength(2)
        expect(prisma.warehouse.findMany).toHaveBeenCalledWith({
          where: { isActive: true },
        })
      })
    })

    describe('SKU Operations', () => {
      it('should upsert SKU', async () => {
        const skuData = {
          skuCode: 'SKU001',
          description: 'Test Product',
          unitsPerCarton: 12,
          packSize: 1,
        }

        ;(prisma.sku.upsert as jest.Mock).mockResolvedValue({
          id: 'sku-1',
          ...skuData,
        })

        const result = await prisma.sku.upsert({
          where: { skuCode: 'SKU001' },
          update: skuData,
          create: skuData,
        })

        expect(result.skuCode).toBe('SKU001')
        expect(prisma.sku.upsert).toHaveBeenCalledWith({
          where: { skuCode: 'SKU001' },
          update: skuData,
          create: skuData,
        })
      })
    })

    describe('Transaction Operations', () => {
      it('should aggregate inventory transactions', async () => {
        const mockAggregate = {
          _sum: {
            cartonsIn: 1000,
            cartonsOut: 300,
          },
          _count: 50,
        }

        ;(prisma.inventoryTransaction.aggregate as jest.Mock).mockResolvedValue(
          mockAggregate
        )

        const result = await prisma.inventoryTransaction.aggregate({
          where: { warehouseId: 'warehouse-1' },
          _sum: {
            cartonsIn: true,
            cartonsOut: true,
          },
          _count: true,
        })

        expect(result._sum.cartonsIn).toBe(1000)
        expect(result._sum.cartonsOut).toBe(300)
        expect(result._count).toBe(50)
      })

      it('should group transactions by type', async () => {
        const mockGroupBy = [
          { transactionType: 'RECEIVE', _count: 30 },
          { transactionType: 'SHIP', _count: 20 },
        ]

        ;(prisma.inventoryTransaction.groupBy as jest.Mock).mockResolvedValue(mockGroupBy)

        const result = await prisma.inventoryTransaction.groupBy({
          by: ['transactionType'],
          _count: true,
        })

        expect(result).toHaveLength(2)
        expect(result[0].transactionType).toBe('RECEIVE')
        expect(result[0]._count).toBe(30)
      })
    })

    describe('Inventory Balance Operations', () => {
      it('should upsert inventory balance', async () => {
        const balanceData = {
          warehouseId: 'warehouse-1',
          skuId: 'sku-1',
          batchLot: 'BATCH001',
          currentCartons: 100,
          currentPallets: 5,
          currentUnits: 1200,
        }

        ;(prisma.inventoryBalance.upsert as jest.Mock).mockResolvedValue(balanceData)

        const result = await prisma.inventoryBalance.upsert({
          where: {
            warehouseId_skuId_batchLot: {
              warehouseId: 'warehouse-1',
              skuId: 'sku-1',
              batchLot: 'BATCH001',
            },
          },
          update: { currentCartons: 100 },
          create: balanceData,
        })

        expect(result.currentCartons).toBe(100)
        expect(result.currentPallets).toBe(5)
      })

      it('should delete zero balance records', async () => {
        ;(prisma.inventoryBalance.deleteMany as jest.Mock).mockResolvedValue({
          count: 5,
        })

        const result = await prisma.inventoryBalance.deleteMany({
          where: { currentCartons: 0 },
        })

        expect(result.count).toBe(5)
        expect(prisma.inventoryBalance.deleteMany).toHaveBeenCalledWith({
          where: { currentCartons: 0 },
        })
      })
    })

    describe('Transaction Support', () => {
      it('should support database transactions', async () => {
        const mockTransactionResult = [
          { id: 'user-1' },
          { id: 'warehouse-1' },
        ]

        ;(prisma.$transaction as jest.Mock).mockResolvedValue(mockTransactionResult)

        const result = await prisma.$transaction([
          prisma.user.create({ data: { email: 'test@example.com', fullName: 'Test User', passwordHash: 'hashed', role: 'viewer' as const } }),
          prisma.warehouse.create({ data: { code: 'WH001', name: 'Warehouse 1' } }),
        ])

        expect(result).toEqual(mockTransactionResult)
        expect(prisma.$transaction).toHaveBeenCalled()
      })
    })

    describe('Connection Management', () => {
      it('should connect to database', async () => {
        await prisma.$connect()
        expect(prisma.$connect).toHaveBeenCalled()
      })

      it('should disconnect from database', async () => {
        await prisma.$disconnect()
        expect(prisma.$disconnect).toHaveBeenCalled()
      })
    })
  })
})