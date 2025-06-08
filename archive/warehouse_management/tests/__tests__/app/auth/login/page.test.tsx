import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import LoginPage from '@/app/auth/login/page'

// Mock dependencies
jest.mock('next-auth/react')
jest.mock('next/navigation')
jest.mock('react-hot-toast')

const mockSignIn = signIn as jest.MockedFunction<typeof signIn>
const mockPush = jest.fn()
const mockRefresh = jest.fn()
const mockToast = toast as jest.Mocked<typeof toast>

describe('Login Page', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    })
    ;(useSearchParams as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue(null),
    })
  })

  describe('UI Elements', () => {
    it('renders all login form elements', () => {
      render(<LoginPage />)

      // Check for logo and title
      expect(screen.getByText('WMS')).toBeInTheDocument()
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
      expect(screen.getByText('Warehouse Management System')).toBeInTheDocument()

      // Check for form fields
      expect(screen.getByLabelText('Email address')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()

      // Check for submit button
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()

      // Check for demo credentials
      expect(screen.getByText('Demo credentials:')).toBeInTheDocument()
      expect(screen.getByText('Admin: admin@warehouse.com / admin123')).toBeInTheDocument()
      expect(screen.getByText('Staff: staff@warehouse.com / staff123')).toBeInTheDocument()
    })

    it('has correct input attributes', () => {
      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      const passwordInput = screen.getByLabelText('Password')

      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('autoComplete', 'email')
      expect(emailInput).toHaveAttribute('required')

      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
      expect(passwordInput).toHaveAttribute('required')
    })
  })

  describe('Form Interactions', () => {
    it('updates input values when user types', async () => {
      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      const passwordInput = screen.getByLabelText('Password')

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')

      expect(emailInput).toHaveValue('test@example.com')
      expect(passwordInput).toHaveValue('password123')
    })

    it('handles form submission with valid credentials', async () => {
      mockSignIn.mockResolvedValueOnce({ error: null } as any)

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'admin@warehouse.com')
      await user.type(passwordInput, 'admin123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('credentials', {
          email: 'admin@warehouse.com',
          password: 'admin123',
          redirect: false,
        })
        expect(mockToast.success).toHaveBeenCalledWith('Login successful!')
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('handles form submission with invalid credentials', async () => {
      mockSignIn.mockResolvedValueOnce({ error: 'Invalid credentials' } as any)

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'wrong@example.com')
      await user.type(passwordInput, 'wrongpassword')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Invalid email or password')
        expect(mockPush).not.toHaveBeenCalled()
      })
    })

    it('handles network errors gracefully', async () => {
      mockSignIn.mockRejectedValueOnce(new Error('Network error'))

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('An error occurred during login')
      })
    })
  })

  describe('Loading States', () => {
    it('shows loading state during form submission', async () => {
      let resolveSignIn: any
      mockSignIn.mockImplementationOnce(() => 
        new Promise((resolve) => { resolveSignIn = resolve })
      )

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password')
      await user.click(submitButton)

      // Check for loading state
      expect(submitButton).toBeDisabled()
      expect(screen.getByText('', { selector: '.loading-spinner' })).toBeInTheDocument()

      // Resolve the promise
      resolveSignIn({ error: null })

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
      })
    })

    it('prevents multiple submissions', async () => {
      mockSignIn.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ error: null } as any), 100))
      )

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password')
      
      // Try to click multiple times
      await user.click(submitButton)
      await user.click(submitButton)
      await user.click(submitButton)

      expect(mockSignIn).toHaveBeenCalledTimes(1)
    })
  })

  describe('Callback URL Handling', () => {
    it('redirects to callback URL after successful login', async () => {
      ;(useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('/admin/dashboard'),
      })
      mockSignIn.mockResolvedValueOnce({ error: null } as any)

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'admin@warehouse.com')
      await user.type(passwordInput, 'admin123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/dashboard')
      })
    })

    it('redirects to default dashboard when no callback URL', async () => {
      mockSignIn.mockResolvedValueOnce({ error: null } as any)

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'admin@warehouse.com')
      await user.type(passwordInput, 'admin123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<LoginPage />)

      expect(screen.getByLabelText('Email address')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      // Tab through form fields
      await user.tab()
      expect(emailInput).toHaveFocus()

      await user.tab()
      expect(passwordInput).toHaveFocus()

      await user.tab()
      expect(submitButton).toHaveFocus()
    })

    it('submits form with Enter key', async () => {
      mockSignIn.mockResolvedValueOnce({ error: null } as any)

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      const passwordInput = screen.getByLabelText('Password')

      await user.type(emailInput, 'admin@warehouse.com')
      await user.type(passwordInput, 'admin123')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled()
      })
    })
  })

  describe('Responsive Design', () => {
    it('applies responsive classes', () => {
      render(<LoginPage />)

      const container = screen.getByText('Sign in to your account').closest('div')
      expect(container).toHaveClass('sm:px-6', 'lg:px-8')
    })
  })

  describe('Dark Mode Support', () => {
    it('has dark mode classes', () => {
      render(<LoginPage />)

      const emailInput = screen.getByLabelText('Email address')
      expect(emailInput).toHaveClass('dark:bg-gray-800', 'dark:border-gray-700', 'dark:text-white')
    })
  })
})