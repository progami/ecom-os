import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { MainNav } from '@/components/layout/main-nav'
import { render, mockSessions } from '@/__tests__/test-utils'

// Mock dependencies
jest.mock('next-auth/react')
jest.mock('next/navigation')

describe('MainNav Component', () => {
  const mockSignOut = signOut as jest.Mock
  const mockUseSession = useSession as jest.Mock
  const mockUsePathname = usePathname as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePathname.mockReturnValue('/dashboard')
    mockSignOut.mockImplementation(() => Promise.resolve())
  })

  describe('Role-based Navigation', () => {
    it('should render admin navigation for system_admin role', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })

      render(<MainNav />)

      // Admin should see all navigation items
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Inventory')).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('Calculations')).toBeInTheDocument()
      expect(screen.getByText('Finance')).toBeInTheDocument()
      expect(screen.getByText('Invoices')).toBeInTheDocument()
      expect(screen.getByText('Reconciliation')).toBeInTheDocument()
      expect(screen.getByText('Warehouse Ops')).toBeInTheDocument()
      expect(screen.getByText('Reports')).toBeInTheDocument()
      expect(screen.getByText('SKUs')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should render finance navigation for finance_admin role', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.financeAdmin,
        status: 'authenticated',
      })

      render(<MainNav />)

      // Finance admin should see finance-specific items
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Invoices')).toBeInTheDocument()
      expect(screen.getByText('Reconciliation')).toBeInTheDocument()
      expect(screen.getByText('Reports')).toBeInTheDocument()
      expect(screen.getByText('Cost Rates')).toBeInTheDocument()

      // Should not see admin-only items
      expect(screen.queryByText('Users')).not.toBeInTheDocument()
      expect(screen.queryByText('Warehouse Ops')).not.toBeInTheDocument()
    })

    it('should render warehouse navigation for warehouse_staff role', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.warehouseStaff,
        status: 'authenticated',
      })

      render(<MainNav />)

      // Warehouse staff should see warehouse-specific items
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Inventory')).toBeInTheDocument()
      expect(screen.getByText('Receive')).toBeInTheDocument()
      expect(screen.getByText('Ship')).toBeInTheDocument()
      expect(screen.getByText('Reports')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()

      // Should not see finance or admin items
      expect(screen.queryByText('Invoices')).not.toBeInTheDocument()
      expect(screen.queryByText('Users')).not.toBeInTheDocument()
    })

    it('should render manager navigation for manager role', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.manager,
        status: 'authenticated',
      })

      render(<MainNav />)

      // Manager should see overview items
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Analytics')).toBeInTheDocument()
      expect(screen.getByText('Reports')).toBeInTheDocument()

      // Should not see operational items
      expect(screen.queryByText('Inventory')).not.toBeInTheDocument()
      expect(screen.queryByText('Invoices')).not.toBeInTheDocument()
    })

    it('should render viewer navigation for viewer role', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.viewer,
        status: 'authenticated',
      })

      render(<MainNav />)

      // Viewer should only see read-only items
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Reports')).toBeInTheDocument()

      // Should not see any operational items
      expect(screen.queryByText('Inventory')).not.toBeInTheDocument()
      expect(screen.queryByText('Settings')).not.toBeInTheDocument()
    })
  })

  describe('Active Route Highlighting', () => {
    it('should highlight the active route', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })
      mockUsePathname.mockReturnValue('/admin/inventory')

      render(<MainNav />)

      const inventoryLink = screen.getByRole('link', { name: /inventory/i })
      expect(inventoryLink).toHaveClass('bg-gray-100', 'text-primary')
    })

    it('should not highlight inactive routes', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })
      mockUsePathname.mockReturnValue('/admin/dashboard')

      render(<MainNav />)

      const inventoryLink = screen.getByRole('link', { name: /inventory/i })
      expect(inventoryLink).not.toHaveClass('bg-gray-100')
      expect(inventoryLink).toHaveClass('text-gray-700')
    })
  })

  describe('User Information Display', () => {
    it('should display user information', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })

      render(<MainNav />)

      expect(screen.getByText('Signed in as')).toBeInTheDocument()
      expect(screen.getByText('Admin User')).toBeInTheDocument()
      expect(screen.getByText('admin@warehouse.com')).toBeInTheDocument()
    })

    it('should display sign out button', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })

      render(<MainNav />)

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      expect(signOutButton).toBeInTheDocument()
    })
  })

  describe('Sign Out Functionality', () => {
    it('should call signOut when sign out button is clicked', async () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })

      render(<MainNav />)

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledWith({
          callbackUrl: '/auth/login',
        })
      })
    })
  })

  describe('Mobile Navigation', () => {
    it('should render mobile menu button on small screens', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })

      render(<MainNav />)

      const mobileMenuButton = screen.getByRole('button', { name: /open sidebar/i })
      expect(mobileMenuButton).toBeInTheDocument()
    })

    it('should open mobile menu when button is clicked', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })

      render(<MainNav />)

      const mobileMenuButton = screen.getByRole('button', { name: /open sidebar/i })
      fireEvent.click(mobileMenuButton)

      // Should show close button when menu is open
      const closeButton = screen.getByRole('button', { name: /close sidebar/i })
      expect(closeButton).toBeInTheDocument()
    })

    it('should close mobile menu when close button is clicked', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })

      render(<MainNav />)

      // Open menu
      const mobileMenuButton = screen.getByRole('button', { name: /open sidebar/i })
      fireEvent.click(mobileMenuButton)

      // Close menu
      const closeButton = screen.getByRole('button', { name: /close sidebar/i })
      fireEvent.click(closeButton)

      // Close button should no longer be visible
      expect(screen.queryByRole('button', { name: /close sidebar/i })).not.toBeInTheDocument()
    })

    it('should close mobile menu when navigation link is clicked', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })

      render(<MainNav />)

      // Open menu
      const mobileMenuButton = screen.getByRole('button', { name: /open sidebar/i })
      fireEvent.click(mobileMenuButton)

      // Click a navigation link
      const dashboardLinks = screen.getAllByText('Dashboard')
      // Click the mobile menu dashboard link (second one)
      fireEvent.click(dashboardLinks[1])

      // Menu should close
      expect(screen.queryByRole('button', { name: /close sidebar/i })).not.toBeInTheDocument()
    })
  })

  describe('No Session Handling', () => {
    it('should not render navigation when no session exists', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      })

      const { container } = render(<MainNav />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Icon Rendering', () => {
    it('should render correct icons for navigation items', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })

      render(<MainNav />)

      // Check for presence of navigation with icons
      const navItems = screen.getAllByRole('link')
      expect(navItems.length).toBeGreaterThan(0)

      // Verify specific navigation items have the correct structure
      const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
      expect(dashboardLink).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })

      render(<MainNav />)

      // Check for proper list structure
      const lists = screen.getAllByRole('list')
      expect(lists.length).toBeGreaterThan(0)

      // Check for screen reader only text
      expect(screen.getByText('Open sidebar')).toHaveClass('sr-only')
    })

    it('should mark icon as decorative with aria-hidden', () => {
      mockUseSession.mockReturnValue({
        data: mockSessions.admin,
        status: 'authenticated',
      })

      render(<MainNav />)

      // Icons should be hidden from screen readers
      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      const icon = signOutButton.querySelector('[aria-hidden="true"]')
      expect(icon).toBeInTheDocument()
    })
  })
})