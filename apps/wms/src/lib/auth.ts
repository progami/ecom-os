import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth'
import { getTenantPrisma } from '@/lib/tenant/server'

if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('NEXT_PUBLIC_APP_URL must be defined for WMS auth configuration.')
}
if (!process.env.PORTAL_AUTH_URL) {
  throw new Error('PORTAL_AUTH_URL must be defined for WMS auth configuration.')
}
if (!process.env.NEXT_PUBLIC_PORTAL_AUTH_URL) {
  throw new Error('NEXT_PUBLIC_PORTAL_AUTH_URL must be defined for WMS auth configuration.')
}

applyDevAuthDefaults({
  appId: 'ecomos',
})

function sanitizeBaseUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    url.hash = ''
    url.search = ''
    if (/\/api\/auth\/?$/.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/?api\/auth\/?$/, '') || '/'
    }
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }
    return url.origin + (url.pathname === '/' ? '' : url.pathname)
  } catch {
    return undefined
  }
}

const normalizedNextAuthUrl = sanitizeBaseUrl(process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL)
if (normalizedNextAuthUrl) {
  process.env.NEXTAUTH_URL = normalizedNextAuthUrl
}

const sharedSecret = process.env.PORTAL_AUTH_SECRET || process.env.NEXTAUTH_SECRET
if (!sharedSecret) {
  throw new Error('PORTAL_AUTH_SECRET or NEXTAUTH_SECRET must be defined for WMS auth configuration.')
}
process.env.NEXTAUTH_SECRET = sharedSecret

const baseAuthOptions: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: sharedSecret,
  debug: false,
  // Include a no-op credentials provider so NextAuth routes (csrf/session) function
  // WMS does not authenticate locally; the portal issues the session cookie
  providers: [
    Credentials({
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
      // Get user from tenant-specific database by EMAIL
      // Portal IDs (token.sub) differ from WMS user IDs, so we look up by email
      const email = (token.email ?? session.user?.email) as string | undefined
      if (email) {
        const prisma = await getTenantPrisma()
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true, region: true, warehouseId: true },
        })
        if (user) {
          // Use the WMS user ID, not the portal ID
          session.user.id = user.id
          session.user.role = user.role
          session.user.region = user.region
          if (user.warehouseId) {
            session.user.warehouseId = user.warehouseId
          }
        }
      }

      return session
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
}

export const authOptions: NextAuthConfig = withSharedAuth(
  baseAuthOptions,
  {
    cookieDomain: process.env.COOKIE_DOMAIN || '.targonglobal.com',
    // Use portal cookie prefix so NextAuth reads the same dev cookie as ecomOS
    appId: 'ecomos',
  }
)

// Initialize NextAuth with config and export handlers + auth function
export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
