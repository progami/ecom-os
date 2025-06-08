import { NextRequest } from 'next/server'
import { POST } from '@/app/api/calculations/route'
import { getServerSession } from 'next-auth/next'
import { updateInventoryBalances } from '@/lib/calculations/inventory-balance'
import { generateStorageLedgerForPeriod } from '@/lib/calculations/storage-ledger'
import { mockSessions } from '../../../test-utils'

// Mock dependencies
jest.mock('next-auth/next')
jest.mock('@/lib/calculations/inventory-balance')
jest.mock('@/lib/calculations/storage-ledger')

describe('Calculations API Route', () => {
  const mockGetServerSession = getServerSession as jest.Mock
  const mockUpdateInventoryBalances = updateInventoryBalances as jest.Mock
  const mockGenerateStorageLedger = generateStorageLedgerForPeriod as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/calculations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  describe('Authentication and Authorization', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const request = createRequest({ type: 'inventory-balance' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 403 for unauthorized roles', async () => {
      const unauthorizedRoles = [
        mockSessions.warehouseStaff,
        mockSessions.manager,
        mockSessions.viewer,
      ]

      for (const session of unauthorizedRoles) {
        mockGetServerSession.mockResolvedValue(session)

        const request = createRequest({ type: 'inventory-balance' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.error).toBe('Forbidden')
      }
    })

    it('should allow admin to trigger calculations', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
      mockUpdateInventoryBalances.mockResolvedValue(10)

      const request = createRequest({ type: 'inventory-balance' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should allow finance_admin to trigger calculations', async () => {
      mockGetServerSession.mockResolvedValue(mockSessions.financeAdmin)
      mockUpdateInventoryBalances.mockResolvedValue(5)

      const request = createRequest({ type: 'inventory-balance' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Inventory Balance Calculation', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
    })

    it('should update inventory balances for all warehouses', async () => {
      mockUpdateInventoryBalances.mockResolvedValue(15)

      const request = createRequest({ type: 'inventory-balance' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Updated 15 inventory balance records')
      expect(mockUpdateInventoryBalances).toHaveBeenCalledWith(undefined)
    })

    it('should update inventory balances for specific warehouse', async () => {
      mockUpdateInventoryBalances.mockResolvedValue(5)

      const request = createRequest({
        type: 'inventory-balance',
        warehouseId: 'warehouse-1',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Updated 5 inventory balance records')
      expect(mockUpdateInventoryBalances).toHaveBeenCalledWith('warehouse-1')
    })

    it('should handle empty inventory updates', async () => {
      mockUpdateInventoryBalances.mockResolvedValue(0)

      const request = createRequest({ type: 'inventory-balance' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Updated 0 inventory balance records')
    })
  })

  describe('Storage Ledger Calculation', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
    })

    it('should generate storage ledger for specified period', async () => {
      mockGenerateStorageLedger.mockResolvedValue(20)

      const request = createRequest({
        type: 'storage-ledger',
        year: 2024,
        month: 1,
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Generated 20 storage ledger entries')
      expect(mockGenerateStorageLedger).toHaveBeenCalledWith(2024, 1, undefined)
    })

    it('should generate storage ledger for specific warehouse', async () => {
      mockGenerateStorageLedger.mockResolvedValue(8)

      const request = createRequest({
        type: 'storage-ledger',
        year: 2024,
        month: 1,
        warehouseId: 'warehouse-1',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Generated 8 storage ledger entries')
      expect(mockGenerateStorageLedger).toHaveBeenCalledWith(2024, 1, 'warehouse-1')
    })

    it('should require year for storage ledger calculation', async () => {
      const request = createRequest({
        type: 'storage-ledger',
        month: 1,
        // Missing year
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Year and month are required for storage ledger calculation')
    })

    it('should require month for storage ledger calculation', async () => {
      const request = createRequest({
        type: 'storage-ledger',
        year: 2024,
        // Missing month
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Year and month are required for storage ledger calculation')
    })

    it('should handle different months correctly', async () => {
      const months = [1, 6, 12]

      for (const month of months) {
        mockGenerateStorageLedger.mockResolvedValue(10)

        const request = createRequest({
          type: 'storage-ledger',
          year: 2024,
          month,
        })
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(mockGenerateStorageLedger).toHaveBeenCalledWith(2024, month, undefined)
      }
    })
  })

  describe('Invalid Calculation Types', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
    })

    it('should reject invalid calculation type', async () => {
      const request = createRequest({
        type: 'invalid-type',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid calculation type')
    })

    it('should reject empty calculation type', async () => {
      const request = createRequest({})
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid calculation type')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
    })

    it('should handle inventory balance calculation errors', async () => {
      mockUpdateInventoryBalances.mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = createRequest({ type: 'inventory-balance' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to perform calculation')
      expect(data.details).toBe('Database connection failed')
    })

    it('should handle storage ledger calculation errors', async () => {
      mockGenerateStorageLedger.mockRejectedValue(
        new Error('Invalid billing period')
      )

      const request = createRequest({
        type: 'storage-ledger',
        year: 2024,
        month: 1,
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to perform calculation')
      expect(data.details).toBe('Invalid billing period')
    })

    it('should handle unknown errors gracefully', async () => {
      mockUpdateInventoryBalances.mockRejectedValue('Unknown error')

      const request = createRequest({ type: 'inventory-balance' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to perform calculation')
      expect(data.details).toBe('Unknown error')
    })
  })

  describe('Concurrent Calculations', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(mockSessions.admin)
    })

    it('should handle multiple calculation requests', async () => {
      mockUpdateInventoryBalances.mockResolvedValue(10)
      mockGenerateStorageLedger.mockResolvedValue(15)

      // First request - inventory balance
      const request1 = createRequest({ type: 'inventory-balance' })
      const response1 = await POST(request1)
      expect(response1.status).toBe(200)

      // Second request - storage ledger
      const request2 = createRequest({
        type: 'storage-ledger',
        year: 2024,
        month: 1,
      })
      const response2 = await POST(request2)
      expect(response2.status).toBe(200)

      expect(mockUpdateInventoryBalances).toHaveBeenCalledTimes(1)
      expect(mockGenerateStorageLedger).toHaveBeenCalledTimes(1)
    })
  })
})