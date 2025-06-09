import { NextRequest } from 'next/server'
import { POST } from '@/app/api/transactions/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { mockSessions, mockData } from '../../../test-utils'

// Mock dependencies
jest.mock('next-auth/next')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    sku: {
      findFirst: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn(),
    },
    inventoryBalance: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    warehouseSkuConfig: {
      findFirst: jest.fn(),
    },
  },
}))

describe('Transactions API Route', () => {
  const mockGetServerSession = getServerSession as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const request = createRequest({})
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should allow authenticated users to create transactions', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
      const mockSku = mockData.sku()
      ;(prisma.sku.findFirst as jest.Mock).mockResolvedValue(mockSku)
      ;(prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({
        id: 'transaction-1',
        transactionId: 'RECEIVE-123',
      })
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryBalance.create as jest.Mock).mockResolvedValue(
        mockData.inventoryBalance()
      )

      const request = createRequest({
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
        notes: 'Initial receipt',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('1 transactions created')
    })
  })

  describe('Warehouse Staff Restrictions', () => {
    it('should reject warehouse staff without assigned warehouse', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'staff-1',
          role: 'warehouse_staff',
          warehouseId: null,
        },
      })

      const request = createRequest({
        type: 'RECEIVE',
        items: [],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No warehouse assigned')
    })

    it('should use warehouse staff assigned warehouse', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.warehouseStaff)
      const mockSku = mockData.sku()
      ;(prisma.sku.findFirst as jest.Mock).mockResolvedValue(mockSku)
      ;(prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({
        id: 'transaction-1',
        transactionId: 'RECEIVE-123',
      })
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryBalance.create as jest.Mock).mockResolvedValue(
        mockData.inventoryBalance()
      )

      const request = createRequest({
        type: 'RECEIVE',
        referenceNumber: 'PO-001',
        date: '2024-01-15',
        items: [
          {
            skuCode: 'CS-001',
            cartons: 50,
          },
        ],
      })

      await POST(request)

      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          warehouseId: 'warehouse-1', // From session
        }),
      })
    })
  })

  describe('SKU Validation', () => {
    it('should reject transaction with non-existent SKU', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
      ;(prisma.sku.findFirst as jest.Mock).mockResolvedValue(null)

      const request = createRequest({
        type: 'RECEIVE',
        warehouseId: 'warehouse-1',
        items: [
          {
            skuCode: 'INVALID-SKU',
            cartons: 10,
          },
        ],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('SKU INVALID-SKU not found')
    })
  })

  describe('RECEIVE Transactions', () => {
    it('should create receive transaction and update inventory', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
      const mockSku = mockData.sku({ id: 'sku-1', skuCode: 'CS-001' })
      const mockBalance = mockData.inventoryBalance({
        currentCartons: 50,
        currentPallets: 3,
      })

      ;(prisma.sku.findFirst as jest.Mock).mockResolvedValue(mockSku)
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(mockBalance)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({
        id: 'transaction-1',
        transactionId: 'RECEIVE-123',
      })
      ;(prisma.inventoryBalance.update as jest.Mock).mockResolvedValue({
        ...mockBalance,
        currentCartons: 150,
        currentPallets: 8,
      })

      const request = createRequest({
        type: 'RECEIVE',
        referenceNumber: 'PO-002',
        date: '2024-01-16',
        warehouseId: 'warehouse-1',
        items: [
          {
            skuCode: 'CS-001',
            batchLot: 'BATCH001',
            cartons: 100,
            pallets: 5,
          },
        ],
        notes: 'Additional receipt',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify transaction creation
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transactionType: 'RECEIVE',
          referenceId: 'PO-002',
          cartonsIn: 100,
          cartonsOut: 0,
          storagePalletsIn: 5,
          shippingPalletsOut: 0,
        }),
      })

      // Verify balance update
      expect(prisma.inventoryBalance.update).toHaveBeenCalledWith({
        where: { id: mockBalance.id },
        data: expect.objectContaining({
          currentCartons: 150, // 50 + 100
          currentPallets: 8, // ceil(150 / 20)
          currentUnits: 1800, // 150 * 12
        }),
      })
    })

    it('should create new inventory balance if none exists', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
      const mockSku = mockData.sku({ unitsPerCarton: 12 })

      ;(prisma.sku.findFirst as jest.Mock).mockResolvedValue(mockSku)
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({
        id: 'transaction-1',
        transactionId: 'RECEIVE-123',
      })
      ;(prisma.inventoryBalance.create as jest.Mock).mockResolvedValue(
        mockData.inventoryBalance()
      )

      const request = createRequest({
        type: 'RECEIVE',
        warehouseId: 'warehouse-1',
        items: [
          {
            skuCode: 'CS-001',
            batchLot: 'BATCH002',
            cartons: 60,
          },
        ],
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(prisma.inventoryBalance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          warehouseId: 'warehouse-1',
          skuId: mockSku.id,
          batchLot: 'BATCH002',
          currentCartons: 60,
          currentPallets: 3, // ceil(60 / 20)
          currentUnits: 720, // 60 * 12
        }),
      })
    })
  })

  describe('SHIP Transactions', () => {
    it('should create ship transaction and reduce inventory', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
      const mockSku = mockData.sku({ id: 'sku-1', unitsPerCarton: 12 })
      const mockBalance = mockData.inventoryBalance({
        currentCartons: 100,
        currentPallets: 5,
      })

      ;(prisma.sku.findFirst as jest.Mock).mockResolvedValue(mockSku)
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(mockBalance)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({
        id: 'transaction-2',
        transactionId: 'SHIP-123',
      })
      ;(prisma.inventoryBalance.update as jest.Mock).mockResolvedValue({
        ...mockBalance,
        currentCartons: 70,
        currentPallets: 4,
      })

      const request = createRequest({
        type: 'SHIP',
        referenceNumber: 'SO-001',
        date: '2024-01-17',
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

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify transaction creation
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transactionType: 'SHIP',
          referenceId: 'SO-001',
          cartonsIn: 0,
          cartonsOut: 30,
          storagePalletsIn: 0,
          shippingPalletsOut: 2,
        }),
      })

      // Verify balance update
      expect(prisma.inventoryBalance.update).toHaveBeenCalledWith({
        where: { id: mockBalance.id },
        data: expect.objectContaining({
          currentCartons: 70, // 100 - 30
          currentPallets: 4, // ceil(70 / 20)
          currentUnits: 840, // 70 * 12
        }),
      })
    })

    it('should not allow negative inventory', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
      const mockSku = mockData.sku({ unitsPerCarton: 12 })
      const mockBalance = mockData.inventoryBalance({
        currentCartons: 10,
      })

      ;(prisma.sku.findFirst as jest.Mock).mockResolvedValue(mockSku)
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(mockBalance)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({
        id: 'transaction-3',
        transactionId: 'SHIP-124',
      })
      ;(prisma.inventoryBalance.update as jest.Mock).mockResolvedValue({
        ...mockBalance,
        currentCartons: 0,
        currentPallets: 0,
      })

      const request = createRequest({
        type: 'SHIP',
        warehouseId: 'warehouse-1',
        items: [
          {
            skuCode: 'CS-001',
            batchLot: 'BATCH001',
            cartons: 50, // More than available
          },
        ],
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(prisma.inventoryBalance.update).toHaveBeenCalledWith({
        where: { id: mockBalance.id },
        data: expect.objectContaining({
          currentCartons: 0, // Max 0, not negative
          currentPallets: 0,
          currentUnits: 0,
        }),
      })
    })
  })

  describe('Multiple Items', () => {
    it('should process multiple items in single transaction', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
      const mockSku1 = mockData.sku({ id: 'sku-1', skuCode: 'CS-001' })
      const mockSku2 = mockData.sku({ id: 'sku-2', skuCode: 'CS-002' })

      ;(prisma.sku.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSku1)
        .mockResolvedValueOnce(mockSku2)
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({
        id: 'transaction-1',
        transactionId: 'RECEIVE-125',
      })
      ;(prisma.inventoryBalance.create as jest.Mock).mockResolvedValue(
        mockData.inventoryBalance()
      )

      const request = createRequest({
        type: 'RECEIVE',
        referenceNumber: 'PO-003',
        date: '2024-01-18',
        warehouseId: 'warehouse-1',
        items: [
          {
            skuCode: 'CS-001',
            cartons: 50,
          },
          {
            skuCode: 'CS-002',
            cartons: 30,
          },
        ],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('2 transactions created')
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
      ;(prisma.sku.findFirst as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = createRequest({
        type: 'RECEIVE',
        warehouseId: 'warehouse-1',
        items: [{ skuCode: 'CS-001', cartons: 10 }],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create transaction')
      expect(data.details).toBe('Database connection failed')
    })

    it('should require warehouse ID', async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          id: 'admin-1',
          role: 'admin',
          warehouseId: null,
        },
      })

      const request = createRequest({
        type: 'RECEIVE',
        items: [],
        // No warehouseId provided
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Warehouse ID required')
    })
  })

  describe('Batch Lot Handling', () => {
    it('should use NONE as default batch lot if not provided', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
      const mockSku = mockData.sku()

      ;(prisma.sku.findFirst as jest.Mock).mockResolvedValue(mockSku)
      ;(prisma.inventoryBalance.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.warehouseSkuConfig.findFirst as jest.Mock).mockResolvedValue({
        storageCartonsPerPallet: 20,
      })
      ;(prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({
        id: 'transaction-1',
        transactionId: 'RECEIVE-126',
      })
      ;(prisma.inventoryBalance.create as jest.Mock).mockResolvedValue(
        mockData.inventoryBalance()
      )

      const request = createRequest({
        type: 'RECEIVE',
        warehouseId: 'warehouse-1',
        items: [
          {
            skuCode: 'CS-001',
            cartons: 20,
            // No batchLot provided
          },
        ],
      })

      await POST(request)

      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          batchLot: 'NONE',
        }),
      })
    })
  })
})