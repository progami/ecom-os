import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { WmsUserRole as UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      warehouseId?: string
    }
  }
  
  interface User {
    role: UserRole
    warehouseId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    warehouseId?: string
  }
}

export const authOptions: NextAuthOptions = {
  // Remove adapter when using JWT strategy with credentials
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        emailOrUsername: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('Auth attempt for:', credentials?.emailOrUsername)
        
        if (!credentials?.emailOrUsername || !credentials?.password) {
          console.log('Missing credentials')
          throw new Error('Invalid credentials')
        }

        // First check for legacy/default admin user
        if (credentials.emailOrUsername === "admin@ecomos.com" && credentials.password === "admin") {
          return {
            id: "1",
            email: "admin@ecomos.com",
            name: "Admin User",
            role: UserRole.admin,
          }
        }

        // Check if input is email or username
        const isEmail = credentials.emailOrUsername.includes('@')
        
        const user = await prisma.wmsUser.findFirst({
          where: {
            OR: [
              { email: credentials.emailOrUsername },
              { username: credentials.emailOrUsername }
            ]
          },
          include: {
            warehouse: true,
          },
        })

        if (!user || !user.isActive) {
          console.log('User not found or inactive:', credentials.emailOrUsername)
          throw new Error('Invalid credentials')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          console.log('Invalid password for:', credentials.emailOrUsername)
          throw new Error('Invalid credentials')
        }
        
        console.log('Login successful for:', user.email)

        // Update last login
        await prisma.wmsUser.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          warehouseId: user.warehouseId || undefined,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.warehouseId = user.warehouseId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role
        session.user.warehouseId = token.warehouseId
      }
      return session
    },
  },
  pages: {
    signIn: '/wms/auth/login',
    error: '/wms/auth/error',
  },
}