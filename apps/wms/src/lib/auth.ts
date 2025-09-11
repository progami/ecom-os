import { NextAuthOptions } from 'next-auth'
import { withSharedAuth } from '@ecom-os/auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'

const baseAuthOptions: NextAuthOptions = {
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
        if (!credentials?.emailOrUsername || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.emailOrUsername },
              { username: credentials.emailOrUsername }
            ]
          }
        })

        if (!user || !user.isActive) {
          throw new Error('Invalid credentials')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          throw new Error('Invalid credentials')
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          warehouseId: user.warehouseId || undefined,
          isDemo: user.isDemo,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id  // Ensure sub is set to the actual user ID
        token.role = user.role
        token.warehouseId = user.warehouseId
        token.isDemo = user.isDemo
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.sub!
      session.user.role = token.role as UserRole
      session.user.warehouseId = token.warehouseId as string | undefined
      session.user.isDemo = token.isDemo as boolean | undefined
      return session
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
}

export const authOptions: NextAuthOptions = withSharedAuth(
  baseAuthOptions,
  process.env.COOKIE_DOMAIN || '.targonglobal.com'
)
