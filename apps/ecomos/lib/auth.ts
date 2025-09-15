import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { withSharedAuth } from '@ecom-os/auth'
import { getUserEntitlements } from '@/lib/entitlements'

const baseAuthOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
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
        // If DATABASE_URL is not configured in dev, allow a safe demo fallback
        const hasDb = !!process.env.DATABASE_URL
        if (!hasDb && process.env.NODE_ENV !== 'production') {
          const demoUsernames = ['demo-admin', 'demo-admin@warehouse.com']
          const demoPass = process.env.DEMO_ADMIN_PASSWORD || 'SecureWarehouse2024!'
          if (demoUsernames.includes(credentials.emailOrUsername) && credentials.password === demoPass) {
            const fauxUser = { id: 'demo-admin-id', email: 'demo-admin@warehouse.com', name: 'Demo Admin', role: 'admin' }
            const roles = getUserEntitlements(fauxUser)
            const apps = Object.keys(roles)
            return { id: fauxUser.id, email: fauxUser.email, name: fauxUser.name, role: fauxUser.role, roles, apps } as any
          }
          throw new Error('Invalid credentials')
        }
        // Normal DB-backed flow
        try {
          const user = await prisma.user.findFirst({
            where: { email: credentials.emailOrUsername },
          } as any)
          if (!user) throw new Error('Invalid credentials')
          const isActive = (user as any).isActive ?? true
          if (!isActive) throw new Error('Invalid credentials')
          const hash = (user as any).passwordHash ?? (user as any).password
          const isPasswordValid = await bcrypt.compare(credentials.password, hash)
          if (!isPasswordValid) throw new Error('Invalid credentials')
          await prisma.user.update({ where: { id: (user as any).id }, data: { lastLoginAt: new Date() } } as any)
          const roles = getUserEntitlements({ id: (user as any).id, email: (user as any).email, name: (user as any).fullName ?? (user as any).name, role: (user as any).role as any })
          const apps = Object.keys(roles)
          return {
            id: (user as any).id,
            email: (user as any).email,
            name: (user as any).fullName ?? (user as any).name,
            role: (user as any).role,
            warehouseId: (user as any).warehouseId || undefined,
            roles,
            apps,
          } as any
        } catch (_e) {
          throw new Error('Invalid credentials')
        }
      },
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as any).id
        token.role = (user as any).role
        token.apps = (user as any).apps
        // Central roles claim
        ;(token as any).roles = (user as any).roles
        ;(token as any).entitlements_ver = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      ;(session.user as any).id = token.sub as string
      ;(session.user as any).role = (token as any).role as string | undefined
      ;(session.user as any).apps = (token as any).apps as string[] | undefined
      ;(session as any).roles = (token as any).roles
      ;(session as any).entitlements_ver = (token as any).entitlements_ver
      return session
    },
    async redirect({ url, baseUrl }) {
      const allow = String(process.env.ALLOW_CALLBACK_REDIRECT || '').toLowerCase()
      const allowCallback = allow === '1' || allow === 'true' || allow === 'yes'
      if (!allowCallback) {
        return baseUrl
      }
      try {
        const target = new URL(url, baseUrl)
        const base = new URL(baseUrl)
        if (target.origin === base.origin) return target.toString()
        if (process.env.NODE_ENV !== 'production') {
          if (target.hostname === 'localhost' || target.hostname === '127.0.0.1') {
            const relay = new URL('/auth/relay', base)
            relay.searchParams.set('to', target.toString())
            return relay.toString()
          }
          return baseUrl
        }
        const cookieDomain = (process.env.COOKIE_DOMAIN || '').replace(/^\./, '')
        if (cookieDomain && target.hostname.endsWith(cookieDomain)) {
          const relay = new URL('/auth/relay', base)
          relay.searchParams.set('to', target.toString())
          return relay.toString()
        }
      } catch {}
      return baseUrl
    },
  },
}

export const authOptions: NextAuthOptions = withSharedAuth(baseAuthOptions, {
  cookieDomain: process.env.COOKIE_DOMAIN || '.targonglobal.com',
  appId: 'ecomos',
})
