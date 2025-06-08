import { authOptions } from '@/lib/auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcryptjs from 'bcryptjs'

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

jest.mock('@next-auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn(() => ({})),
}))

describe('Authentication Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXTAUTH_SECRET = 'test-secret'
  })

  describe('authOptions', () => {
    it('should have correct configuration', () => {
      expect(authOptions.adapter).toBeDefined()
      expect(authOptions.session?.strategy).toBe('jwt')
      expect(authOptions.providers).toHaveLength(1)
      expect(authOptions.providers[0].id).toBe('credentials')
    })

    it('should use PrismaAdapter', () => {
      expect(PrismaAdapter).toHaveBeenCalledWith(prisma)
    })
  })

  describe('Credentials Provider', () => {
    const credentialsProvider = authOptions.providers[0] as any
    
    it('should authenticate valid user with correct password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hashed-password',
        role: 'system_admin',
        warehouseId: null,
        isActive: true,
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(bcryptjs.compare as jest.Mock).mockResolvedValue(true)

      const result = await credentialsProvider.authorize({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
      expect(bcryptjs.compare).toHaveBeenCalledWith('password123', 'hashed-password')
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'system_admin',
        warehouseId: null,
      })
    })

    it('should reject authentication with incorrect password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        isActive: true,
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(bcryptjs.compare as jest.Mock).mockResolvedValue(false)

      const result = await credentialsProvider.authorize({
        email: 'test@example.com',
        password: 'wrong-password',
      })

      expect(result).toBeNull()
    })

    it('should reject authentication for non-existent user', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await credentialsProvider.authorize({
        email: 'nonexistent@example.com',
        password: 'password123',
      })

      expect(result).toBeNull()
      expect(bcryptjs.compare).not.toHaveBeenCalled()
    })

    it('should reject authentication for inactive user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        isActive: false,
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

      const result = await credentialsProvider.authorize({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result).toBeNull()
      expect(bcryptjs.compare).not.toHaveBeenCalled()
    })
  })

  describe('Callbacks', () => {
    it('should include user details in JWT token', async () => {
      const token = { sub: 'user-123' }
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'warehouse_staff',
        warehouseId: 'warehouse-1',
      }

      const result = await authOptions.callbacks!.jwt!({ token: { ...token, role: 'warehouse_staff' }, user })

      expect(result).toEqual({
        sub: 'user-123',
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'warehouse_staff',
        warehouseId: 'warehouse-1',
      })
    })

    it('should include user details in session', async () => {
      const session = {
        user: {
          id: '',
          email: '',
          name: '',
          role: 'warehouse_staff' as const,
        },
        expires: new Date().toISOString(),
      }
      const token = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'finance_admin',
        warehouseId: null,
      }

      const result = await authOptions.callbacks!.session!({ session, token })

      expect(result.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'finance_admin',
        warehouseId: null,
      })
    })
  })

  describe('Role-based Access Control', () => {
    const testRoles = [
      'system_admin',
      'finance_admin',
      'warehouse_staff',
      'manager',
      'viewer',
    ]

    testRoles.forEach((role) => {
      it(`should authenticate user with ${role} role`, async () => {
        const mockUser = {
          id: `${role}-user`,
          email: `${role}@example.com`,
          fullName: `${role} User`,
          passwordHash: 'hashed-password',
          role,
          warehouseId: role === 'warehouse_staff' ? 'warehouse-1' : null,
          isActive: true,
        }

        const credentialsProvider = authOptions.providers[0] as any
        ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
        ;(bcryptjs.compare as jest.Mock).mockResolvedValue(true)

        const result = await credentialsProvider.authorize({
          email: `${role}@example.com`,
          password: 'password123',
        })

        expect(result?.role).toBe(role)
      })
    })
  })
})