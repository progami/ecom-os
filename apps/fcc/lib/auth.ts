import type { NextAuthOptions } from 'next-auth'
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth'

const devPort = process.env.PORT || process.env.FCC_PORT || 3003
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
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as any).id) {
        token.sub = (user as any).id
      }
      return token
    },
    async session({ session, token }) {
      // Basic identity
      // @ts-expect-error id
      session.user.id = (token.sub as string) || session.user.id
      // Central entitlements
      // @ts-expect-error roles claim
      session.roles = (token as any).roles
      // @ts-expect-error version
      session.entitlements_ver = (token as any).entitlements_ver
      return session
    },
  },
  // No signIn page here; sign-in happens at central portal (ecomos)
}

export const authOptions: NextAuthOptions = withSharedAuth(baseAuthOptions, {
  cookieDomain: process.env.COOKIE_DOMAIN || '.targonglobal.com',
  // Read central cookie in dev
  appId: 'ecomos',
})
