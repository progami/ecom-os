import { NextAuthOptions } from 'next-auth'
import type { Session } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { applyDevAuthDefaults, withSharedAuth, getAppEntitlement } from '@ecom-os/auth'
import { UserRole } from '@prisma/client'

const devPort = process.env.PORT || process.env.WMS_PORT || 3001
const devBaseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${devPort}`
const portalDev = process.env.PORTAL_AUTH_URL || 'http://localhost:3000'
applyDevAuthDefaults({
  appId: 'ecomos',
  port: devPort,
  baseUrl: devBaseUrl,
  cookieDomain: 'localhost',
  portalUrl: portalDev,
  publicPortalUrl: process.env.NEXT_PUBLIC_PORTAL_AUTH_URL || 'http://localhost:3000',
})

const sharedSecret = process.env.PORTAL_AUTH_SECRET || process.env.NEXTAUTH_SECRET
if (sharedSecret) {
  process.env.NEXTAUTH_SECRET = sharedSecret
}

const baseAuthOptions: NextAuthOptions = {
  // NextAuth automatically inherits Next.js basePath, no need to specify it here
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: sharedSecret,
  debug: false,
  // Include a no-op credentials provider so NextAuth routes (csrf/session) function
  // WMS does not authenticate locally; the portal issues the session cookie
  providers: [
    CredentialsProvider({
      name: 'noop',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize() {
        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // WMS is decode-only; preserve portal-issued claims
      const userId = (user as { id?: unknown } | null)?.id
      if (typeof userId === 'string') {
        token.sub = userId
      }
      return token
    },
    async session({ session, token }) {
      if (typeof token.sub === 'string') {
        session.user.id = token.sub
      }
      // Prefer portal roles claim for WMS
      const rolesClaim = (token as { roles?: unknown }).roles
      const wmsEnt = getAppEntitlement(rolesClaim, 'wms')
      const allowedRoles: UserRole[] = ['admin', 'staff']
      if (wmsEnt?.role && allowedRoles.includes(wmsEnt.role as UserRole)) {
        session.user.role = wmsEnt.role as UserRole
      }
      const sessionUser = session.user as Session['user'] & { departments?: string[] }
      sessionUser.departments = wmsEnt?.depts
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
  {
    cookieDomain: process.env.COOKIE_DOMAIN || '.targonglobal.com',
    // Use portal cookie prefix so NextAuth reads the same dev cookie as ecomOS
    appId: 'ecomos',
  }
)
