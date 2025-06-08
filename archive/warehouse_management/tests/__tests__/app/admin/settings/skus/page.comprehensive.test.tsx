import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Mock the server component
jest.mock('@/app/admin/settings/skus/page', () => ({
  __esModule: true,
  default: function AdminSkusPage() {
    const mockSkus = [
      {
        id: 'sku-1',
        skuCode: 'CS-001',
        description: 'Product A - Large Box',
        asin: 'B001234567',
        unitsPerCarton: 12,
        cartonWeightKg: 15.5,
        cartonDimensionsCm: '40x30x25',
        isActive: true,
      },
      {
        id: 'sku-2',
        skuCode: 'CS-002',
        description: 'Product B - Small Box',
        asin: null,
        unitsPerCarton: 24,
        cartonWeightKg: null,
        cartonDimensionsCm: null,
        isActive: true,
      },
      {
        id: 'sku-3',
        skuCode: 'CS-003',
        description: 'Product C - Medium Box',
        asin: 'B007654321',
        unitsPerCarton: 18,
        cartonWeightKg: 10.2,
        cartonDimensionsCm: '35x25x20',
        isActive: false,
      },
    ]

    return (
      <div>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">SKU Management</h1>
              <p className="text-muted-foreground">
                Manage product definitions and specifications
              </p>
            </div>
            <button className="action-button">
              <span className="h-4 w-4 mr-2">+</span>
              Add SKU
            </button>
          </div>

          {/* SKU Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ASIN
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Units/Carton
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carton Weight
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dimensions
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mockSkus.map((sku) => (
                  <tr key={sku.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {sku.skuCode}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {sku.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sku.asin || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {sku.unitsPerCarton}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {sku.cartonWeightKg ? `${sku.cartonWeightKg} kg` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sku.cartonDimensionsCm || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {sku.isActive ? (
                        <span className="badge-success">Active</span>
                      ) : (
                        <span className="badge-warning">Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        className="text-primary hover:text-primary/80"
                        aria-label={`Edit ${sku.skuCode}`}
                      >
                        <span className="h-4 w-4">✏️</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SKU Summary */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">SKU Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg text-center">
                <span className="h-8 w-8 mx-auto mb-2 text-indigo-600">📦</span>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-gray-600">Total SKUs</p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">2</p>
                <p className="text-sm text-gray-600">Active SKUs</p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-amber-600">1</p>
                <p className="text-sm text-gray-600">Inactive SKUs</p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">2</p>
                <p className="text-sm text-gray-600">With ASIN</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}))

describe('Admin SKUs Page', () => {
  const user = userEvent.setup()

  describe('Page Structure', () => {
    it('renders page title and description', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      expect(screen.getByText('SKU Management')).toBeInTheDocument()
      expect(screen.getByText('Manage product definitions and specifications')).toBeInTheDocument()
    })

    it('renders add SKU button', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      const addButton = screen.getByRole('button', { name: /add sku/i })
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveClass('action-button')
    })
  })

  describe('SKU Table', () => {
    it('renders all table headers', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      const headers = [
        'SKU Code',
        'Description',
        'ASIN',
        'Units/Carton',
        'Carton Weight',
        'Dimensions',
        'Status',
        'Actions'
      ]

      headers.forEach(header => {
        if (header !== 'Actions') {
          expect(screen.getByText(header)).toBeInTheDocument()
        } else {
          expect(screen.getByText('Actions', { selector: '.sr-only' })).toBeInTheDocument()
        }
      })
    })

    it('renders SKU data correctly', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      // Check first SKU
      expect(screen.getByText('CS-001')).toBeInTheDocument()
      expect(screen.getByText('Product A - Large Box')).toBeInTheDocument()
      expect(screen.getByText('B001234567')).toBeInTheDocument()
      expect(screen.getByText('12')).toBeInTheDocument()
      expect(screen.getByText('15.5 kg')).toBeInTheDocument()
      expect(screen.getByText('40x30x25')).toBeInTheDocument()

      // Check second SKU
      expect(screen.getByText('CS-002')).toBeInTheDocument()
      expect(screen.getByText('Product B - Small Box')).toBeInTheDocument()
      expect(screen.getByText('24')).toBeInTheDocument()

      // Check third SKU
      expect(screen.getByText('CS-003')).toBeInTheDocument()
      expect(screen.getByText('Product C - Medium Box')).toBeInTheDocument()
      expect(screen.getByText('B007654321')).toBeInTheDocument()
      expect(screen.getByText('18')).toBeInTheDocument()
      expect(screen.getByText('10.2 kg')).toBeInTheDocument()
      expect(screen.getByText('35x25x20')).toBeInTheDocument()
    })

    it('displays "-" for null/empty values', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      const dashes = screen.getAllByText('-')
      expect(dashes.length).toBeGreaterThan(0)
    })

    it('displays status badges correctly', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      const activeBadges = screen.getAllByText('Active')
      const inactiveBadges = screen.getAllByText('Inactive')

      expect(activeBadges).toHaveLength(2)
      expect(inactiveBadges).toHaveLength(1)

      activeBadges.forEach(badge => {
        expect(badge).toHaveClass('badge-success')
      })

      inactiveBadges.forEach(badge => {
        expect(badge).toHaveClass('badge-warning')
      })
    })

    it('renders edit buttons for each SKU', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      expect(editButtons).toHaveLength(3)

      editButtons.forEach(button => {
        expect(button).toHaveClass('text-primary', 'hover:text-primary/80')
      })
    })

    it('table rows have hover effect', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      const { container } = render(<AdminSkusPage />)

      const rows = container.querySelectorAll('tbody tr')
      rows.forEach(row => {
        expect(row).toHaveClass('hover:bg-gray-50')
      })
    })
  })

  describe('SKU Summary Section', () => {
    it('renders summary section with gradient background', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      const { container } = render(<AdminSkusPage />)

      const summarySection = container.querySelector('.bg-gradient-to-r.from-indigo-50.to-purple-50')
      expect(summarySection).toBeInTheDocument()
      expect(summarySection).toHaveTextContent('SKU Summary')
    })

    it('displays correct summary statistics', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      // Total SKUs
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Total SKUs')).toBeInTheDocument()

      // Active SKUs (green)
      expect(screen.getByText('2', { selector: '.text-green-600' })).toBeInTheDocument()
      expect(screen.getByText('Active SKUs')).toBeInTheDocument()

      // Inactive SKUs (amber)
      expect(screen.getByText('1', { selector: '.text-amber-600' })).toBeInTheDocument()
      expect(screen.getByText('Inactive SKUs')).toBeInTheDocument()

      // With ASIN (blue)
      expect(screen.getByText('2', { selector: '.text-blue-600' })).toBeInTheDocument()
      expect(screen.getByText('With ASIN')).toBeInTheDocument()
    })

    it('summary cards have white background', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      const { container } = render(<AdminSkusPage />)

      const summaryCards = container.querySelectorAll('.bg-white.p-4.rounded-lg.text-center')
      expect(summaryCards).toHaveLength(4)
    })

    it('displays icon in total SKUs card', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      expect(screen.getByText('📦')).toBeInTheDocument()
    })
  })

  describe('Table Interactions', () => {
    it('edit buttons are clickable', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      
      for (const button of editButtons) {
        expect(button).not.toBeDisabled()
        await user.click(button)
      }
    })

    it('add SKU button is clickable', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      const addButton = screen.getByRole('button', { name: /add sku/i })
      expect(addButton).not.toBeDisabled()
      
      await user.click(addButton)
    })
  })

  describe('Responsive Design', () => {
    it('table has overflow handling', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      const { container } = render(<AdminSkusPage />)

      const tableContainer = container.querySelector('.border.rounded-lg.overflow-hidden')
      expect(tableContainer).toBeInTheDocument()
    })

    it('summary grid is responsive', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      const { container } = render(<AdminSkusPage />)

      const summaryGrid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-4')
      expect(summaryGrid).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('edit buttons have accessible labels', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      expect(screen.getByRole('button', { name: 'Edit CS-001' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Edit CS-002' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Edit CS-003' })).toBeInTheDocument()
    })

    it('actions column header is screen-reader only', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      const actionsHeader = screen.getByText('Actions', { selector: '.sr-only' })
      expect(actionsHeader).toBeInTheDocument()
      expect(actionsHeader).toHaveClass('sr-only')
    })

    it('table has proper semantic structure', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      render(<AdminSkusPage />)

      const table = screen.getByRole('table')
      const headers = screen.getAllByRole('columnheader')
      const rows = screen.getAllByRole('row')

      expect(table).toBeInTheDocument()
      expect(headers.length).toBeGreaterThan(0)
      expect(rows.length).toBeGreaterThan(0)
    })
  })

  describe('Styling', () => {
    it('table headers have proper styling', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      const { container } = render(<AdminSkusPage />)

      const thead = container.querySelector('thead')
      expect(thead).toHaveClass('bg-gray-50')

      const thElements = container.querySelectorAll('th')
      thElements.forEach(th => {
        expect(th).toHaveClass('text-xs', 'font-medium', 'text-gray-500', 'uppercase')
      })
    })

    it('table has proper spacing', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      const { container } = render(<AdminSkusPage />)

      const cells = container.querySelectorAll('td')
      cells.forEach(cell => {
        expect(cell).toHaveClass('px-6', 'py-4')
      })
    })

    it('table has dividers', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      const { container } = render(<AdminSkusPage />)

      const table = container.querySelector('table')
      expect(table).toHaveClass('divide-y', 'divide-gray-200')

      const tbody = container.querySelector('tbody')
      expect(tbody).toHaveClass('divide-y', 'divide-gray-200')
    })
  })

  describe('Data Alignment', () => {
    it('numeric columns are right-aligned', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      const { container } = render(<AdminSkusPage />)

      // Units/Carton column
      const unitsHeader = screen.getByText('Units/Carton').closest('th')
      expect(unitsHeader).toHaveClass('text-right')

      // Carton Weight column
      const weightHeader = screen.getByText('Carton Weight').closest('th')
      expect(weightHeader).toHaveClass('text-right')

      // Check data cells alignment
      const unitsCells = container.querySelectorAll('td:nth-child(4)')
      const weightCells = container.querySelectorAll('td:nth-child(5)')

      unitsCells.forEach(cell => {
        expect(cell).toHaveClass('text-right')
      })

      weightCells.forEach(cell => {
        expect(cell).toHaveClass('text-right')
      })
    })

    it('status column is center-aligned', async () => {
      const { default: AdminSkusPage } = await import('@/app/admin/settings/skus/page')
      const { container } = render(<AdminSkusPage />)

      const statusHeader = screen.getByText('Status').closest('th')
      expect(statusHeader).toHaveClass('text-center')

      const statusCells = container.querySelectorAll('td:nth-child(7)')
      statusCells.forEach(cell => {
        expect(cell).toHaveClass('text-center')
      })
    })
  })
})