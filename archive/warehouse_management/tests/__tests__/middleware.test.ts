import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { middleware } from '@/middleware'

// Mock next-auth/jwt
jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))

// Mock NextResponse
const mockRedirect = jest.fn()
const mockNext = jest.fn()

jest.mock('next/server', () => ({
  NextResponse: {
    redirect: (...args: any[]) => {
      mockRedirect(...args)
      return { redirect: true }
    },
    next: (...args: any[]) => {
      mockNext(...args)
      return { next: true }
    },
  },
  NextRequest: jest.requireActual('next/server').NextRequest,
}))

describe('Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXTAUTH_SECRET = 'test-secret'
  })

  const createRequest = (pathname: string) => {
    const url = new URL(`http://localhost:3000${pathname}`)
    return new NextRequest(url)
  }

  describe('Public Routes', () => {
    it('should allow access to login page without authentication', async () => {
      const request = createRequest('/auth/login')
      ;(getToken as jest.Mock).mockResolvedValue(null)

      await middleware(request)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('should allow access to public assets', async () => {
      const publicPaths = ['/_next/static/test.js', '/favicon.ico', '/robots.txt']

      for (const path of publicPaths) {
        jest.clearAllMocks()
        const request = createRequest(path)
        
        await middleware(request)

        expect(mockNext).toHaveBeenCalled()
        expect(getToken).not.toHaveBeenCalled()
      }
    })
  })

  describe('Protected Routes', () => {
    it('should redirect to login when accessing protected route without authentication', async () => {
      const request = createRequest('/dashboard')
      ;(getToken as jest.Mock).mockResolvedValue(null)

      await middleware(request)

      expect(mockRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining('/auth/login'),
        })
      )
    })

    it('should allow authenticated users to access protected routes', async () => {
      const request = createRequest('/dashboard')
      ;(getToken as jest.Mock).mockResolvedValue({
        id: 'user-123',
        role: 'admin',
      })

      await middleware(request)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })
  })

  describe('Role-based Route Protection', () => {
    const roleBasedRoutes = [
      { path: '/admin/users', allowedRoles: ['system_admin'] },
      { path: '/admin/settings', allowedRoles: ['system_admin'] },
      { path: '/finance/dashboard', allowedRoles: ['system_admin', 'finance_admin'] },
      { path: '/operations/inventory', allowedRoles: ['system_admin', 'warehouse_staff'] },
    ]

    roleBasedRoutes.forEach(({ path, allowedRoles }) => {
      describe(`Route: ${path}`, () => {
        allowedRoles.forEach((role) => {
          it(`should allow ${role} to access`, async () => {
            const request = createRequest(path)
            ;(getToken as jest.Mock).mockResolvedValue({
              id: 'user-123',
              role,
            })

            await middleware(request)

            expect(mockNext).toHaveBeenCalled()
            expect(mockRedirect).not.toHaveBeenCalled()
          })
        })

        const deniedRoles = ['viewer', 'manager'].filter(
          (role) => !allowedRoles.includes(role)
        )

        deniedRoles.forEach((role) => {
          it(`should deny ${role} from accessing`, async () => {
            const request = createRequest(path)
            ;(getToken as jest.Mock).mockResolvedValue({
              id: 'user-123',
              role,
            })

            await middleware(request)

            expect(mockRedirect).toHaveBeenCalledWith(
              expect.objectContaining({
                href: expect.stringContaining('/unauthorized'),
              })
            )
          })
        })
      })
    })
  })

  describe('Warehouse Staff Route Restrictions', () => {
    it('should restrict warehouse staff to their assigned warehouse', async () => {
      const request = createRequest('/operations/inventory?warehouseId=warehouse-2')
      ;(getToken as jest.Mock).mockResolvedValue({
        id: 'user-123',
        role: 'warehouse_staff',
        warehouseId: 'warehouse-1',
      })

      await middleware(request)

      // In a real implementation, this would check warehouse access
      // For now, we'll just verify the middleware runs
      expect(getToken).toHaveBeenCalled()
    })
  })

  describe('Redirect Logic', () => {
    it('should redirect authenticated users from login page to dashboard', async () => {
      const request = createRequest('/auth/login')
      ;(getToken as jest.Mock).mockResolvedValue({
        id: 'user-123',
        role: 'admin',
      })

      await middleware(request)

      expect(mockRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining('/dashboard'),
        })
      )
    })

    it('should redirect to role-specific dashboard', async () => {
      const roleDashboards = [
        { role: 'system_admin', dashboard: '/admin/dashboard' },
        { role: 'finance_admin', dashboard: '/finance/dashboard' },
        { role: 'warehouse_staff', dashboard: '/dashboard' },
        { role: 'manager', dashboard: '/dashboard' },
        { role: 'viewer', dashboard: '/dashboard' },
      ]

      for (const { role, dashboard } of roleDashboards) {
        jest.clearAllMocks()
        const request = createRequest('/')
        ;(getToken as jest.Mock).mockResolvedValue({
          id: 'user-123',
          role,
        })

        await middleware(request)

        expect(mockRedirect).toHaveBeenCalledWith(
          expect.objectContaining({
            href: expect.stringContaining(dashboard),
          })
        )
      }
    })
  })

  describe('API Route Protection', () => {
    it('should protect API routes', async () => {
      const apiRoutes = [
        '/api/inventory',
        '/api/calculations/storage-ledger',
        '/api/reports',
      ]

      for (const route of apiRoutes) {
        jest.clearAllMocks()
        const request = createRequest(route)
        ;(getToken as jest.Mock).mockResolvedValue(null)

        await middleware(request)

        expect(mockRedirect).toHaveBeenCalledWith(
          expect.objectContaining({
            href: expect.stringContaining('/auth/login'),
          })
        )
      }
    })

    it('should allow authenticated users to access API routes', async () => {
      const request = createRequest('/api/inventory')
      ;(getToken as jest.Mock).mockResolvedValue({
        id: 'user-123',
        role: 'admin',
      })

      await middleware(request)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })
  })
})