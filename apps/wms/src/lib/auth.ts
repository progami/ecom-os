import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth'
import { UserRole } from '@prisma/client'

const secure = process.env.NODE_ENV === 'production'

const devPort = process.env.PORT || process.env.WMS_PORT || 3001
const devBaseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${devPort}`
const centralDev = process.env.CENTRAL_AUTH_URL || 'http://localhost:3000'
applyDevAuthDefaults({
  appId: 'ecomos',
  port: devPort,
  baseUrl: devBaseUrl,
  cookieDomain: 'localhost',
  centralUrl: centralDev,
  publicCentralUrl: process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL || 'http://localhost:3000',
})

const baseAuthOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: false,
  // Include a no-op credentials provider so NextAuth routes (csrf/session) function
  // WMS does not authenticate locally; central portal issues the session cookie
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
      // WMS is decode-only; preserve central claims
      if (user && (user as any).id) {
        token.sub = (user as any).id
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = (token.sub as string) || session.user.id
      // Prefer central roles claim for WMS
      const roles: any = (token as any).roles
      const wmsEnt = roles?.wms as { role?: string; depts?: string[] } | undefined
      if (wmsEnt?.role) {
        session.user.role = (wmsEnt.role as string) as UserRole
      }
      // @ts-expect-error augment
      session.user.departments = wmsEnt?.depts
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
    // Use central cookie prefix so NextAuth reads the same dev cookie as ecomOS
    appId: 'ecomos',
  }
)
