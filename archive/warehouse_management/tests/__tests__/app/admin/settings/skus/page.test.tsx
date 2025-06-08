import React from 'react'
import { render, screen } from '@testing-library/react'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import AdminSkusPage from '@/app/admin/settings/skus/page'
import { prisma } from '@/lib/prisma'
import { mockData } from '@/__tests__/test-utils'

// Mock dependencies
jest.mock('next-auth/next')
jest.mock('next/navigation')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    sku: {
      findMany: jest.fn(),
    },
  },
}))

// Mock the DashboardLayout component
jest.mock('@/components/layout/dashboard-layout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}))

describe('Admin SKUs Page', () => {
  const mockGetServerSession = getServerSession as jest.Mock
  const mockRedirect = redirect as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Authentication and Authorization', () => {
    it('should redirect to login if user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      await AdminSkusPage()

      expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
      expect(prisma.sku.findMany).not.toHaveBeenCalled()
    })

    it('should redirect to login if user is not admin', async () => {
      const nonAdminRoles = ['staff']

      for (const role of nonAdminRoles) {
        mockGetServerSession.mockResolvedValue({
          user: { id: 'user-1', role },
        })

        await AdminSkusPage()

        expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
      }
    })

    it('should allow admin to access the page', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' },
      })
      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue([])

      const { container } = render(await AdminSkusPage())

      expect(mockRedirect).not.toHaveBeenCalled()
      expect(container.querySelector('[data-testid="dashboard-layout"]')).toBeInTheDocument()
    })
  })

  describe('Page Content', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' },
      })
    })

    it('should display page title and description', async () => {
      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue([])

      render(await AdminSkusPage())

      expect(screen.getByText('SKU Management')).toBeInTheDocument()
      expect(screen.getByText('Manage product definitions and specifications')).toBeInTheDocument()
    })

    it('should display Add SKU button', async () => {
      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue([])

      render(await AdminSkusPage())

      const addButton = screen.getByRole('button', { name: /add sku/i })
      expect(addButton).toBeInTheDocument()
    })

    it('should display SKU table headers', async () => {
      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue([])

      render(await AdminSkusPage())

      expect(screen.getByText('SKU Code')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('ASIN')).toBeInTheDocument()
      expect(screen.getByText('Units/Carton')).toBeInTheDocument()
      expect(screen.getByText('Carton Weight')).toBeInTheDocument()
      expect(screen.getByText('Dimensions')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })
  })

  describe('SKU Data Display', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' },
      })
    })

    it('should display SKU data in table', async () => {
      const mockSkus = [
        mockData.sku({
          skuCode: 'CS-001',
          description: 'Product 1',
          asin: 'B001234567',
          unitsPerCarton: 12,
          cartonWeightKg: 6.5,
          cartonDimensionsCm: '40x30x20',
          isActive: true,
        }),
        mockData.sku({
          skuCode: 'CS-002',
          description: 'Product 2',
          asin: null,
          unitsPerCarton: 24,
          cartonWeightKg: null,
          cartonDimensionsCm: null,
          isActive: false,
        }),
      ]

      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue(mockSkus)

      render(await AdminSkusPage())

      // First SKU
      expect(screen.getByText('CS-001')).toBeInTheDocument()
      expect(screen.getByText('Product 1')).toBeInTheDocument()
      expect(screen.getByText('B001234567')).toBeInTheDocument()
      expect(screen.getByText('12')).toBeInTheDocument()
      expect(screen.getByText('6.5 kg')).toBeInTheDocument()
      expect(screen.getByText('40x30x20')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()

      // Second SKU with null values
      expect(screen.getByText('CS-002')).toBeInTheDocument()
      expect(screen.getByText('Product 2')).toBeInTheDocument()
      expect(screen.getByText('24')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
      // Null values should show as '-'
      expect(screen.getAllByText('-').length).toBeGreaterThan(0)
    })

    it('should sort SKUs by code', async () => {
      const mockSkus = [
        mockData.sku({ skuCode: 'CS-003' }),
        mockData.sku({ skuCode: 'CS-001' }),
        mockData.sku({ skuCode: 'CS-002' }),
      ]

      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue(mockSkus)

      await AdminSkusPage()

      expect(prisma.sku.findMany).toHaveBeenCalledWith({
        orderBy: { skuCode: 'asc' },
      })
    })

    it('should display edit button for each SKU', async () => {
      const mockSkus = [
        mockData.sku({ skuCode: 'CS-001' }),
        mockData.sku({ skuCode: 'CS-002' }),
      ]

      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue(mockSkus)

      render(await AdminSkusPage())

      const editButtons = screen.getAllByRole('button')
      // Should have Add SKU button + edit buttons for each SKU
      expect(editButtons.length).toBe(3)
    })
  })

  describe('SKU Summary Section', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' },
      })
    })

    it('should display SKU summary statistics', async () => {
      const mockSkus = [
        mockData.sku({ isActive: true, asin: 'B001' }),
        mockData.sku({ isActive: true, asin: 'B002' }),
        mockData.sku({ isActive: false, asin: null }),
        mockData.sku({ isActive: true, asin: null }),
      ]

      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue(mockSkus)

      render(await AdminSkusPage())

      expect(screen.getByText('SKU Summary')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument() // Total SKUs
      expect(screen.getByText('3')).toBeInTheDocument() // Active SKUs
      expect(screen.getByText('1')).toBeInTheDocument() // Inactive SKUs
      expect(screen.getByText('2')).toBeInTheDocument() // With ASIN
    })

    it('should display correct labels for summary cards', async () => {
      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue([])

      render(await AdminSkusPage())

      expect(screen.getByText('Total SKUs')).toBeInTheDocument()
      expect(screen.getByText('Active SKUs')).toBeInTheDocument()
      expect(screen.getByText('Inactive SKUs')).toBeInTheDocument()
      expect(screen.getByText('With ASIN')).toBeInTheDocument()
    })

    it('should handle empty SKU list', async () => {
      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue([])

      render(await AdminSkusPage())

      // All counts should be 0
      const zeroElements = screen.getAllByText('0')
      expect(zeroElements.length).toBe(4) // All summary counts
    })
  })

  describe('Table Styling', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' },
      })
    })

    it('should apply correct styling classes', async () => {
      const mockSkus = [mockData.sku({ isActive: true })]

      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue(mockSkus)

      const { container } = render(await AdminSkusPage())

      // Check table structure
      expect(container.querySelector('.border.rounded-lg.overflow-hidden')).toBeInTheDocument()
      expect(container.querySelector('table.min-w-full')).toBeInTheDocument()
      expect(container.querySelector('thead.bg-gray-50')).toBeInTheDocument()

      // Check badges
      expect(container.querySelector('.badge-success')).toBeInTheDocument()
    })

    it('should apply hover effect on table rows', async () => {
      const mockSkus = [mockData.sku()]

      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue(mockSkus)

      const { container } = render(await AdminSkusPage())

      const tableRow = container.querySelector('tbody tr')
      expect(tableRow).toHaveClass('hover:bg-gray-50')
    })
  })

  describe('Empty State', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' },
      })
    })

    it('should render empty table when no SKUs exist', async () => {
      ;(prisma.sku.findMany as jest.Mock).mockResolvedValue([])

      const { container } = render(await AdminSkusPage())

      const tbody = container.querySelector('tbody')
      expect(tbody?.children.length).toBe(0)
    })
  })
})